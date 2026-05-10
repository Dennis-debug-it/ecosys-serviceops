using Ecosys.Shared.Contracts.Integration;

namespace Ecosys.Infrastructure.Services;

public interface IEmailNotificationRegistry
{
    IReadOnlyCollection<EmailNotificationDefinition> List();
}

public sealed record EmailNotificationDefinition(
    string EventKey,
    string DisplayName,
    string TemplateKey,
    string RecipientStrategy,
    string SenderScope,
    string DispatchStatus,
    string Description,
    IReadOnlyCollection<string> SupportedChannels,
    string Notes);

internal sealed class EmailNotificationRegistry : IEmailNotificationRegistry
{
    private static readonly IReadOnlyCollection<EmailNotificationDefinition> Definitions =
    [
        new("email.test", "Test email", "test-email", "Test recipient email", "Platform SMTP", "Active", "Sends a manual test message from Platform Settings.", ["Email"], "Used by the SMTP test flow."),
        new("platform.user.created", "Platform user created", "user-credentials", "Created platform user", "Platform SMTP", "Active", "Sends credentials to a newly created platform user.", ["Email"], "Credential delivery is active."),
        new("platform.user.credentials.resent", "Platform credentials resent", "resend-credentials", "Selected platform user", "Platform SMTP", "Active", "Sends refreshed credentials to a platform user.", ["Email"], "Credential delivery is active."),
        new("tenant.user.created", "Tenant user created", "user-credentials", "Created tenant user", "Tenant SMTP or platform fallback", "Active", "Sends credentials to a newly created tenant user.", ["Email"], "Tenant delivery falls back to platform settings when needed."),
        new("tenant.user.credentials.resent", "Tenant credentials resent", "resend-credentials", "Selected tenant user", "Tenant SMTP or platform fallback", "Active", "Sends refreshed credentials to a tenant user.", ["Email"], "Tenant delivery falls back to platform settings when needed."),
        new("tenant.onboarding", "Tenant/workspace provisioned", "tenant-onboarding", "Tenant primary contact or admin", "Platform SMTP", "Active", "Welcomes a new tenant workspace when provisioning is complete.", ["Email"], "Currently available through platform provisioning flows."),
        new("platform.lead.received", "Workspace request received", "workspace-request-received", "Platform support or admin email", "Platform SMTP", "Active", "Alerts platform staff when a workspace request is submitted.", ["Email"], "Lead notification delivery is active."),
        new("auth.password-reset.requested", "Self-service password reset requested", "password-reset-link", "Requesting user", "Platform or tenant SMTP", "PendingHook", "Sends a self-service reset link when forgot-password is implemented.", ["Email"], "Template is ready; public reset flow is still pending."),
        new("user.password-reset.admin", "Admin password reset", "password-reset", "Selected user", "Platform or tenant SMTP", "Active", "Sends an administrator-triggered password reset notification.", ["Email"], "Currently used by admin reset actions."),
        new("work-order.assigned", "Work order assigned", "work-order-assigned", "Assigned user or group", "Tenant SMTP", "PendingHook", "Operational assignment email for work orders.", ["Email", "In-App"], "Template available, dispatch hook pending."),
        new("work-order.overdue", "Work order overdue", "work-order-overdue", "Supervisor or admin", "Tenant SMTP", "PendingHook", "Escalation email for overdue work orders.", ["Email", "In-App"], "Template available, dispatch hook pending."),
        new("pm.due", "Preventive maintenance due", "pm-due", "Assigned group or supervisor", "Tenant SMTP", "PendingHook", "Reminder for preventive maintenance due dates.", ["Email", "In-App"], "Template available, dispatch hook pending."),
        new("material.request.submitted", "Material request submitted", "material-request", "Approver or stores", "Tenant SMTP", "PendingHook", "Notifies stores or approvers about a new material request.", ["Email", "In-App"], "Template available, dispatch hook pending."),
        new("smtp.failure", "SMTP failure alert", "smtp-failure-alert", "Platform admin", "Platform SMTP or in-app fallback", "PendingHook", "Alerts admins when delivery failures need attention.", ["Email", "In-App"], "Template available, dispatch hook pending."),
    ];

    public IReadOnlyCollection<EmailNotificationDefinition> List() => Definitions;
}
