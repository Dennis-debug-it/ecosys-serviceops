using Ecosys.Domain.Entities;
using Ecosys.Infrastructure.Data;
using Ecosys.Shared.Auth;
using Ecosys.Shared.Contracts.Integration;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Ecosys.Infrastructure.Services;

public interface IUserCredentialDeliveryService
{
    string BuildLoginUrl();
    string BuildInviteUrl(string token);
    Task<UserCredentialDeliveryResult> SendAsync(
        Guid tenantId,
        User user,
        UserCredentialDeliveryRequest request,
        CancellationToken cancellationToken = default);
}

public sealed record UserCredentialDeliveryRequest(
    string LoginUrl,
    string? TemporaryPassword,
    string? InviteLink,
    bool RequirePasswordChange);

public sealed record UserCredentialDeliveryResult(
    bool Success,
    string Status,
    string Message);

internal sealed class UserCredentialDeliveryService(
    AppDbContext dbContext,
    IHttpContextAccessor httpContextAccessor,
    IEmailSender emailSender,
    ISecretEncryptionService secretEncryptionService,
    ILogger<UserCredentialDeliveryService> logger) : IUserCredentialDeliveryService
{
    public string BuildLoginUrl() => $"{ResolveBaseUrl()}/login";

    public string BuildInviteUrl(string token) => $"{ResolveBaseUrl()}/accept-invite?token={Uri.EscapeDataString(token)}";

    public async Task<UserCredentialDeliveryResult> SendAsync(
        Guid tenantId,
        User user,
        UserCredentialDeliveryRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!user.IsActive)
        {
            return new UserCredentialDeliveryResult(false, "SkippedInactive", "Credential email was skipped because the user is inactive.");
        }

        if (string.IsNullOrWhiteSpace(user.Email))
        {
            return new UserCredentialDeliveryResult(false, "MissingEmail", "Credential email could not be sent because the user email address is missing.");
        }

        var tenant = await dbContext.Tenants.SingleOrDefaultAsync(x => x.Id == tenantId, cancellationToken);
        var tenantSettings = await dbContext.EmailSettings.SingleOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);
        var effectiveSettings = await ResolveEffectiveEmailSettingsAsync(tenantId, tenantSettings, cancellationToken);

        if (effectiveSettings is null)
        {
            return new UserCredentialDeliveryResult(false, "NotConfigured", "Credential email could not be sent because email settings are not configured.");
        }

        if (!effectiveSettings.IsEnabled || string.Equals(effectiveSettings.Provider, EmailDeliveryMode.Disabled.ToString(), StringComparison.OrdinalIgnoreCase))
        {
            return new UserCredentialDeliveryResult(false, "NotConfigured", "Credential email could not be sent because email delivery is disabled.");
        }

        var delivery = CreateDeliveryOptions(effectiveSettings);
        if (delivery is null)
        {
            return new UserCredentialDeliveryResult(false, "NotConfigured", "Credential email could not be sent because SMTP settings are incomplete.");
        }

        try
        {
            await emailSender.SendAsync(
                new EmailMessage(
                    user.Email,
                    "Your Ecosys account is ready",
                    BuildMessageBody(user, request),
                    effectiveSettings.SenderName,
                    effectiveSettings.SenderAddress,
                    effectiveSettings.ReplyToEmail),
                delivery,
                cancellationToken);

            return new UserCredentialDeliveryResult(true, "Sent", "User credentials sent.");
        }
        catch (Exception ex)
        {
            logger.LogWarning(
                ex,
                "Credential email failed for tenant {TenantId} and user {UserId}. Status {Status}.",
                tenantId,
                user.Id,
                ex is EmailDeliveryException deliveryException ? deliveryException.ErrorCategory : EmailErrorCategories.UnknownSmtpError);

            var workspaceName = tenant?.CompanyName ?? tenant?.Name ?? "this workspace";
            return new UserCredentialDeliveryResult(false, "Failed", $"Credential email could not be sent for {workspaceName}. Please verify email settings and try again.");
        }
    }

    private async Task<EmailSetting?> ResolveEffectiveEmailSettingsAsync(Guid tenantId, EmailSetting? tenantSettings, CancellationToken cancellationToken)
    {
        if (tenantSettings is null)
        {
            tenantSettings = await dbContext.EmailSettings.SingleOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);
        }

        if (tenantSettings is null)
        {
            return null;
        }

        if (tenantSettings.UsePlatformDefaults && !tenantSettings.OverrideSmtpSettings && tenantId != PlatformConstants.RootTenantId)
        {
            return await dbContext.EmailSettings.SingleOrDefaultAsync(x => x.TenantId == PlatformConstants.RootTenantId, cancellationToken);
        }

        return tenantSettings;
    }

    private EmailDeliverySettings? CreateDeliveryOptions(EmailSetting settings)
    {
        var mode = ParseDeliveryMode(settings.Provider);
        var secret = secretEncryptionService.Decrypt(settings.EncryptedSecret) ?? settings.Password;

        if (mode == EmailDeliveryMode.Smtp && string.IsNullOrWhiteSpace(settings.Host))
        {
            return null;
        }

        return new EmailDeliverySettings(
            mode,
            settings.Host,
            settings.Port,
            settings.Username,
            secret,
            settings.SenderName,
            settings.SenderAddress,
            settings.ReplyToEmail,
            settings.UseSsl,
            settings.UseSsl ? EmailSecureMode.StartTls : EmailSecureMode.None,
            null,
            null,
            null,
            30,
            0);
    }

    private static EmailDeliveryMode ParseDeliveryMode(string? value)
    {
        if (Enum.TryParse<EmailDeliveryMode>(value, true, out var parsed))
        {
            return parsed;
        }

        return EmailDeliveryMode.Smtp;
    }

    private static string BuildMessageBody(User user, UserCredentialDeliveryRequest request)
    {
        var lines = new List<string>
        {
            $"Hello {user.FullName},",
            string.Empty,
            "Your Ecosys account has been created.",
            string.Empty,
            $"Login URL: {request.LoginUrl}",
            $"Username: {user.Email}"
        };

        if (!string.IsNullOrWhiteSpace(request.TemporaryPassword))
        {
            lines.Add($"Temporary Password: {request.TemporaryPassword}");
        }

        if (!string.IsNullOrWhiteSpace(request.InviteLink))
        {
            lines.Add($"Secure Access Link: {request.InviteLink}");
        }

        lines.Add(string.Empty);
        lines.Add(request.RequirePasswordChange
            ? "For security, you will be asked to change your password after signing in."
            : "Use the secure access link above to finish setting your password.");
        lines.Add(string.Empty);
        lines.Add("If you need help, please contact your Ecosys administrator.");
        lines.Add(string.Empty);
        lines.Add("Regards,");
        lines.Add("Ecosys Support");

        return string.Join(Environment.NewLine, lines);
    }

    private string ResolveBaseUrl()
    {
        var request = httpContextAccessor.HttpContext?.Request;
        var origin = request?.Headers.Origin.FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(origin))
        {
            return origin.TrimEnd('/');
        }

        if (request is not null && request.Host.HasValue)
        {
            return $"{request.Scheme}://{request.Host.Value}".TrimEnd('/');
        }

        return "http://localhost";
    }
}
