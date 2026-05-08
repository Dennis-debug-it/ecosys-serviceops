using Ecosys.Infrastructure.Persistence;
using Ecosys.Platform.Contracts.Numbering;
using Ecosys.ServiceOps.Entities;
using Ecosys.ServiceOps.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Ecosys.Infrastructure.Hosted;

internal sealed class PreventiveMaintenanceHostedService(IServiceScopeFactory scopeFactory, ILogger<PreventiveMaintenanceHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<EcosysDbContext>();
                var numberSequences = scope.ServiceProvider.GetRequiredService<INumberSequenceService>();
                var now = DateTime.UtcNow;

                var dueSchedules = await dbContext.PmSchedules
                    .IgnoreQueryFilters()
                    .Where(x => x.IsActive && x.NextRunUtc <= now)
                    .ToListAsync(stoppingToken);

                foreach (var schedule in dueSchedules)
                {
                    dbContext.WorkOrders.Add(new WorkOrder
                    {
                        TenantId = schedule.TenantId,
                        Number = await numberSequences.GenerateAsync(schedule.TenantId, "WorkOrder", stoppingToken),
                        CustomerId = schedule.CustomerId,
                        AssetId = schedule.AssetId,
                        WorkOrderTypeId = schedule.WorkOrderTypeId,
                        Title = schedule.Title,
                        Priority = WorkOrderPriority.Medium,
                        Status = WorkOrderStatus.Open,
                        ResponseDueUtc = now.AddHours(4),
                        ResolutionDueUtc = now.AddDays(2),
                        SlaStatus = SlaStatus.WithinTarget
                    });

                    schedule.NextRunUtc = schedule.NextRunUtc.AddDays(schedule.IntervalDays);
                }

                await dbContext.SaveChangesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Preventive maintenance scheduler failed.");
            }

            await Task.Delay(TimeSpan.FromMinutes(15), stoppingToken);
        }
    }
}
