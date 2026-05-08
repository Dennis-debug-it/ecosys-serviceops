using Ecosys.Domain.Common;

namespace Ecosys.Domain.Entities;

public sealed class NumberingSetting : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public string DocumentType { get; set; } = "WorkOrder";
    public string Prefix { get; set; } = "WO";
    public long NextNumber { get; set; } = 1;
    public int PaddingLength { get; set; } = 6;
    public string ResetFrequency { get; set; } = "Never";
    public bool IncludeYear { get; set; }
    public bool IncludeMonth { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? LastResetAt { get; set; }

    public Tenant? Tenant { get; set; }
    public Branch? Branch { get; set; }
}
