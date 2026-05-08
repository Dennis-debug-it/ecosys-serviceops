using Ecosys.Domain.Common;

namespace Ecosys.Domain.Entities;

public sealed class PreventiveMaintenancePlan : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid AssetId { get; set; }
    public Guid? PmTemplateId { get; set; }
    public string Frequency { get; set; } = string.Empty;
    public bool AutoSchedule { get; set; }
    public DateTime? LastPmDate { get; set; }
    public DateTime? NextPmDate { get; set; }
    public string Status { get; set; } = "Active";

    public Tenant? Tenant { get; set; }
    public Branch? Branch { get; set; }
    public Asset? Asset { get; set; }
    public PmTemplate? PmTemplate { get; set; }
    public ICollection<WorkOrder> WorkOrders { get; set; } = new List<WorkOrder>();
}
