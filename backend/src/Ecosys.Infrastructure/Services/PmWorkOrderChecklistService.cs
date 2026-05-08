using Ecosys.Domain.Entities;
using Ecosys.Infrastructure.Data;
using Ecosys.Shared.Errors;
using Microsoft.EntityFrameworkCore;

namespace Ecosys.Infrastructure.Services;

public interface IPmWorkOrderChecklistService
{
    Task<PmTemplate> GetActiveTemplateAsync(Guid tenantId, Guid pmTemplateId, CancellationToken cancellationToken = default);
    Task<int> AttachPmTemplateToWorkOrderAsync(Guid workOrderId, Guid pmTemplateId, Guid tenantId, Guid? actorUserId = null, bool replaceExisting = false, CancellationToken cancellationToken = default);
    Task<WorkOrderChecklistItem> UpdateChecklistItemAsync(Guid workOrderId, Guid itemId, Guid tenantId, Guid actorUserId, string? responseValue, string? remarks, bool isCompleted, CancellationToken cancellationToken = default);
    Task EnsureRequiredChecklistCompletedAsync(Guid workOrderId, Guid tenantId, CancellationToken cancellationToken = default);
}

internal sealed class PmWorkOrderChecklistService(
    AppDbContext dbContext,
    IAuditLogService auditLogService) : IPmWorkOrderChecklistService
{
    private static readonly HashSet<string> AllowedInputTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "text",
        "number",
        "date",
        "dropdown",
        "yesno",
        "passfail",
        "boolean"
    };

    public async Task<PmTemplate> GetActiveTemplateAsync(Guid tenantId, Guid pmTemplateId, CancellationToken cancellationToken = default) =>
        await dbContext.PmTemplates
            .Include(x => x.Questions)
            .SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == pmTemplateId && x.IsActive, cancellationToken)
        ?? throw new NotFoundException("PM template was not found.");

    public async Task<int> AttachPmTemplateToWorkOrderAsync(
        Guid workOrderId,
        Guid pmTemplateId,
        Guid tenantId,
        Guid? actorUserId = null,
        bool replaceExisting = false,
        CancellationToken cancellationToken = default)
    {
        var workOrder = await dbContext.WorkOrders
            .Include(x => x.ChecklistItems)
            .SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == workOrderId, cancellationToken)
            ?? throw new NotFoundException("Work order was not found.");

        var template = await GetActiveTemplateAsync(tenantId, pmTemplateId, cancellationToken);
        var existingItems = workOrder.ChecklistItems
            .Where(x => x.TenantId == tenantId)
            .ToList();

        if (existingItems.Count > 0 && !replaceExisting)
        {
            return existingItems.Count;
        }

        if (existingItems.Count > 0)
        {
            dbContext.WorkOrderChecklistItems.RemoveRange(existingItems);
        }

        var checklistItems = template.Questions
            .OrderBy(x => x.SectionName ?? string.Empty)
            .ThenBy(x => x.SortOrder)
            .ThenBy(x => x.CreatedAt)
            .Select(question => new WorkOrderChecklistItem
            {
                TenantId = tenantId,
                WorkOrderId = workOrderId,
                PmTemplateQuestionId = question.Id,
                SectionName = Normalize(question.SectionName),
                QuestionText = question.Prompt.Trim(),
                InputType = NormalizeInputType(question.ResponseType),
                IsRequired = question.IsRequired,
                SortOrder = question.SortOrder,
                ResponseValue = null,
                Remarks = null,
                IsCompleted = false,
                CompletedByUserId = null,
                CompletedAt = null,
                OptionsJson = Normalize(question.OptionsJson)
            })
            .ToList();

        dbContext.WorkOrderChecklistItems.AddRange(checklistItems);
        workOrder.PmTemplateId = template.Id;
        workOrder.IsPreventiveMaintenance = true;

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync(
            tenantId,
            actorUserId,
            "PM template attached to work order",
            nameof(WorkOrder),
            workOrderId.ToString(),
            $"Attached template '{template.Name}' with {checklistItems.Count} checklist items.",
            cancellationToken);

        return checklistItems.Count;
    }

    public async Task<WorkOrderChecklistItem> UpdateChecklistItemAsync(
        Guid workOrderId,
        Guid itemId,
        Guid tenantId,
        Guid actorUserId,
        string? responseValue,
        string? remarks,
        bool isCompleted,
        CancellationToken cancellationToken = default)
    {
        var checklistItem = await dbContext.WorkOrderChecklistItems
            .Include(x => x.WorkOrder)
            .SingleOrDefaultAsync(x => x.TenantId == tenantId && x.WorkOrderId == workOrderId && x.Id == itemId, cancellationToken)
            ?? throw new NotFoundException("Checklist item was not found.");

        checklistItem.ResponseValue = Normalize(responseValue);
        checklistItem.Remarks = Normalize(remarks);
        checklistItem.IsCompleted = isCompleted;
        checklistItem.CompletedByUserId = isCompleted ? actorUserId : null;
        checklistItem.CompletedAt = isCompleted ? DateTime.UtcNow : null;

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync(
            tenantId,
            actorUserId,
            "PM checklist item updated",
            nameof(WorkOrder),
            workOrderId.ToString(),
            $"Updated checklist item '{checklistItem.QuestionText}'.",
            cancellationToken);

        return checklistItem;
    }

    public async Task EnsureRequiredChecklistCompletedAsync(Guid workOrderId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        var requiredIncompleteExists = await dbContext.WorkOrderChecklistItems
            .AnyAsync(
                x => x.TenantId == tenantId
                    && x.WorkOrderId == workOrderId
                    && x.IsRequired
                    && !x.IsCompleted,
                cancellationToken);

        if (requiredIncompleteExists)
        {
            throw new BusinessRuleException("Complete all required PM checklist items before closing this work order.");
        }
    }

    private static string NormalizeInputType(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        if (normalized == "checkbox")
        {
            return "yesno";
        }

        if (AllowedInputTypes.Contains(normalized))
        {
            return normalized;
        }

        throw new BusinessRuleException("Unsupported PM checklist input type.");
    }

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
