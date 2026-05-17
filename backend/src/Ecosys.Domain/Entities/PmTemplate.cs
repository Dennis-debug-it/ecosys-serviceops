using Ecosys.Domain.Common;

namespace Ecosys.Domain.Entities;

public sealed class PmTemplate : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid? AssetCategoryId { get; set; }
    public string Category { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal? EstimatedDurationHours { get; set; }
    public bool AutoScheduleByDefault { get; set; }
    public bool IsActive { get; set; } = true;

    public Tenant? Tenant { get; set; }
    public AssetCategory? AssetCategory { get; set; }
    public ICollection<PmTemplateSection> Sections { get; set; } = new List<PmTemplateSection>();
    public ICollection<PmTemplateQuestion> Questions { get; set; } = new List<PmTemplateQuestion>();
    public ICollection<PreventiveMaintenancePlan> Plans { get; set; } = new List<PreventiveMaintenancePlan>();
    public ICollection<PmReport> Reports { get; set; } = new List<PmReport>();
    public ICollection<WorkOrder> WorkOrders { get; set; } = new List<WorkOrder>();
}
