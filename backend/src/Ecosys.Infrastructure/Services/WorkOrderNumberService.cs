using System.Data;
using Ecosys.Domain.Entities;
using Ecosys.Infrastructure.Data;
using Ecosys.Shared.Errors;
using Microsoft.EntityFrameworkCore;

namespace Ecosys.Infrastructure.Services;

public static class DocumentTypes
{
    public const string TenantCode = "TenantCode";
    public const string WorkOrder = "WorkOrder";
    public const string PreventiveMaintenance = "PreventiveMaintenance";
    public const string MaterialRequest = "MaterialRequest";
    public const string Asset = "Asset";
    public const string StockTransfer = "StockTransfer";
    public const string Quotation = "Quotation";
    public const string Invoice = "Invoice";
    public const string Payment = "Payment";
    public const string Expense = "Expense";
}

public static class NumberResetFrequencies
{
    public const string Never = "Never";
    public const string Yearly = "Yearly";
    public const string Monthly = "Monthly";

    public static readonly string[] All =
    [
        Never,
        Yearly,
        Monthly
    ];
}

public interface IDocumentNumberingService
{
    Task<string> GenerateAsync(Guid tenantId, Guid? branchId, string documentType, CancellationToken cancellationToken = default);
    Task<NumberingSetting> UpsertAsync(Guid tenantId, Guid? branchId, string documentType, string prefix, long nextNumber, int paddingLength, string resetFrequency, bool includeYear, bool includeMonth, bool isActive, CancellationToken cancellationToken = default);
}

internal sealed class DocumentNumberingService(AppDbContext dbContext) : IDocumentNumberingService
{
    public async Task<string> GenerateAsync(Guid tenantId, Guid? branchId, string documentType, CancellationToken cancellationToken = default)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        var setting = await FindSettingAsync(tenantId, branchId, documentType, cancellationToken)
            ?? await CreateDefaultSettingAsync(tenantId, branchId, documentType, cancellationToken);

        if (dbContext.Entry(setting).State == EntityState.Detached)
        {
            dbContext.NumberingSettings.Add(setting);
        }

        ResetIfNeeded(setting);

        var nextNumber = setting.NextNumber;
        setting.NextNumber += 1;
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Format(setting, branchId, nextNumber);
    }

    public async Task<NumberingSetting> UpsertAsync(
        Guid tenantId,
        Guid? branchId,
        string documentType,
        string prefix,
        long nextNumber,
        int paddingLength,
        string resetFrequency,
        bool includeYear,
        bool includeMonth,
        bool isActive,
        CancellationToken cancellationToken = default)
    {
        Validate(documentType, prefix, nextNumber, paddingLength, resetFrequency);

        var normalizedDocumentType = NormalizeDocumentType(documentType);
        var normalizedResetFrequency = NormalizeResetFrequency(resetFrequency);
        var normalizedPrefix = prefix.Trim().ToUpperInvariant();

        var setting = await dbContext.NumberingSettings.SingleOrDefaultAsync(
            x => x.TenantId == tenantId
                && x.BranchId == branchId
                && x.DocumentType == normalizedDocumentType,
            cancellationToken);

        if (setting is null)
        {
            setting = new NumberingSetting
            {
                TenantId = tenantId,
                BranchId = branchId,
                DocumentType = normalizedDocumentType
            };
            dbContext.NumberingSettings.Add(setting);
        }

        setting.Prefix = normalizedPrefix;
        setting.NextNumber = nextNumber;
        setting.PaddingLength = paddingLength;
        setting.ResetFrequency = normalizedResetFrequency;
        setting.IncludeYear = includeYear;
        setting.IncludeMonth = includeMonth;
        setting.IsActive = isActive;

        await dbContext.SaveChangesAsync(cancellationToken);
        return setting;
    }

    private async Task<NumberingSetting?> FindSettingAsync(Guid tenantId, Guid? branchId, string documentType, CancellationToken cancellationToken)
    {
        var normalizedDocumentType = NormalizeDocumentType(documentType);

        if (branchId.HasValue)
        {
            var branchSetting = await dbContext.NumberingSettings.SingleOrDefaultAsync(
                x => x.TenantId == tenantId
                    && x.BranchId == branchId
                    && x.DocumentType == normalizedDocumentType
                    && x.IsActive,
                cancellationToken);

            if (branchSetting is not null)
            {
                return branchSetting;
            }
        }

        return await dbContext.NumberingSettings.SingleOrDefaultAsync(
            x => x.TenantId == tenantId
                && x.BranchId == null
                && x.DocumentType == normalizedDocumentType
                && x.IsActive,
            cancellationToken);
    }

    private async Task<NumberingSetting> CreateDefaultSettingAsync(Guid tenantId, Guid? branchId, string documentType, CancellationToken cancellationToken)
    {
        var prefix = DefaultPrefix(documentType);
        if (branchId.HasValue)
        {
            var branchCode = await dbContext.Branches
                .Where(x => x.TenantId == tenantId && x.Id == branchId.Value)
                .Select(x => x.Code)
                .SingleOrDefaultAsync(cancellationToken);

            if (!string.IsNullOrWhiteSpace(branchCode))
            {
                prefix = $"{prefix}-{branchCode.Trim().ToUpperInvariant()}";
            }
        }

        return new NumberingSetting
        {
            TenantId = tenantId,
            BranchId = branchId,
            DocumentType = NormalizeDocumentType(documentType),
            Prefix = prefix,
            NextNumber = 1,
            PaddingLength = 6,
            ResetFrequency = NumberResetFrequencies.Never,
            IncludeYear = false,
            IncludeMonth = false,
            IsActive = true
        };
    }

    private static void ResetIfNeeded(NumberingSetting setting)
    {
        var now = DateTime.UtcNow;
        var lastReset = setting.LastResetAt;
        var shouldReset = setting.ResetFrequency switch
        {
            NumberResetFrequencies.Monthly => !lastReset.HasValue || lastReset.Value.Year != now.Year || lastReset.Value.Month != now.Month,
            NumberResetFrequencies.Yearly => !lastReset.HasValue || lastReset.Value.Year != now.Year,
            _ => false
        };

        if (shouldReset)
        {
            setting.NextNumber = 1;
            setting.LastResetAt = now;
        }
        else if (!setting.LastResetAt.HasValue)
        {
            setting.LastResetAt = now;
        }
    }

    private static string Format(NumberingSetting setting, Guid? requestedBranchId, long number)
    {
        var now = DateTime.UtcNow;
        var parts = new List<string>();

        if (!string.IsNullOrWhiteSpace(setting.Prefix))
        {
            parts.Add(setting.Prefix.Trim().ToUpperInvariant());
        }

        if (requestedBranchId.HasValue && setting.BranchId.HasValue && setting.BranchId == requestedBranchId)
        {
            // Prefix already carries the branch code in the expected numbering examples.
        }

        if (setting.IncludeYear)
        {
            parts.Add(now.Year.ToString("0000"));
        }

        if (setting.IncludeMonth)
        {
            parts.Add(now.Month.ToString("00"));
        }

        parts.Add(number.ToString().PadLeft(setting.PaddingLength, '0'));
        return string.Join("-", parts);
    }

    private static void Validate(string documentType, string prefix, long nextNumber, int paddingLength, string resetFrequency)
    {
        if (string.IsNullOrWhiteSpace(documentType))
        {
            throw new BusinessRuleException("Document type is required.");
        }

        if (string.IsNullOrWhiteSpace(prefix))
        {
            throw new BusinessRuleException("Prefix is required.");
        }

        if (nextNumber < 1)
        {
            throw new BusinessRuleException("Next number must be greater than zero.");
        }

        if (paddingLength < 1 || paddingLength > 12)
        {
            throw new BusinessRuleException("Padding length must be between 1 and 12.");
        }

        NormalizeResetFrequency(resetFrequency);
    }

    public static string NormalizeDocumentType(string documentType)
    {
        var normalized = documentType.Trim();
        return normalized switch
        {
            var value when string.Equals(value, DocumentTypes.TenantCode, StringComparison.OrdinalIgnoreCase) => DocumentTypes.TenantCode,
            var value when string.Equals(value, DocumentTypes.WorkOrder, StringComparison.OrdinalIgnoreCase) => DocumentTypes.WorkOrder,
            var value when string.Equals(value, DocumentTypes.PreventiveMaintenance, StringComparison.OrdinalIgnoreCase) => DocumentTypes.PreventiveMaintenance,
            var value when string.Equals(value, DocumentTypes.MaterialRequest, StringComparison.OrdinalIgnoreCase) => DocumentTypes.MaterialRequest,
            var value when string.Equals(value, DocumentTypes.Asset, StringComparison.OrdinalIgnoreCase) => DocumentTypes.Asset,
            var value when string.Equals(value, DocumentTypes.StockTransfer, StringComparison.OrdinalIgnoreCase) => DocumentTypes.StockTransfer,
            var value when string.Equals(value, DocumentTypes.Quotation, StringComparison.OrdinalIgnoreCase) => DocumentTypes.Quotation,
            var value when string.Equals(value, DocumentTypes.Invoice, StringComparison.OrdinalIgnoreCase) => DocumentTypes.Invoice,
            var value when string.Equals(value, DocumentTypes.Payment, StringComparison.OrdinalIgnoreCase) => DocumentTypes.Payment,
            var value when string.Equals(value, DocumentTypes.Expense, StringComparison.OrdinalIgnoreCase) => DocumentTypes.Expense,
            _ => throw new BusinessRuleException("Unsupported document type.")
        };
    }

    public static string NormalizeResetFrequency(string resetFrequency)
    {
        var normalized = string.IsNullOrWhiteSpace(resetFrequency) ? NumberResetFrequencies.Never : resetFrequency.Trim();
        return NumberResetFrequencies.All.Contains(normalized, StringComparer.OrdinalIgnoreCase)
            ? NumberResetFrequencies.All.Single(x => string.Equals(x, normalized, StringComparison.OrdinalIgnoreCase))
            : throw new BusinessRuleException("Reset frequency must be Never, Yearly, or Monthly.");
    }

    private static string DefaultPrefix(string documentType) =>
        NormalizeDocumentType(documentType) switch
        {
            DocumentTypes.TenantCode => "TEN",
            DocumentTypes.WorkOrder => "WO",
            DocumentTypes.PreventiveMaintenance => "PM",
            DocumentTypes.MaterialRequest => "MR",
            DocumentTypes.Asset => "AST",
            DocumentTypes.StockTransfer => "ST",
            DocumentTypes.Quotation => "QUO",
            DocumentTypes.Invoice => "INV",
            DocumentTypes.Payment => "RCT",
            DocumentTypes.Expense => "EXP",
            _ => "DOC"
        };
}
