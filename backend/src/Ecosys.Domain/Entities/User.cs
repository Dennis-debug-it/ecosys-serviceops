using Ecosys.Domain.Common;

namespace Ecosys.Domain.Entities;

public sealed class User : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid? DefaultBranchId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? JobTitle { get; set; }
    public string? Department { get; set; }
    public bool IsActive { get; set; } = true;
    public bool HasAllBranchAccess { get; set; }
    public bool MustChangePassword { get; set; }
    public string? InviteTokenHash { get; set; }
    public DateTime? InviteTokenExpiresAt { get; set; }
    public DateTime? InviteAcceptedAt { get; set; }
    public DateTime? LastCredentialSentAt { get; set; }

    public Tenant? Tenant { get; set; }
    public Branch? DefaultBranch { get; set; }
    public UserPermission? Permission { get; set; }
    public Technician? TechnicianProfile { get; set; }
    public ICollection<UserBranchAssignment> BranchAssignments { get; set; } = new List<UserBranchAssignment>();
    public ICollection<UserSession> Sessions { get; set; } = new List<UserSession>();
}
