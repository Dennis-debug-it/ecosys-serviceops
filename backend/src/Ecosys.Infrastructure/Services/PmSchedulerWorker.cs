using Ecosys.Domain.Entities;
using Ecosys.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Ecosys.Infrastructure.Services;

public sealed class PmSchedulerWorker(
    IServiceScopeFactory serviceScopeFactory,
    ILogger<PmSchedulerWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("PM scheduler worker started.");

        // Wait until 06:00 UTC for first run, then every 24h
        await WaitUntilNextRunTimeAsync(stoppingToken);

        using var timer = new PeriodicTimer(TimeSpan.FromHours(24));
        while (!stoppingToken.IsCancellationRequested)
        {
            await RunCycleAsync(stoppingToken);
            await timer.WaitForNextTickAsync(stoppingToken);
        }
    }

    private static async Task WaitUntilNextRunTimeAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var nextRun = now.Date.AddHours(6);
        if (nextRun <= now)
            nextRun = nextRun.AddDays(1);

        var delay = nextRun - now;
        if (delay > TimeSpan.Zero)
            await Task.Delay(delay, ct).ConfigureAwait(ConfigureAwaitOptions.SuppressThrowing);
    }

    private async Task RunCycleAsync(CancellationToken ct)
    {
        try
        {
            using var scope = serviceScopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var now = DateTime.UtcNow;

            var activePlans = await db.PreventiveMaintenancePlans
                .Include(x => x.Asset)
                .Include(x => x.PmTemplate)
                    .ThenInclude(t => t!.Questions)
                .Where(x => x.Status == "Active" && x.NextPmDate.HasValue)
                .ToListAsync(ct);

            var generated = 0;

            foreach (var plan in activePlans)
            {
                try
                {
                    if (!ShouldGenerate(plan, now))
                        continue;

                    var hasOpenWo = await db.WorkOrders.AnyAsync(
                        x => x.PreventiveMaintenancePlanId == plan.Id &&
                             x.Status != "Completed" && x.Status != "Cancelled",
                        ct);

                    if (hasOpenWo)
                        continue;

                    var wo = await CreateWorkOrderAsync(db, plan, now, ct);
                    plan.LastGeneratedAt = now;
                    generated++;

                    logger.LogInformation(
                        "Generated PM work order {WoNumber} for plan {PlanId} on asset {AssetId}.",
                        wo.WorkOrderNumber, plan.Id, plan.AssetId);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Failed to generate PM work order for plan {PlanId}.", plan.Id);
                }
            }

            if (generated > 0)
            {
                await db.SaveChangesAsync(ct);
                logger.LogInformation("PM scheduler cycle complete. Generated {Count} work orders.", generated);
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
        catch (Exception ex)
        {
            logger.LogError(ex, "PM scheduler cycle failed.");
        }
    }

    private static bool ShouldGenerate(PreventiveMaintenancePlan plan, DateTime now)
    {
        if (!plan.NextPmDate.HasValue)
            return false;

        var generateByDate = plan.NextPmDate.Value.AddDays(-plan.DaysBeforeDue);
        return now.Date >= generateByDate.Date;
    }

    private static async Task<WorkOrder> CreateWorkOrderAsync(
        AppDbContext db,
        PreventiveMaintenancePlan plan,
        DateTime now,
        CancellationToken ct)
    {
        var woNumber = await GenerateWoNumberAsync(db, plan.TenantId, ct);

        var wo = new WorkOrder
        {
            TenantId = plan.TenantId,
            BranchId = plan.BranchId,
            ClientId = plan.Asset?.ClientId ?? Guid.Empty,
            SiteId = plan.SiteId,
            AssetId = plan.AssetId,
            AssignmentGroupId = plan.DefaultAssignmentGroupId,
            WorkOrderNumber = woNumber,
            Title = $"PM – {plan.Asset?.AssetName ?? "Asset"}",
            Priority = "Medium",
            Status = "Open",
            IsPreventiveMaintenance = true,
            PreventiveMaintenancePlanId = plan.Id,
            PmTemplateId = plan.PmTemplateId,
            DueDate = plan.NextPmDate
        };
        db.WorkOrders.Add(wo);

        if (plan.PmTemplate?.Questions is { Count: > 0 } questions)
        {
            foreach (var q in questions.OrderBy(x => x.DisplayOrder).ThenBy(x => x.SortOrder))
            {
                db.WorkOrderChecklistItems.Add(new WorkOrderChecklistItem
                {
                    TenantId = plan.TenantId,
                    WorkOrderId = wo.Id,
                    PmTemplateQuestionId = q.Id,
                    SectionName = q.SectionName,
                    QuestionText = q.Prompt,
                    InputType = q.ResponseType,
                    QuestionType = q.QuestionType,
                    Unit = q.Unit,
                    IsRequired = q.IsRequired,
                    RequiresNoteOnFail = q.RequiresNoteOnFail,
                    SortOrder = q.DisplayOrder > 0 ? q.DisplayOrder : q.SortOrder,
                    OptionsJson = q.OptionsJson
                });
            }
        }

        return wo;
    }

    private static async Task<string> GenerateWoNumberAsync(AppDbContext db, Guid tenantId, CancellationToken ct)
    {
        var setting = await db.NumberingSettings
            .SingleOrDefaultAsync(x => x.TenantId == tenantId && x.BranchId == null && x.DocumentType == "WorkOrder", ct);

        var prefix = setting?.Prefix ?? "WO";
        var next = setting?.NextNumber ?? 1;
        var pad = setting?.PaddingLength ?? 6;

        if (setting != null)
            setting.NextNumber += 1;

        return $"{prefix}-{next.ToString().PadLeft(pad, '0')}";
    }
}
