using Ecosys.Domain.Common;

namespace Ecosys.Domain.Entities;

public sealed class Client : AuditableEntity
{
    public Guid TenantId { get; set; }
    public string ClientName { get; set; } = string.Empty;
    public string? ClientType { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Location { get; set; }
    public string? ContactPerson { get; set; }
    public string? ContactPhone { get; set; }
    public string? SlaPlan { get; set; }
    public Guid? SlaDefinitionId { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;

    public Tenant? Tenant { get; set; }
    public SlaDefinition? SlaDefinition { get; set; }
    public ICollection<Asset> Assets { get; set; } = new List<Asset>();
    public ICollection<WorkOrder> WorkOrders { get; set; } = new List<WorkOrder>();
}
