using Ecosys.Domain.Entities;
using Ecosys.Infrastructure.Data;
using Ecosys.Shared.Errors;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace Ecosys.Infrastructure.Services;

public sealed record WorkOrderCommentRequest(string Message);
public sealed record WorkOrderLocationRequest(decimal? Latitude, decimal? Longitude);
public sealed record WorkOrderCompletionRequest(string WorkDoneNotes, string? ReportSummary = null, string? AnswersJson = null);

public interface IWorkOrderLifecycleService
{
    string NormalizeStatus(string status);
    Task RecordCreatedAsync(Guid tenantId, Guid workOrderId, Guid? actorUserId, string workOrderNumber, CancellationToken cancellationToken = default);
    Task<WorkOrder> AssignAsync(Guid tenantId, Guid workOrderId, Guid? actorUserId, Guid? technicianId, Guid? assignmentGroupId, CancellationToken cancellationToken = default);
    Task<WorkOrderEvent> AddCommentAsync(Guid tenantId, Guid workOrderId, Guid actorUserId, WorkOrderCommentRequest request, CancellationToken cancellationToken = default);
    Task<WorkOrder> StartAsync(Guid tenantId, Guid workOrderId, Guid actorUserId, CancellationToken cancellationToken = default);
    Task<WorkOrder> ArriveAsync(Guid tenantId, Guid workOrderId, Guid actorUserId, WorkOrderLocationRequest request, CancellationToken cancellationToken = default);
    Task<WorkOrder> DepartAsync(Guid tenantId, Guid workOrderId, Guid actorUserId, WorkOrderLocationRequest request, CancellationToken cancellationToken = default);
    Task<WorkOrder> ChangeStatusAsync(Guid tenantId, Guid workOrderId, Guid actorUserId, string status, string? message = null, CancellationToken cancellationToken = default);
    Task<WorkOrder> CompleteAsync(Guid tenantId, Guid workOrderId, Guid actorUserId, WorkOrderCompletionRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<WorkOrderEvent>> GetEventsAsync(Guid tenantId, Guid workOrderId, CancellationToken cancellationToken = default);
}

internal sealed class WorkOrderLifecycleService(
    AppDbContext dbContext,
    IAuditLogService auditLogService,
    IEmailOutboxService emailOutboxService,
    IEmailTemplateService emailTemplateService,
    IEmailSubjectRuleService emailSubjectRuleService,
    ISlaService slaService,
    ILogger<WorkOrderLifecycleService> logger) : IWorkOrderLifecycleService
{
    private static readonly Dictionary<string, string[]> AllowedTransitions = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Open"] = ["In Progress", "Paused", "Awaiting Parts", "Awaiting Client", "Completed", "Cancelled"],
        ["In Progress"] = ["Paused", "Awaiting Parts", "Awaiting Client", "Completed", "Cancelled"],
        ["Paused"] = ["In Progress", "Awaiting Parts", "Awaiting Client", "Completed", "Cancelled"],
        ["Awaiting Parts"] = ["In Progress", "Paused", "Awaiting Client", "Completed", "Cancelled"],
        ["Awaiting Client"] = ["In Progress", "Paused", "Awaiting Parts", "Completed", "Cancelled"],
        ["Completed"] = ["Closed"],
        ["Closed"] = [],
        ["Cancelled"] = []
    };

    public string NormalizeStatus(string status)
    {
        var normalized = status.Trim();
        return normalized switch
        {
            "Pending Materials" => "Awaiting Parts",
            "Awaiting User" => "Awaiting Client",
            "Acknowledged" => "Closed",
            "Assigned" => "Open",
            "Open" or "In Progress" or "Paused" or "Awaiting Parts" or "Awaiting Client" or "Completed" or "Closed" or "Cancelled" => normalized,
            _ => throw new BusinessRuleException("Invalid work order status.")
        };
    }

    public async Task RecordCreatedAsync(Guid tenantId, Guid workOrderId, Guid? actorUserId, string workOrderNumber, CancellationToken cancellationToken = default)
    {
        dbContext.WorkOrderEvents.Add(new WorkOrderEvent
        {
            TenantId = tenantId,
            WorkOrderId = workOrderId,
            ActorUserId = actorUserId,
            EventType = "Created",
            Status = "Open",
            Message = $"Work order {workOrderNumber} was created.",
            OccurredAt = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<WorkOrder> AssignAsync(Guid tenantId, Guid workOrderId, Guid? actorUserId, Guid? technicianId, Guid? assignmentGroupId, CancellationToken cancellationToken = default)
    {
        var workOrder = await LoadWorkOrderAsync(tenantId, workOrderId, cancellationToken);
        var currentStatus = NormalizeStatus(workOrder.Status);

        if (assignmentGroupId.HasValue)
        {
            var groupExists = await dbContext.AssignmentGroups.AnyAsync(x => x.TenantId == tenantId && x.IsActive && x.Id == assignmentGroupId.Value, cancellationToken);
            if (!groupExists)
            {
                throw new BusinessRuleException("Assignment group was not found for this tenant.");
            }
        }

        Technician? technician = null;
        if (technicianId.HasValue)
        {
            technician = await dbContext.Technicians.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.IsActive && x.Id == technicianId.Value, cancellationToken)
                ?? throw new BusinessRuleException("Technician was not found for this tenant.");

            if (assignmentGroupId.HasValue)
            {
                var membershipExists = await dbContext.AssignmentGroupMembers.AnyAsync(
                    x => x.TenantId == tenantId && x.AssignmentGroupId == assignmentGroupId.Value && x.TechnicianId == technicianId.Value,
                    cancellationToken);

                if (!membershipExists)
                {
                    throw new BusinessRuleException("Technician is not a member of the selected assignment group.");
                }
            }
        }

        workOrder.Status = currentStatus == "Open" ? "Open" : workOrder.Status;

        workOrder.AssignedTechnicianId = technicianId;
        workOrder.AssignmentGroupId = assignmentGroupId;
        await SaveEventAsync(tenantId, workOrder, actorUserId, "Assigned", "Assigned", technician is null
            ? "Work order assigned to group queue."
            : $"Work order assigned to {technician.FullName}.", cancellationToken: cancellationToken);

        return workOrder;
    }

    public async Task<WorkOrderEvent> AddCommentAsync(Guid tenantId, Guid workOrderId, Guid actorUserId, WorkOrderCommentRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            throw new BusinessRuleException("Comment message is required.");
        }

        var workOrder = await LoadWorkOrderAsync(tenantId, workOrderId, cancellationToken);
        var workOrderEvent = new WorkOrderEvent
        {
            TenantId = tenantId,
            WorkOrderId = workOrder.Id,
            ActorUserId = actorUserId,
            EventType = "Comment",
            Status = NormalizeStatus(workOrder.Status),
            Message = request.Message.Trim(),
            OccurredAt = DateTime.UtcNow
        };

        dbContext.WorkOrderEvents.Add(workOrderEvent);
        await dbContext.SaveChangesAsync(cancellationToken);
        return workOrderEvent;
    }

    public async Task<WorkOrder> StartAsync(Guid tenantId, Guid workOrderId, Guid actorUserId, CancellationToken cancellationToken = default)
    {
        var workOrder = await LoadWorkOrderAsync(tenantId, workOrderId, cancellationToken);
        await TransitionAsync(workOrder, actorUserId, "In Progress", "Work started.", cancellationToken);

        if (!workOrder.WorkStartedAt.HasValue)
        {
            workOrder.WorkStartedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return workOrder;
    }

    public async Task<WorkOrder> ArriveAsync(Guid tenantId, Guid workOrderId, Guid actorUserId, WorkOrderLocationRequest request, CancellationToken cancellationToken = default)
    {
        var workOrder = await LoadWorkOrderAsync(tenantId, workOrderId, cancellationToken);
        workOrder.ArrivalAt = DateTime.UtcNow;

        if (workOrder.AssignedTechnicianId.HasValue)
        {
            await UpdateTechnicianTrackingAsync(tenantId, workOrder.AssignedTechnicianId.Value, workOrder.Id, request, true, cancellationToken);
        }

        await SaveEventAsync(tenantId, workOrder, actorUserId, "Arrival", NormalizeStatus(workOrder.Status), "Technician marked arrival on site.", request.Latitude, request.Longitude, cancellationToken);
        return workOrder;
    }

    public async Task<WorkOrder> DepartAsync(Guid tenantId, Guid workOrderId, Guid actorUserId, WorkOrderLocationRequest request, CancellationToken cancellationToken = default)
    {
        var workOrder = await LoadWorkOrderAsync(tenantId, workOrderId, cancellationToken);
        workOrder.DepartureAt = DateTime.UtcNow;

        if (workOrder.AssignedTechnicianId.HasValue)
        {
            await UpdateTechnicianTrackingAsync(tenantId, workOrder.AssignedTechnicianId.Value, null, request, false, cancellationToken);
        }

        await SaveEventAsync(tenantId, workOrder, actorUserId, "Departure", NormalizeStatus(workOrder.Status), "Technician departed from site.", request.Latitude, request.Longitude, cancellationToken);
        return workOrder;
    }

    public async Task<WorkOrder> ChangeStatusAsync(Guid tenantId, Guid workOrderId, Guid actorUserId, string status, string? message = null, CancellationToken cancellationToken = default)
    {
        var workOrder = await LoadWorkOrderAsync(tenantId, workOrderId, cancellationToken);
        var normalizedStatus = NormalizeStatus(status);
        await TransitionAsync(workOrder, actorUserId, normalizedStatus, message, cancellationToken);
        return workOrder;
    }

    public async Task<WorkOrder> CompleteAsync(Guid tenantId, Guid workOrderId, Guid actorUserId, WorkOrderCompletionRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.WorkDoneNotes))
        {
            throw new BusinessRuleException("Work done notes are required.");
        }

        var workOrder = await LoadWorkOrderAsync(tenantId, workOrderId, cancellationToken);
        await TransitionAsync(workOrder, actorUserId, "Completed", "Work order completed.", cancellationToken);

        workOrder.WorkDoneNotes = request.WorkDoneNotes.Trim();
        workOrder.CompletedAt = DateTime.UtcNow;

        if (workOrder.IsPreventiveMaintenance)
        {
            var checklistSnapshot = await dbContext.WorkOrderChecklistItems
                .Where(x => x.TenantId == tenantId && x.WorkOrderId == workOrder.Id)
                .OrderBy(x => x.SectionName ?? string.Empty)
                .ThenBy(x => x.SortOrder)
                .Select(x => new
                {
                    x.Id,
                    x.SectionName,
                    x.QuestionText,
                    x.InputType,
                    x.IsRequired,
                    x.SortOrder,
                    x.ResponseValue,
                    x.Remarks,
                    x.IsCompleted,
                    x.CompletedAt
                })
                .ToListAsync(cancellationToken);

            var report = new PmReport
            {
                TenantId = tenantId,
                WorkOrderId = workOrder.Id,
                PmTemplateId = workOrder.PmTemplateId,
                Summary = string.IsNullOrWhiteSpace(request.ReportSummary) ? request.WorkDoneNotes.Trim() : request.ReportSummary.Trim(),
                AnswersJson = string.IsNullOrWhiteSpace(request.AnswersJson)
                    ? JsonSerializer.Serialize(checklistSnapshot)
                    : request.AnswersJson.Trim()
            };
            dbContext.PmReports.Add(report);

            await UpdatePmAssetAndPlanAsync(tenantId, workOrder, checklistSnapshot, cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await slaService.RefreshWorkOrderAsync(workOrder.Id, DateTime.UtcNow, cancellationToken);
        await TryQueueCompletionEmailAsync(tenantId, workOrder, cancellationToken);
        return workOrder;
    }

    private async Task UpdatePmAssetAndPlanAsync(
        Guid tenantId,
        WorkOrder workOrder,
        IReadOnlyCollection<dynamic> checklistSnapshot,
        CancellationToken cancellationToken)
    {
        if (!workOrder.CompletedAt.HasValue || !workOrder.AssetId.HasValue)
        {
            return;
        }

        var asset = await dbContext.Assets
            .SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == workOrder.AssetId.Value, cancellationToken);

        if (asset is null)
        {
            return;
        }

        asset.LastPmDate = workOrder.CompletedAt.Value;

        var meterReading = TryExtractMeterReading(checklistSnapshot);
        if (meterReading.HasValue)
        {
            asset.CurrentMeterReading = meterReading.Value;
        }

        if (!workOrder.PreventiveMaintenancePlanId.HasValue)
        {
            return;
        }

        var plan = await dbContext.PreventiveMaintenancePlans
            .SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == workOrder.PreventiveMaintenancePlanId.Value, cancellationToken);

        if (plan is null)
        {
            return;
        }

        plan.LastPmDate = workOrder.CompletedAt.Value;
        plan.LastGeneratedAt ??= workOrder.CreatedAt;
        plan.LastPmWorkOrderId = workOrder.Id;

        var intervalMonths = ResolvePmIntervalMonths(plan);
        if (!intervalMonths.HasValue)
        {
            return;
        }

        var nextSeed = plan.NextPmDate?.Date ?? workOrder.CompletedAt.Value.Date;
        plan.NextPmDate = nextSeed.AddMonths(intervalMonths.Value);
        asset.NextPmDate = plan.NextPmDate;
    }

    private async Task TryQueueCompletionEmailAsync(Guid tenantId, WorkOrder workOrder, CancellationToken cancellationToken)
    {
        try
        {
            var tenant = await dbContext.Tenants.SingleOrDefaultAsync(x => x.Id == tenantId, cancellationToken);
            var contactEmail = tenant?.ContactEmail ?? tenant?.Email;
            if (string.IsNullOrWhiteSpace(contactEmail))
                return;

            var technicianName = workOrder.AssignedTechnicianId.HasValue
                ? (await dbContext.Technicians.SingleOrDefaultAsync(x => x.Id == workOrder.AssignedTechnicianId.Value, cancellationToken))?.FullName
                : null;

            var assetName = workOrder.AssetId.HasValue
                ? (await dbContext.Assets.SingleOrDefaultAsync(x => x.Id == workOrder.AssetId.Value, cancellationToken))?.AssetName
                : null;

            var template = await emailTemplateService.RenderTenantTemplateAsync(
                tenantId,
                "work-order.completed",
                new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
                {
                    ["WorkOrderNumber"] = workOrder.WorkOrderNumber,
                    ["AssignedTo"] = technicianName ?? "Unassigned",
                    ["AssetName"] = assetName ?? "N/A"
                },
                cancellationToken);

            if (!template.Enabled)
                return;

            var subject = await emailSubjectRuleService.BuildFinalSubjectAsync(
                tenantId, "work-order.completed", template.Subject, tenant?.Name, cancellationToken);

            await emailOutboxService.QueueEmailAsync(
                new QueueEmailRequest(
                    tenantId,
                    "work-order.completed",
                    "work-order-completed",
                    contactEmail,
                    tenant?.Name,
                    template.SenderNameOverride,
                    null,
                    null,
                    subject,
                    template.HtmlBody,
                    template.TextBody,
                    null),
                cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to queue work-order.completed email for work order {WorkOrderId}.", workOrder.Id);
        }
    }

    private static int? ResolvePmIntervalMonths(PreventiveMaintenancePlan plan)
    {
        if (plan.FrequencyInterval > 0)
        {
            if (string.Equals(plan.FrequencyUnit, "Monthly", StringComparison.OrdinalIgnoreCase))
            {
                return plan.FrequencyInterval;
            }

            if (string.Equals(plan.FrequencyUnit, "Annual", StringComparison.OrdinalIgnoreCase))
            {
                return plan.FrequencyInterval * 12;
            }
        }

        return (plan.Frequency ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "monthly" => 1,
            "quarterly" => 3,
            "semi-annual" => 6,
            "semi annual" => 6,
            "semiannual" => 6,
            "annual" => 12,
            _ => null
        };
    }

    private static decimal? TryExtractMeterReading(IReadOnlyCollection<dynamic> checklistSnapshot)
    {
        foreach (var item in checklistSnapshot)
        {
            string questionText = item.QuestionText;
            string inputType = item.InputType;
            string? responseValue = item.ResponseValue;

            if (!string.Equals(inputType, "number", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var normalizedQuestion = questionText.Trim().ToLowerInvariant();
            if (!normalizedQuestion.Contains("meter")
                && !normalizedQuestion.Contains("reading")
                && !normalizedQuestion.Contains("runtime")
                && !normalizedQuestion.Contains("hours"))
            {
                continue;
            }

            if (decimal.TryParse(responseValue, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var parsed))
            {
                return parsed;
            }
        }

        return null;
    }

    public async Task<IReadOnlyCollection<WorkOrderEvent>> GetEventsAsync(Guid tenantId, Guid workOrderId, CancellationToken cancellationToken = default) =>
        await dbContext.WorkOrderEvents
            .Where(x => x.TenantId == tenantId && x.WorkOrderId == workOrderId)
            .OrderBy(x => x.OccurredAt)
            .ToListAsync(cancellationToken);

    private async Task TransitionAsync(WorkOrder workOrder, Guid actorUserId, string targetStatus, string? message, CancellationToken cancellationToken)
    {
        var currentStatus = NormalizeStatus(workOrder.Status);
        if (!string.Equals(currentStatus, targetStatus, StringComparison.OrdinalIgnoreCase))
        {
            if (!AllowedTransitions.TryGetValue(currentStatus, out var allowedStatuses) || !allowedStatuses.Contains(targetStatus, StringComparer.OrdinalIgnoreCase))
            {
                throw new BusinessRuleException($"Invalid work order transition from {currentStatus} to {targetStatus}.");
            }
        }

        workOrder.Status = targetStatus;
        if (targetStatus == "Closed" && !workOrder.CompletedAt.HasValue)
        {
            workOrder.CompletedAt = DateTime.UtcNow;
        }

        await SaveEventAsync(workOrder.TenantId, workOrder, actorUserId, "StatusChanged", targetStatus, message ?? $"Status changed to {targetStatus}.", cancellationToken: cancellationToken);
    }

    private async Task SaveEventAsync(
        Guid tenantId,
        WorkOrder workOrder,
        Guid? actorUserId,
        string eventType,
        string status,
        string message,
        decimal? latitude = null,
        decimal? longitude = null,
        CancellationToken cancellationToken = default)
    {
        dbContext.WorkOrderEvents.Add(new WorkOrderEvent
        {
            TenantId = tenantId,
            WorkOrderId = workOrder.Id,
            ActorUserId = actorUserId,
            EventType = eventType,
            Status = status,
            Message = message,
            Latitude = latitude,
            Longitude = longitude,
            OccurredAt = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync(
            tenantId,
            actorUserId,
            $"Work order {eventType.ToLowerInvariant()}",
            nameof(WorkOrder),
            workOrder.Id.ToString(),
            message,
            cancellationToken);
    }

    private async Task<WorkOrder> LoadWorkOrderAsync(Guid tenantId, Guid workOrderId, CancellationToken cancellationToken) =>
        await dbContext.WorkOrders.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == workOrderId, cancellationToken)
            ?? throw new NotFoundException("Work order was not found.");

    private async Task UpdateTechnicianTrackingAsync(
        Guid tenantId,
        Guid technicianId,
        Guid? activeWorkOrderId,
        WorkOrderLocationRequest request,
        bool isTrackingActive,
        CancellationToken cancellationToken)
    {
        var technician = await dbContext.Technicians.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == technicianId, cancellationToken);
        if (technician is null)
        {
            return;
        }

        technician.IsTrackingActive = isTrackingActive;
        technician.ActiveWorkOrderId = activeWorkOrderId;
        technician.LastLocationAt = DateTime.UtcNow;
        technician.LastKnownLatitude = request.Latitude;
        technician.LastKnownLongitude = request.Longitude;

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
