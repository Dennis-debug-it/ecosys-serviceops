using Ecosys.Domain.Common;

namespace Ecosys.Domain.Entities;

public sealed class Asset : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid ClientId { get; set; }
    public string AssetName { get; set; } = string.Empty;
    public string AssetCode { get; set; } = string.Empty;
    public string? AssetType { get; set; }
    public string? Location { get; set; }
    public string? SerialNumber { get; set; }
    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public DateTime? InstallationDate { get; set; }
    public DateTime? WarrantyExpiryDate { get; set; }
    public string? RecommendedPmFrequency { get; set; }
    public bool AutoSchedulePm { get; set; }
    public DateTime? LastPmDate { get; set; }
    public DateTime? NextPmDate { get; set; }
    public string? Notes { get; set; }
    public string Status { get; set; } = "Active";

    public Tenant? Tenant { get; set; }
    public Branch? Branch { get; set; }
    public Client? Client { get; set; }
    public ICollection<WorkOrder> WorkOrders { get; set; } = new List<WorkOrder>();
    public ICollection<PreventiveMaintenancePlan> PreventiveMaintenancePlans { get; set; } = new List<PreventiveMaintenancePlan>();
}
