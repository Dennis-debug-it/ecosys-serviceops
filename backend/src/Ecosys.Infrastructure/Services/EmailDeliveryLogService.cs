using Ecosys.Domain.Entities;
using Ecosys.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Ecosys.Infrastructure.Services;

public interface IEmailDeliveryLogService
{
    Task<EmailDeliveryLog> LogAsync(EmailDeliveryLogWriteRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<EmailDeliveryLog>> ListPlatformAsync(EmailDeliveryLogQuery query, CancellationToken cancellationToken = default);
}

public sealed record EmailDeliveryLogWriteRequest(
    Guid? TenantId,
    string EventKey,
    string TemplateKey,
    string RecipientEmail,
    string Subject,
    string Status,
    string? ErrorCategory,
    string? ErrorMessage,
    Guid? TriggeredByUserId,
    DateTime? SentAt = null,
    string? ProviderMessageId = null);

public sealed record EmailDeliveryLogQuery(
    string? Status,
    string? TemplateKey,
    string? EventKey,
    string? RecipientEmail,
    DateTime? DateFrom,
    DateTime? DateTo);

internal sealed class EmailDeliveryLogService(AppDbContext dbContext) : IEmailDeliveryLogService
{
    public async Task<EmailDeliveryLog> LogAsync(EmailDeliveryLogWriteRequest request, CancellationToken cancellationToken = default)
    {
        var log = new EmailDeliveryLog
        {
            TenantId = request.TenantId,
            EventKey = request.EventKey.Trim(),
            TemplateKey = request.TemplateKey.Trim(),
            RecipientEmail = request.RecipientEmail.Trim().ToLowerInvariant(),
            Subject = request.Subject.Trim(),
            Status = request.Status.Trim(),
            ErrorCategory = Normalize(request.ErrorCategory),
            ErrorMessage = Normalize(request.ErrorMessage),
            TriggeredByUserId = request.TriggeredByUserId,
            SentAt = request.SentAt,
            ProviderMessageId = Normalize(request.ProviderMessageId),
        };

        dbContext.EmailDeliveryLogs.Add(log);
        await dbContext.SaveChangesAsync(cancellationToken);
        return log;
    }

    public async Task<IReadOnlyCollection<EmailDeliveryLog>> ListPlatformAsync(EmailDeliveryLogQuery query, CancellationToken cancellationToken = default)
    {
        var logs = dbContext.EmailDeliveryLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            var status = query.Status.Trim();
            logs = logs.Where(x => x.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(query.TemplateKey))
        {
            var templateKey = query.TemplateKey.Trim();
            logs = logs.Where(x => x.TemplateKey == templateKey);
        }

        if (!string.IsNullOrWhiteSpace(query.EventKey))
        {
            var eventKey = query.EventKey.Trim();
            logs = logs.Where(x => x.EventKey == eventKey);
        }

        if (!string.IsNullOrWhiteSpace(query.RecipientEmail))
        {
            var recipient = query.RecipientEmail.Trim().ToLowerInvariant();
            logs = logs.Where(x => x.RecipientEmail.Contains(recipient) || x.Subject.ToLower().Contains(recipient));
        }

        if (query.DateFrom.HasValue)
        {
            logs = logs.Where(x => x.CreatedAt >= query.DateFrom.Value);
        }

        if (query.DateTo.HasValue)
        {
            var end = query.DateTo.Value;
            logs = logs.Where(x => x.CreatedAt <= end);
        }

        return await logs
            .OrderByDescending(x => x.CreatedAt)
            .Take(250)
            .ToListAsync(cancellationToken);
    }

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
