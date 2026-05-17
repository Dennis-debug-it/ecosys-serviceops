using System.Text.Json;
using Ecosys.Domain.Entities;
using Ecosys.Infrastructure.Data;
using Ecosys.Infrastructure.Services;
using Ecosys.Shared.Auth;
using Ecosys.Shared.Errors;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ecosys.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/workorders")]
public sealed class WorkOrdersController(
    AppDbContext dbContext,
    ITenantContext tenantContext,
    IDocumentNumberingService documentNumberingService,
    IAuditLogService auditLogService,
    IUserAccessService userAccessService,
    IBranchAccessService branchAccessService,
    ILicenseGuardService licenseGuardService,
    IWorkOrderLifecycleService workOrderLifecycleService,
    IWorkOrderAssignmentWorkflowService assignmentWorkflowService,
    IPmWorkOrderChecklistService pmWorkOrderChecklistService,
    ISlaService slaService) : TenantAwareControllerBase(tenantContext)
{
    private static readonly HashSet<string> EditableStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "Open",
        "In Progress",
        "Paused",
        "Awaiting Parts",
        "Awaiting Client",
        "Cancelled"
    };

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<WorkOrderResponse>>> GetAll(
        [FromQuery] Guid? branchId,
        [FromQuery] string? status,
        [FromQuery] Guid? assignmentGroupId,
        [FromQuery] Guid? technicianId,
        [FromQuery] bool? unassigned,
        [FromQuery] string? assignmentStatus,
        [FromQuery] string? search,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        CancellationToken cancellationToken)
    {
        userAccessService.EnsureAdminOrPermission(PermissionNames.CanViewWorkOrders);
        var scope = await branchAccessService.GetQueryScopeAsync(TenantId, branchId, cancellationToken);

        var workOrders = await QueryWorkOrders(scope)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);

        var filtered = workOrders
            .Where(x => string.IsNullOrWhiteSpace(status) || string.Equals(workOrderLifecycleService.NormalizeStatus(x.Status), workOrderLifecycleService.NormalizeStatus(status), StringComparison.OrdinalIgnoreCase))
            .Where(x => !assignmentGroupId.HasValue || x.AssignmentGroupId == assignmentGroupId)
            .Where(x => !technicianId.HasValue || x.TechnicianAssignments.Any(assignment => assignment.TechnicianId == technicianId))
            .Where(x => !unassigned.HasValue || (unassigned.Value
                ? x.AssignmentGroupId is null && !x.TechnicianAssignments.Any()
                : x.AssignmentGroupId is not null || x.TechnicianAssignments.Any()))
            .Where(x => string.IsNullOrWhiteSpace(assignmentStatus) || string.Equals(GetAssignmentStatus(x), assignmentStatus, StringComparison.OrdinalIgnoreCase))
            .Where(x => string.IsNullOrWhiteSpace(search) || $"{x.WorkOrderNumber} {x.Title} {x.Client?.ClientName} {x.Asset?.AssetName} {BuildAssignmentSummary(x)}".Contains(search, StringComparison.OrdinalIgnoreCase))
            .Where(x => !fromDate.HasValue || x.CreatedAt >= fromDate.Value)
            .Where(x => !toDate.HasValue || x.CreatedAt <= toDate.Value)
            .Select(Map)
            .ToList();

        return Ok(filtered);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<WorkOrderResponse>> Get(Guid id, CancellationToken cancellationToken)
    {
        userAccessService.EnsureAdminOrPermission(PermissionNames.CanViewWorkOrders);
        var scope = await branchAccessService.GetQueryScopeAsync(TenantId, null, cancellationToken);

        var workOrder = await QueryWorkOrders(scope)
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new NotFoundException("Work order was not found.");

        return Ok(Map(workOrder));
    }

    [HttpGet("{id:guid}/checklist")]
    public async Task<ActionResult<IReadOnlyCollection<WorkOrderChecklistItemResponse>>> GetChecklist(Guid id, CancellationToken cancellationToken)
    {
        userAccessService.EnsureAdminOrPermission(PermissionNames.CanViewWorkOrders);
        var scope = await branchAccessService.GetQueryScopeAsync(TenantId, null, cancellationToken);

        var workOrder = await QueryWorkOrders(scope)
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new NotFoundException("Work order was not found.");

        return Ok(Map(workOrder).ChecklistItems ?? []);
    }

    [HttpPost("{id:guid}/attach-pm-template")]
    public async Task<ActionResult<WorkOrderResponse>> AttachPmTemplate(Guid id, [FromBody] AttachPmTemplateRequest request, CancellationToken cancellationToken)
    {
        userAccessService.EnsureAdminOrPermission(PermissionNames.CanCreateWorkOrders);

        if (!request.PmTemplateId.HasValue)
        {
            throw new BusinessRuleException("PM template is required.");
        }

        var scope = await branchAccessService.GetQueryScopeAsync(TenantId, null, cancellationToken);
        var workOrder = await dbContext.WorkOrders
            .Where(x => x.TenantId == TenantId && x.Id == id)
            .WhereAccessible(scope, x => x.BranchId)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Work order was not found.");

        if (!workOrder.IsPreventiveMaintenance)
        {
            throw new BusinessRuleException("Checklist is available for preventive maintenance work orders.");
        }

        await pmWorkOrderChecklistService.AttachPmTemplateToWorkOrderAsync(id, request.PmTemplateId.Value, TenantId, UserId, cancellationToken: cancellationToken);

        var persisted = await QueryWorkOrders(await branchAccessService.GetQueryScopeAsync(TenantId, workOrder.BranchId, cancellationToken))
            .SingleAsync(x => x.Id == id, cancellationToken);
        return Ok(Map(persisted));
    }

    [HttpPut("{workOrderId:guid}/checklist/{itemId:guid}")]
    public async Task<ActionResult<WorkOrderChecklistItemResponse>> UpdateChecklistItem(
        Guid workOrderId,
        Guid itemId,
        [FromBody] UpdateWorkOrderChecklistItemRequest request,
        CancellationToken cancellationToken)
    {
        userAccessService.EnsureTenantOperationalAccess();
        var scope = await branchAccessService.GetQueryScopeAsync(TenantId, null, cancellationToken);
        var workOrderExists = await dbContext.WorkOrders
            .Where(x => x.TenantId == TenantId && x.Id == workOrderId)
            .WhereAccessible(scope, x => x.BranchId)
            .AnyAsync(cancellationToken);

        if (!workOrderExists)
        {
            throw new NotFoundException("Work order was not found.");
        }

        var item = await pmWorkOrderChecklistService.UpdateChecklistItemAsync(
            workOrderId,
            itemId,
            TenantId,
            UserId,
            request.ResponseValue,
            request.Remarks,
            request.IsCompleted,
            cancellationToken);

        return Ok(new WorkOrderChecklistItemResponse(
            item.Id,
            item.PmTemplateQuestionId,
            item.SectionName,
            item.QuestionText,
            item.InputType,
            item.IsRequired,
            item.SortOrder,
            item.ResponseValue,
            item.Remarks,
            item.IsCompleted,
            item.CompletedByUserId,
            item.CompletedAt,
            ParseOptions(item.OptionsJson)));
    }

    [HttpPost]
    public async Task<ActionResult<WorkOrderResponse>> Create([FromBody] CreateWorkOrderRequest request, CancellationToken cancellationToken)
    {
        userAccessService.EnsureAdminOrPermission(PermissionNames.CanCreateWorkOrders);
        await licenseGuardService.EnsureCanCreateWorkOrderAsync(TenantId, cancellationToken);
        ValidateCreate(request);
        await EnsureClientExistsAsync(request.ClientId, cancellationToken);
        var asset = await EnsureAssetExistsAsync(request.AssetId, request.ClientId, cancellationToken);
        await EnsurePmTemplateIsValidAsync(request.IsPreventiveMaintenance, request.PmTemplateId, cancellationToken);

        var branchId = await ResolveWorkOrderBranchIdAsync(request.BranchId, asset?.BranchId, cancellationToken);

        var normalizedAssignmentType = NormalizeAssignmentType(request.AssignmentType, request.AssignmentGroupId, request.AssignedTechnicianId, request.AssignedTechnicianIds);
        string? siteAccessNotes = null;
        if (request.SiteId.HasValue)
        {
            siteAccessNotes = await dbContext.Sites
                .Where(x => x.TenantId == TenantId && x.Id == request.SiteId.Value)
                .Select(x => x.AccessNotes)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var workOrder = new WorkOrder
        {
            TenantId = TenantId,
            BranchId = branchId,
            ClientId = request.ClientId,
            SiteId = request.SiteId,
            AssetId = request.AssetId,
            AssignmentGroupId = normalizedAssignmentType == AssignmentTypes.AssignmentGroup ? request.AssignmentGroupId : null,
            AssignmentType = normalizedAssignmentType,
            WorkOrderNumber = await documentNumberingService.GenerateAsync(TenantId, branchId, DocumentTypes.WorkOrder, cancellationToken),
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            Priority = NormalizePriority(request.Priority),
            Status = "Open",
            DueDate = request.DueDate,
            AssignedTechnicianId = ResolvePrimaryTechnicianId(request),
            LeadTechnicianId = request.LeadTechnicianId,
            AssignedTechnicianIdsJson = SerializeAssignedTechnicianIds(request.AssignedTechnicianIds),
            IsPreventiveMaintenance = request.IsPreventiveMaintenance,
            PmTemplateId = request.PmTemplateId,
            JobCardNotes = !string.IsNullOrWhiteSpace(siteAccessNotes) ? siteAccessNotes : null
        };

        await slaService.ApplyDefinitionAsync(workOrder, cancellationToken);

        dbContext.WorkOrders.Add(workOrder);
        await dbContext.SaveChangesAsync(cancellationToken);

        if (request.IsPreventiveMaintenance && request.PmTemplateId.HasValue)
        {
            await pmWorkOrderChecklistService.AttachPmTemplateToWorkOrderAsync(workOrder.Id, request.PmTemplateId.Value, TenantId, UserId, cancellationToken: cancellationToken);
        }

        await workOrderLifecycleService.RecordCreatedAsync(TenantId, workOrder.Id, UserId, workOrder.WorkOrderNumber, cancellationToken);

        var initialTechnicianIds = ResolveTechnicianIds(request.AssignedTechnicianId, request.AssignedTechnicianIds, normalizedAssignmentType);
        if (workOrder.AssignedTechnicianId.HasValue || workOrder.AssignmentGroupId.HasValue || initialTechnicianIds.Count > 0)
        {
            await assignmentWorkflowService.ApplyAssignmentsAsync(
                TenantId,
                workOrder.Id,
                UserId,
                new WorkOrderAssignmentUpdateRequest(workOrder.AssignmentGroupId, initialTechnicianIds, request.LeadTechnicianId, request.AssignmentNotes),
                false,
                cancellationToken);
        }

        await auditLogService.LogAsync(
            TenantId,
            UserId,
            "Work order created",
            nameof(WorkOrder),
            workOrder.Id.ToString(),
            $"Created work order '{workOrder.WorkOrderNumber}'.",
            cancellationToken);

        var scope = await branchAccessService.GetQueryScopeAsync(TenantId, workOrder.BranchId, cancellationToken);
        var persisted = await QueryWorkOrders(scope).SingleAsync(x => x.Id == workOrder.Id, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = workOrder.Id }, Map(persisted));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<WorkOrderResponse>> Update(Guid id, [FromBody] UpdateWorkOrderRequest request, CancellationToken cancellationToken)
    {
        userAccessService.EnsureAdminOrPermission(PermissionNames.CanCreateWorkOrders);

        var scope = await branchAccessService.GetQueryScopeAsync(TenantId, null, cancellationToken);
        var workOrder = await dbContext.WorkOrders
            .Where(x => x.TenantId == TenantId && x.Id == id)
            .WhereAccessible(scope, x => x.BranchId)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Work order was not found.");

        ValidateCreate(new CreateWorkOrderRequest(request.ClientId, request.BranchId, request.SiteId, request.AssetId, request.AssignmentGroupId, request.AssignmentType, request.AssignedTechnicianId, request.AssignedTechnicianIds, request.LeadTechnicianId, request.AssignmentNotes, request.Title, request.Description, request.Priority, request.DueDate, workOrder.IsPreventiveMaintenance, request.PmTemplateId));
        await EnsureClientExistsAsync(request.ClientId, cancellationToken);
        var asset = await EnsureAssetExistsAsync(request.AssetId, request.ClientId, cancellationToken);
        await EnsurePmTemplateIsValidAsync(workOrder.IsPreventiveMaintenance, request.PmTemplateId, cancellationToken);
        var branchId = await ResolveWorkOrderBranchIdAsync(request.BranchId ?? workOrder.BranchId, asset?.BranchId, cancellationToken);

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            var normalizedStatus = NormalizeStatus(request.Status);
            if (!EditableStatuses.Contains(normalizedStatus))
            {
                throw new BusinessRuleException("Use the dedicated complete or acknowledge endpoints for those status changes.");
            }
            await workOrderLifecycleService.ChangeStatusAsync(TenantId, workOrder.Id, UserId, normalizedStatus, $"Status changed to {normalizedStatus}.", cancellationToken);
        }

        workOrder.BranchId = branchId;
        workOrder.ClientId = request.ClientId;
        workOrder.SiteId = request.SiteId;
        workOrder.AssetId = request.AssetId;
        var normalizedUpdateAssignmentType = NormalizeAssignmentType(request.AssignmentType, request.AssignmentGroupId, request.AssignedTechnicianId, request.AssignedTechnicianIds);
        workOrder.AssignmentType = normalizedUpdateAssignmentType;
        workOrder.AssignmentGroupId = workOrder.AssignmentType == AssignmentTypes.AssignmentGroup ? request.AssignmentGroupId : null;
        workOrder.AssignedTechnicianId = ResolvePrimaryTechnicianId(request);
        workOrder.LeadTechnicianId = request.LeadTechnicianId;
        workOrder.AssignedTechnicianIdsJson = SerializeAssignedTechnicianIds(request.AssignedTechnicianIds);
        workOrder.Title = request.Title.Trim();
        workOrder.Description = request.Description?.Trim();
        workOrder.Priority = NormalizePriority(request.Priority);
        workOrder.DueDate = request.DueDate;
        workOrder.PmTemplateId = workOrder.IsPreventiveMaintenance ? request.PmTemplateId : null;
        await slaService.ApplyDefinitionAsync(workOrder, cancellationToken);

        await assignmentWorkflowService.ApplyAssignmentsAsync(
            TenantId,
            workOrder.Id,
            UserId,
            new WorkOrderAssignmentUpdateRequest(
                workOrder.AssignmentType == AssignmentTypes.AssignmentGroup ? request.AssignmentGroupId : request.AssignmentGroupId,
                ResolveTechnicianIds(request.AssignedTechnicianId, request.AssignedTechnicianIds, normalizedUpdateAssignmentType),
                request.LeadTechnicianId,
                request.AssignmentNotes),
            true,
            cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        var persisted = await QueryWorkOrders(await branchAccessService.GetQueryScopeAsync(TenantId, workOrder.BranchId, cancellationToken))
            .SingleAsync(x => x.Id == workOrder.Id, cancellationToken);
        return Ok(Map(persisted));
    }

    [HttpPost("{id:guid}/assign")]
    public async Task<ActionResult<WorkOrderResponse>> Assign(Guid id, [FromBody] AssignWorkOrderRequest request, CancellationToken cancellationToken)
    {
        userAccessService.EnsureAdminOrPermission(PermissionNames.CanAssignWorkOrders);
        var scope = await branchAccessService.GetQueryScopeAsync(TenantId, null, cancellationToken);

        var workOrder = await dbContext.WorkOrders
            .Where(x => x.TenantId == TenantId && x.Id == id)
            .WhereAccessible(scope, x => x.BranchId)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Work order was not found.");

        await assignmentWorkflowService.ApplyAssignmentsAsync(
            TenantId,
            workOrder.Id,
            UserId,
            new WorkOrderAssignmentUpdateRequest(
                request.AssignmentGroupId,
                request.TechnicianId.HasValue ? [request.TechnicianId.Value] : [],
                request.TechnicianId,
                request.Notes),
            true,
            cancellationToken);

        await auditLogService.LogAsync(
            TenantId,
            UserId,
            "Work order assigned",
            nameof(WorkOrder),
            workOrder.Id.ToString(),
            $"Assigned work order '{workOrder.WorkOrderNumber}'.",
            cancellationToken);

        var persisted = await QueryWorkOrders(await branchAccessService.GetQueryScopeAsync(TenantId, workOrder.BranchId, cancellationToken))
            .SingleAsync(x => x.Id == workOrder.Id, cancellationToken);
        return Ok(Map(persisted));
    }

    [HttpPost("{id:guid}/start")]
    public async Task<ActionResult<WorkOrderResponse>> Start(Guid id, CancellationToken cancellationToken)
    {
        userAccessService.EnsureAdminOrPermission(PermissionNames.CanCompleteWorkOrders);
        var scope = await branchAccessService.GetQueryScopeAsync(TenantId, null, cancellationToken);
        var workOrder = await dbContext.WorkOrders
            .Where(x => x.TenantId == TenantId && x.Id == id)
            .WhereAccessible(scope, x => x.BranchId)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Work order was not found.");

        if (!await assignmentWorkflowService.HasAcceptedTechnicianAsync(TenantId, workOrder.Id, cancellationToken))
        {
            throw new BusinessRuleException("Work order cannot be moved to In Progress before at least one technician accepts.");
        }

        await workOrderLifecycleService.StartAsync(TenantId, workOrder.Id, UserId, cancellationToken);
        var persisted = await QueryWorkOrders(await branchAccessService.GetQueryScopeAsync(TenantId, workOrder.BranchId, cancellationToken))
            .SingleAsync(x => x.Id == workOrder.Id, cancellationToken);
        return Ok(Map(persisted));
    }

    [HttpPost("{id:guid}/arrive")]
    public async Task<ActionResult<WorkOrderResponse>> Arrive(Guid id, [FromBody] WorkOrderLocationRequest request, CancellationToken cancellationToken)
    {
        userAccessService.EnsureTenantOperationalAccess();
        var workOrder = await dbContext.WorkOrders.SingleOrDefaultAsync(x => x.TenantId == TenantId && x.Id == id, cancellationToken)
            ?? throw new NotFoundException("Work order was not found.");

        await workOrderLifecycleService.ArriveAsync(TenantId, workOrder.Id, UserId, new Infrastructure.Services.WorkOrderLocationRequest(request.Latitude, request.Longitude), cancellationToken);
        var persisted = await QueryWorkOrders(await branchAccessService.GetQueryScopeAsync(TenantId, workOrder.BranchId, cancellationToken))
            .SingleAsync(x => x.Id == workOrder.Id, cancellationToken);
        return Ok(Map(persisted));
    }

    [HttpPost("{id:guid}/depart")]
    public async Task<ActionResult<WorkOrderResponse>> Depart(Guid id, [FromBody] WorkOrderLocationRequest request, CancellationToken cancellationToken)
    {
        userAccessService.EnsureTenantOperationalAccess();
        var workOrder = await dbContext.WorkOrders.SingleOrDefaultAsync(x => x.TenantId == TenantId && x.Id == id, cancellationToken)
            ?? throw new NotFoundException("Work order was not found.");

        await workOrderLifecycleService.DepartAsync(TenantId, workOrder.Id, UserId, new Infrastructure.Services.WorkOrderLocationRequest(request.Latitude, request.Longitude), cancellationToken);
        var persisted = await QueryWorkOrders(await branchAccessService.GetQueryScopeAsync(TenantId, workOrder.BranchId, cancellationToken))
            .SingleAsync(x => x.Id == workOrder.Id, cancellationToken);
        return Ok(Map(persisted));
    }

    [HttpGet("{id:guid}/events")]
    public async Task<ActionResult<IReadOnlyCollection<WorkOrderEventResponse>>> GetEvents(Guid id, CancellationToken cancellationToken)
    {
        userAccessService.EnsureTenantOperationalAccess();
        var workOrderExists = await dbContext.WorkOrders.AnyAsync(x => x.TenantId == TenantId && x.Id == id, cancellationToken);
        if (!workOrderExists)
        {
            throw new NotFoundException("Work order was not found.");
        }

        var events = await workOrderLifecycleService.GetEventsAsync(TenantId, id, cancellationToken);
        return Ok(events.Select(x => new WorkOrderEventResponse(x.Id, x.EventType, x.Status, x.Message, x.ActorUserId, x.Latitude, x.Longitude, x.OccurredAt)).ToList());
    }

    [HttpPost("{id:guid}/comments")]
    public async Task<ActionResult<WorkOrderEventResponse>> AddComment(Guid id, [FromBody] AddWorkOrderCommentRequest request, CancellationToken cancellationToken)
    {
        userAccessService.EnsureTenantOperationalAccess();
        var workOrderEvent = await workOrderLifecycleService.AddCommentAsync(TenantId, id, UserId, new Infrastructure.Services.WorkOrderCommentRequest(request.Message), cancellationToken);
        return Ok(new WorkOrderEventResponse(workOrderEvent.Id, workOrderEvent.EventType, workOrderEvent.Status, workOrderEvent.Message, workOrderEvent.ActorUserId, workOrderEvent.Latitude, workOrderEvent.Longitude, workOrderEvent.OccurredAt));
    }

    [HttpPost("{id:guid}/complete")]
    public async Task<ActionResult<WorkOrderResponse>> Complete(Guid id, [FromBody] CompleteWorkOrderRequest request, CancellationToken cancellationToken)
    {
        userAccessService.EnsureAdminOrPermission(PermissionNames.CanCompleteWorkOrders);

        if (string.IsNullOrWhiteSpace(request.WorkDoneNotes))
        {
            throw new BusinessRuleException("Work done notes are required.");
        }

        var scope = await branchAccessService.GetQueryScopeAsync(TenantId, null, cancellationToken);
        var workOrder = await dbContext.WorkOrders
            .Where(x => x.TenantId == TenantId && x.Id == id)
            .WhereAccessible(scope, x => x.BranchId)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Work order was not found.");

        if (request.TechnicianId.HasValue || request.AssignmentGroupId.HasValue)
        {
            await assignmentWorkflowService.ApplyAssignmentsAsync(
                TenantId,
                workOrder.Id,
                UserId,
                new WorkOrderAssignmentUpdateRequest(
                    request.AssignmentGroupId,
                    request.TechnicianId.HasValue ? [request.TechnicianId.Value] : [],
                    request.TechnicianId,
                    request.OverrideReason),
                true,
                cancellationToken);
        }

        if (!await assignmentWorkflowService.HasArrivalAsync(TenantId, workOrder.Id, cancellationToken))
        {
            if (!request.AdminOverride)
            {
                throw new BusinessRuleException("Completion cannot happen before arrival unless admin override is used.");
            }

            if (!IsAdmin)
            {
                throw new BusinessRuleException("Only admins can use completion override.");
            }

            if (string.IsNullOrWhiteSpace(request.OverrideReason))
            {
                throw new BusinessRuleException("Provide an override reason before completing without arrival.");
            }
        }

        if (workOrder.IsPreventiveMaintenance)
        {
            await pmWorkOrderChecklistService.EnsureRequiredChecklistCompletedAsync(workOrder.Id, TenantId, cancellationToken);
        }

        var signatureTypes = await dbContext.WorkOrderSignatures
            .Where(x => x.TenantId == TenantId && x.WorkOrderId == workOrder.Id)
            .Select(x => x.SignatureType)
            .ToListAsync(cancellationToken);

        if (!signatureTypes.Contains("Technician", StringComparer.OrdinalIgnoreCase))
        {
            throw new BusinessRuleException("Capture the technician signature before completing the work order.");
        }

        if (!signatureTypes.Contains("Client", StringComparer.OrdinalIgnoreCase))
        {
            throw new BusinessRuleException("Capture the client signature before completing the work order.");
        }

        await workOrderLifecycleService.CompleteAsync(
            TenantId,
            workOrder.Id,
            UserId,
            new Infrastructure.Services.WorkOrderCompletionRequest(request.WorkDoneNotes, request.ReportSummary, request.AnswersJson),
            cancellationToken);

        await auditLogService.LogAsync(
            TenantId,
            UserId,
            "Work order completed",
            nameof(WorkOrder),
            workOrder.Id.ToString(),
            $"Completed work order '{workOrder.WorkOrderNumber}'.",
            cancellationToken);

        var persisted = await QueryWorkOrders(await branchAccessService.GetQueryScopeAsync(TenantId, workOrder.BranchId, cancellationToken))
            .SingleAsync(x => x.Id == workOrder.Id, cancellationToken);
        return Ok(Map(persisted));
    }

    [HttpPost("{id:guid}/acknowledge")]
    public async Task<ActionResult<WorkOrderResponse>> Acknowledge(Guid id, [FromBody] AcknowledgeWorkOrderRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.AcknowledgedByName))
        {
            throw new BusinessRuleException("Acknowledged by name is required.");
        }

        var scope = await branchAccessService.GetQueryScopeAsync(TenantId, null, cancellationToken);
        var workOrder = await dbContext.WorkOrders
            .Where(x => x.TenantId == TenantId && x.Id == id)
            .WhereAccessible(scope, x => x.BranchId)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Work order was not found.");

        if (!string.Equals(workOrder.Status, "Completed", StringComparison.OrdinalIgnoreCase))
        {
            throw new BusinessRuleException("Only completed work orders can be acknowledged.");
        }

        workOrder.AcknowledgedByName = request.AcknowledgedByName.Trim();
        workOrder.AcknowledgementComments = request.Comments?.Trim();
        workOrder.AcknowledgementDate = request.AcknowledgementDate ?? DateTime.UtcNow;
        await workOrderLifecycleService.ChangeStatusAsync(TenantId, workOrder.Id, UserId, "Closed", $"Closed by {workOrder.AcknowledgedByName}.", cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(
            TenantId,
            UserId,
            "Work order acknowledged",
            nameof(WorkOrder),
            workOrder.Id.ToString(),
            $"Acknowledged work order '{workOrder.WorkOrderNumber}' by '{workOrder.AcknowledgedByName}'.",
            cancellationToken);

        var persisted = await QueryWorkOrders(await branchAccessService.GetQueryScopeAsync(TenantId, workOrder.BranchId, cancellationToken))
            .SingleAsync(x => x.Id == workOrder.Id, cancellationToken);
        return Ok(Map(persisted));
    }

    [HttpGet("{id:guid}/job-card")]
    public async Task<IActionResult> GetJobCard(Guid id, CancellationToken cancellationToken)
    {
        userAccessService.EnsureAdminOrPermission(PermissionNames.CanViewWorkOrders);
        var scope = await branchAccessService.GetQueryScopeAsync(TenantId, null, cancellationToken);

        var wo = await QueryWorkOrders(scope)
            .Include(x => x.Site)
            .Include(x => x.ChecklistItems)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new NotFoundException("Work order was not found.");

        var tenantSetting = await dbContext.EmailSettings
            .Where(x => x.TenantId == TenantId)
            .Select(x => new { x.SenderName })
            .FirstOrDefaultAsync(cancellationToken);

        return Ok(new
        {
            wo.Id,
            wo.WorkOrderNumber,
            wo.Title,
            wo.Description,
            wo.Priority,
            wo.Status,
            wo.ServiceType,
            wo.DueDate,
            wo.JobCardNotes,
            wo.IsPreventiveMaintenance,
            wo.ArrivalAt,
            wo.DepartureAt,
            Client = new { wo.Client?.ClientName, wo.Client?.ContactPerson, wo.Client?.Phone },
            Site = wo.Site == null ? null : new
            {
                wo.Site.SiteName,
                wo.Site.SiteCode,
                wo.Site.StreetAddress,
                wo.Site.TownCity,
                wo.Site.County,
                wo.Site.ContactPerson,
                wo.Site.ContactPhone,
                wo.Site.AccessNotes,
                wo.Site.OperatingHours
            },
            Asset = wo.Asset == null ? null : new
            {
                wo.Asset.AssetName,
                wo.Asset.AssetCode,
                wo.Asset.AssetType,
                wo.Asset.SerialNumber,
                wo.Asset.Manufacturer,
                wo.Asset.Model,
                wo.Asset.Location
            },
            AssignedTechnician = wo.AssignedTechnician == null ? null : new
            {
                wo.AssignedTechnician.FullName,
                wo.AssignedTechnician.Phone,
                wo.AssignedTechnician.Email
            },
            Checklist = wo.ChecklistItems
                .OrderBy(x => x.SortOrder)
                .Select(c => new
                {
                    c.SectionName,
                    c.QuestionText,
                    c.InputType,
                    c.IsRequired,
                    c.ResponseValue,
                    c.IsCompleted
                }),
            CompanyName = tenantSetting?.SenderName
        });
    }

    private IQueryable<WorkOrder> QueryWorkOrders(BranchQueryScope scope) =>
        dbContext.WorkOrders
            .Include(x => x.Client)
            .Include(x => x.Asset)
            .Include(x => x.Site)
            .Include(x => x.AssignedTechnician)
            .Include(x => x.LeadTechnician)
            .Include(x => x.AssignmentGroup)
            .Include(x => x.Branch)
            .Include(x => x.Assignments)
            .ThenInclude(x => x.AssignmentGroup)
            .Include(x => x.TechnicianAssignments)
            .ThenInclude(x => x.Technician)
            .Include(x => x.PmTemplate)
            .Include(x => x.ChecklistItems)
            .Where(x => x.TenantId == TenantId)
            .WhereAccessible(scope, x => x.BranchId);

    private static void ValidateCreate(CreateWorkOrderRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            throw new BusinessRuleException("Title is required.");
        }

        var assignmentType = NormalizeAssignmentType(request.AssignmentType, request.AssignmentGroupId, request.AssignedTechnicianId, request.AssignedTechnicianIds);
        var assignedTechnicianIds = NormalizeAssignedTechnicianIds(request.AssignedTechnicianIds);

        if (assignmentType == AssignmentTypes.IndividualTechnician && !request.AssignedTechnicianId.HasValue && assignedTechnicianIds.Count == 0)
        {
            throw new BusinessRuleException("Select a technician for an individual assignment.");
        }

        if (assignmentType == AssignmentTypes.MultipleTechnicians && assignedTechnicianIds.Count < 2)
        {
            throw new BusinessRuleException("Select at least two technicians for a multiple-technician assignment.");
        }

        if (assignmentType == AssignmentTypes.AssignmentGroup && !request.AssignmentGroupId.HasValue)
        {
            throw new BusinessRuleException("Select an assignment group before saving.");
        }

        if (request.LeadTechnicianId.HasValue && assignmentType == AssignmentTypes.MultipleTechnicians && !assignedTechnicianIds.Contains(request.LeadTechnicianId.Value))
        {
            throw new BusinessRuleException("Lead technician must belong to the selected technicians.");
        }

        if (request.IsPreventiveMaintenance && !request.PmTemplateId.HasValue)
        {
            throw new BusinessRuleException("Select a PM template before saving a preventive maintenance work order.");
        }

        if (!request.IsPreventiveMaintenance && request.PmTemplateId.HasValue)
        {
            throw new BusinessRuleException("PM templates can only be attached to preventive maintenance work orders.");
        }
    }

    private async Task EnsureClientExistsAsync(Guid clientId, CancellationToken cancellationToken)
    {
        var exists = await dbContext.Clients.AnyAsync(x => x.TenantId == TenantId && x.IsActive && x.Id == clientId, cancellationToken);
        if (!exists)
        {
            throw new BusinessRuleException("Client was not found for this tenant.");
        }
    }

    private async Task<Asset?> EnsureAssetExistsAsync(Guid? assetId, Guid clientId, CancellationToken cancellationToken)
    {
        if (!assetId.HasValue)
        {
            return null;
        }

        var asset = await dbContext.Assets.SingleOrDefaultAsync(
            x => x.TenantId == TenantId
                && x.Status != "Inactive"
                && x.Id == assetId.Value
                && x.ClientId == clientId,
            cancellationToken);

        if (asset is null)
        {
            throw new BusinessRuleException("Asset was not found for this tenant and client.");
        }

        return asset;
    }

    private async Task<Guid?> ResolveWorkOrderBranchIdAsync(Guid? requestedBranchId, Guid? assetBranchId, CancellationToken cancellationToken)
    {
        var resolvedBranchId = await branchAccessService.ResolveBranchIdForWriteAsync(TenantId, requestedBranchId ?? assetBranchId, cancellationToken);
        if (requestedBranchId.HasValue && assetBranchId.HasValue && requestedBranchId != assetBranchId)
        {
            throw new BusinessRuleException("Work order branch must match the selected asset branch.");
        }

        return resolvedBranchId;
    }

    private static string NormalizePriority(string? priority)
    {
        var value = string.IsNullOrWhiteSpace(priority) ? "Medium" : priority.Trim();
        return value switch
        {
            "Low" or "Medium" or "High" or "Critical" => value,
            _ => throw new BusinessRuleException("Priority must be Low, Medium, High, or Critical.")
        };
    }

    private static string NormalizeStatus(string status)
    {
        var value = status.Trim();
        return value switch
        {
            "Pending Materials" => "Awaiting Parts",
            "Awaiting User" => "Awaiting Client",
            "Acknowledged" => "Closed",
            "Assigned" => "Open",
            "Open" or "In Progress" or "Paused" or "Awaiting Parts" or "Awaiting Client" or "Completed" or "Closed" or "Cancelled" => value,
            _ => throw new BusinessRuleException("Invalid work order status.")
        };
    }

    private static string NormalizeAssignmentType(string? assignmentType, Guid? assignmentGroupId, Guid? assignedTechnicianId, IReadOnlyCollection<Guid>? assignedTechnicianIds)
    {
        var normalizedTechnicianIds = ResolveTechnicianIds(assignedTechnicianId, assignedTechnicianIds, assignmentType);
        var value = string.IsNullOrWhiteSpace(assignmentType)
            ? assignmentGroupId.HasValue
                ? AssignmentTypes.AssignmentGroup
                : normalizedTechnicianIds.Count > 0
                    ? AssignmentTypes.IndividualTechnician
                    : AssignmentTypes.Unassigned
            : assignmentType.Trim();
        return value switch
        {
            AssignmentTypes.IndividualTechnician or AssignmentTypes.MultipleTechnicians or AssignmentTypes.AssignmentGroup or AssignmentTypes.Unassigned => value,
            _ => throw new BusinessRuleException("Invalid assignment type.")
        };
    }

    private static List<Guid> NormalizeAssignedTechnicianIds(IReadOnlyCollection<Guid>? assignedTechnicianIds) =>
        assignedTechnicianIds?.Where(id => id != Guid.Empty).Distinct().ToList() ?? [];

    private static Guid? ResolvePrimaryTechnicianId(CreateWorkOrderRequest request)
    {
        var assignmentType = NormalizeAssignmentType(request.AssignmentType, request.AssignmentGroupId, request.AssignedTechnicianId, request.AssignedTechnicianIds);
        var assignedTechnicianIds = NormalizeAssignedTechnicianIds(request.AssignedTechnicianIds);

        return assignmentType switch
        {
            AssignmentTypes.IndividualTechnician => request.AssignedTechnicianId,
            AssignmentTypes.MultipleTechnicians => request.LeadTechnicianId ?? assignedTechnicianIds.FirstOrDefault(),
            AssignmentTypes.AssignmentGroup => request.LeadTechnicianId,
            _ => request.AssignedTechnicianId
        };
    }

    private static Guid? ResolvePrimaryTechnicianId(UpdateWorkOrderRequest request)
    {
        var assignmentType = NormalizeAssignmentType(request.AssignmentType, request.AssignmentGroupId, request.AssignedTechnicianId, request.AssignedTechnicianIds);
        var assignedTechnicianIds = NormalizeAssignedTechnicianIds(request.AssignedTechnicianIds);

        return assignmentType switch
        {
            AssignmentTypes.IndividualTechnician => request.AssignedTechnicianId,
            AssignmentTypes.MultipleTechnicians => request.LeadTechnicianId ?? assignedTechnicianIds.FirstOrDefault(),
            AssignmentTypes.AssignmentGroup => request.LeadTechnicianId,
            _ => request.AssignedTechnicianId
        };
    }

    private static string? SerializeAssignedTechnicianIds(IReadOnlyCollection<Guid>? assignedTechnicianIds)
    {
        var normalized = NormalizeAssignedTechnicianIds(assignedTechnicianIds);
        return normalized.Count == 0 ? null : JsonSerializer.Serialize(normalized);
    }

    private static List<Guid> ResolveTechnicianIds(Guid? assignedTechnicianId, IReadOnlyCollection<Guid>? assignedTechnicianIds, string? assignmentType)
    {
        var normalized = NormalizeAssignedTechnicianIds(assignedTechnicianIds);
        if (assignedTechnicianId.HasValue && !normalized.Contains(assignedTechnicianId.Value))
        {
            normalized.Insert(0, assignedTechnicianId.Value);
        }

        if (string.Equals(assignmentType, AssignmentTypes.AssignmentGroup, StringComparison.OrdinalIgnoreCase) && assignedTechnicianId.HasValue && normalized.Count == 0)
        {
            normalized.Add(assignedTechnicianId.Value);
        }

        return normalized;
    }

    private static IReadOnlyCollection<Guid> ParseAssignedTechnicianIds(string? assignedTechnicianIdsJson)
    {
        if (string.IsNullOrWhiteSpace(assignedTechnicianIdsJson))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<List<Guid>>(assignedTechnicianIdsJson) ?? [];
        }
        catch
        {
            return [];
        }
    }

    private static string GetAssignmentStatus(WorkOrder workOrder) =>
        workOrder.Assignments
            .OrderByDescending(x => x.AssignedAt)
            .Select(x => x.AssignmentStatus)
            .FirstOrDefault()
        ?? (workOrder.AssignmentGroupId.HasValue
            ? "AssignedToGroup"
            : workOrder.TechnicianAssignments.Any()
                ? "AssignedToTechnician"
                : "Unassigned");

    private static string BuildAssignmentSummary(WorkOrder workOrder)
    {
        var technicians = workOrder.TechnicianAssignments
            .OrderByDescending(x => x.IsLead)
            .ThenBy(x => x.AssignedAt)
            .ToList();

        if (!technicians.Any())
        {
            return workOrder.AssignmentGroup?.Name ?? "Unassigned";
        }

        var firstTechnicianName = technicians[0].Technician?.FullName ?? workOrder.AssignedTechnician?.FullName ?? "Technician";
        if (!string.IsNullOrWhiteSpace(workOrder.AssignmentGroup?.Name) && technicians.Count == 1)
        {
            return $"{workOrder.AssignmentGroup.Name} -> {firstTechnicianName}";
        }

        if (technicians.Count == 1)
        {
            return firstTechnicianName;
        }

        return $"{firstTechnicianName} + {technicians.Count - 1} others";
    }

    private static WorkOrderResponse Map(WorkOrder workOrder)
    {
        var technicianAssignments = workOrder.TechnicianAssignments
            .OrderByDescending(x => x.IsLead)
            .ThenBy(x => x.AssignedAt)
            .Select(x => new WorkOrderTechnicianAssignmentResponse(
                x.Id,
                x.TechnicianId,
                x.Technician?.FullName,
                x.IsLead,
                x.Status,
                x.AssignedAt,
                x.AcceptedAt,
                x.ArrivalAt,
                x.DepartureAt,
                x.Notes))
            .ToList();

        return new WorkOrderResponse(
            workOrder.Id,
            workOrder.BranchId,
            workOrder.Branch?.Name,
            workOrder.ClientId,
            workOrder.Client?.ClientName,
            workOrder.SiteId,
            workOrder.Site?.SiteName,
            workOrder.AssetId,
            workOrder.Asset?.AssetName,
            workOrder.AssignmentGroupId,
            workOrder.AssignmentGroup?.Name,
            workOrder.WorkOrderNumber,
            workOrder.Title,
            workOrder.Description,
            workOrder.Priority,
            NormalizeStatus(workOrder.Status),
            ResolveSlaStatus(workOrder),
            workOrder.AssignmentType,
            workOrder.AssignedTechnicianId,
            workOrder.AssignedTechnician?.FullName,
            ParseAssignedTechnicianIds(workOrder.AssignedTechnicianIdsJson),
            workOrder.LeadTechnicianId,
            workOrder.LeadTechnician?.FullName,
            workOrder.DueDate,
            workOrder.CreatedAt,
            workOrder.WorkStartedAt,
            workOrder.ArrivalAt,
            workOrder.DepartureAt,
            workOrder.CompletedAt,
            workOrder.WorkDoneNotes,
            workOrder.JobCardNotes,
            workOrder.SlaResponseDeadline,
            workOrder.SlaResolutionDeadline,
            workOrder.SlaResponseBreached,
            workOrder.SlaResolutionBreached,
            workOrder.SlaResponseBreachedAt,
            workOrder.SlaResolutionBreachedAt,
            workOrder.AcknowledgedByName,
            workOrder.AcknowledgementComments,
            workOrder.AcknowledgementDate,
            workOrder.IsPreventiveMaintenance,
            GetAssignmentStatus(workOrder),
            workOrder.Assignments.OrderByDescending(x => x.AssignedAt).Select(x => x.Notes).FirstOrDefault(),
            technicianAssignments,
            BuildAssignmentSummary(workOrder),
            !workOrder.AssignmentGroupId.HasValue && technicianAssignments.Count == 0,
            workOrder.PmTemplateId,
            workOrder.PmTemplate?.Name,
            workOrder.PreventiveMaintenancePlanId,
            workOrder.ChecklistItems
                .OrderBy(x => x.SectionName ?? string.Empty)
                .ThenBy(x => x.SortOrder)
                .ThenBy(x => x.CreatedAt)
                .Select(x => new WorkOrderChecklistItemResponse(
                    x.Id,
                    x.PmTemplateQuestionId,
                    x.SectionName,
                    x.QuestionText,
                    x.InputType,
                    x.IsRequired,
                    x.SortOrder,
                    x.ResponseValue,
                    x.Remarks,
                    x.IsCompleted,
                    x.CompletedByUserId,
                    x.CompletedAt,
                    ParseOptions(x.OptionsJson)))
                .ToList());
    }

    private static string ResolveSlaStatus(WorkOrder workOrder)
    {
        if (workOrder.SlaResolutionBreached)
        {
            return "Resolution Breached";
        }

        if (workOrder.SlaResponseBreached)
        {
            return "Response Breached";
        }

        if (workOrder.SlaResolutionDeadline.HasValue)
        {
            return "On Track";
        }

        return "Not Configured";
    }

    private async Task EnsurePmTemplateIsValidAsync(bool isPreventiveMaintenance, Guid? pmTemplateId, CancellationToken cancellationToken)
    {
        if (!isPreventiveMaintenance || !pmTemplateId.HasValue)
        {
            return;
        }

        await pmWorkOrderChecklistService.GetActiveTemplateAsync(TenantId, pmTemplateId.Value, cancellationToken);
    }

    private static IReadOnlyCollection<string> ParseOptions(string? optionsJson)
    {
        if (string.IsNullOrWhiteSpace(optionsJson))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<List<string>>(optionsJson) ?? [];
        }
        catch
        {
            return [];
        }
    }
}

public sealed record CreateWorkOrderRequest(
    Guid ClientId,
    Guid? BranchId,
    Guid? SiteId,
    Guid? AssetId,
    Guid? AssignmentGroupId,
    string? AssignmentType,
    Guid? AssignedTechnicianId,
    IReadOnlyCollection<Guid>? AssignedTechnicianIds,
    Guid? LeadTechnicianId,
    string? AssignmentNotes,
    string Title,
    string? Description,
    string? Priority,
    DateTime? DueDate,
    bool IsPreventiveMaintenance,
    Guid? PmTemplateId);

public sealed record UpdateWorkOrderRequest(
    Guid ClientId,
    Guid? BranchId,
    Guid? SiteId,
    Guid? AssetId,
    Guid? AssignmentGroupId,
    string? AssignmentType,
    Guid? AssignedTechnicianId,
    IReadOnlyCollection<Guid>? AssignedTechnicianIds,
    Guid? LeadTechnicianId,
    string? AssignmentNotes,
    string Title,
    string? Description,
    string? Priority,
    string? Status,
    DateTime? DueDate,
    Guid? PmTemplateId);

public sealed record AssignWorkOrderRequest(Guid? TechnicianId, Guid? AssignmentGroupId, string? Notes);
public sealed record AttachPmTemplateRequest(Guid? PmTemplateId);
public sealed record UpdateWorkOrderChecklistItemRequest(string? ResponseValue, string? Remarks, bool IsCompleted);

public sealed record CompleteWorkOrderRequest(string WorkDoneNotes, DateTime? CompletedAt, Guid? TechnicianId, Guid? AssignmentGroupId, string? ReportSummary, string? AnswersJson, bool AdminOverride = false, string? OverrideReason = null);

public sealed record AcknowledgeWorkOrderRequest(string AcknowledgedByName, string? Comments, DateTime? AcknowledgementDate);
public sealed record AddWorkOrderCommentRequest(string Message);
public sealed record WorkOrderLocationRequest(decimal? Latitude, decimal? Longitude);

public sealed record WorkOrderResponse(
    Guid Id,
    Guid? BranchId,
    string? BranchName,
    Guid ClientId,
    string? ClientName,
    Guid? SiteId,
    string? SiteName,
    Guid? AssetId,
    string? AssetName,
    Guid? AssignmentGroupId,
    string? AssignmentGroupName,
    string WorkOrderNumber,
    string Title,
    string? Description,
    string Priority,
    string Status,
    string SlaStatus,
    string AssignmentType,
    Guid? AssignedTechnicianId,
    string? AssignedTechnicianName,
    IReadOnlyCollection<Guid> AssignedTechnicianIds,
    Guid? LeadTechnicianId,
    string? LeadTechnicianName,
    DateTime? DueDate,
    DateTime CreatedAt,
    DateTime? WorkStartedAt,
    DateTime? ArrivalAt,
    DateTime? DepartureAt,
    DateTime? CompletedAt,
    string? WorkDoneNotes,
    string? JobCardNotes,
    DateTime? SlaResponseDeadline,
    DateTime? SlaResolutionDeadline,
    bool SlaResponseBreached,
    bool SlaResolutionBreached,
    DateTime? SlaResponseBreachedAt,
    DateTime? SlaResolutionBreachedAt,
    string? AcknowledgedByName,
    string? AcknowledgementComments,
    DateTime? AcknowledgementDate,
    bool IsPreventiveMaintenance,
    string AssignmentStatus = "Unassigned",
    string? AssignmentNotes = null,
    IReadOnlyCollection<WorkOrderTechnicianAssignmentResponse>? TechnicianAssignments = null,
    string? AssignmentSummary = null,
    bool IsUnassigned = false,
    Guid? PmTemplateId = null,
    string? PmTemplateName = null,
    Guid? PreventiveMaintenancePlanId = null,
    IReadOnlyCollection<WorkOrderChecklistItemResponse>? ChecklistItems = null);

public sealed record WorkOrderChecklistItemResponse(
    Guid Id,
    Guid? PmTemplateQuestionId,
    string? SectionName,
    string QuestionText,
    string InputType,
    bool IsRequired,
    int SortOrder,
    string? ResponseValue,
    string? Remarks,
    bool IsCompleted,
    Guid? CompletedByUserId,
    DateTime? CompletedAt,
    IReadOnlyCollection<string> Options);

public sealed record WorkOrderTechnicianAssignmentResponse(
    Guid Id,
    Guid TechnicianId,
    string? TechnicianName,
    bool IsLead,
    string Status,
    DateTime AssignedAt,
    DateTime? AcceptedAt,
    DateTime? ArrivalAt,
    DateTime? DepartureAt,
    string? Notes);

public sealed record WorkOrderEventResponse(
    Guid Id,
    string EventType,
    string? Status,
    string Message,
    Guid? ActorUserId,
    decimal? Latitude,
    decimal? Longitude,
    DateTime OccurredAt);

internal static class AssignmentTypes
{
    public const string Unassigned = "Unassigned";
    public const string IndividualTechnician = "IndividualTechnician";
    public const string MultipleTechnicians = "MultipleTechnicians";
    public const string AssignmentGroup = "AssignmentGroup";
}
