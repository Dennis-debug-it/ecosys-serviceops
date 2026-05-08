using Ecosys.Domain.Common;

namespace Ecosys.Domain.Entities;

public sealed class UserPermission : AuditableEntity
{
    public Guid UserId { get; set; }
    public bool CanViewWorkOrders { get; set; }
    public bool CanCreateWorkOrders { get; set; }
    public bool CanAssignWorkOrders { get; set; }
    public bool CanCompleteWorkOrders { get; set; }
    public bool CanApproveMaterials { get; set; }
    public bool CanIssueMaterials { get; set; }
    public bool CanManageAssets { get; set; }
    public bool CanManageSettings { get; set; }
    public bool CanViewReports { get; set; }

    public User? User { get; set; }
}
