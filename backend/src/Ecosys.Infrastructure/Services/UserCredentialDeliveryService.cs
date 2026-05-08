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
    string TemplateEventKey,
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
    IEmailTemplateService emailTemplateService,
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
        var supportEmail = effectiveSettings?.ReplyToEmail
            ?? effectiveSettings?.SenderAddress
            ?? tenant?.ContactEmail
            ?? tenant?.Email
            ?? "support@ecosys.local";

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
            var template = await emailTemplateService.RenderTenantTemplateAsync(
                tenantId,
                request.TemplateEventKey,
                new Dictionary<string, string?>
                {
                    ["FullName"] = user.FullName,
                    ["Email"] = user.Email,
                    ["TemporaryPassword"] = request.TemporaryPassword,
                    ["InviteLink"] = request.InviteLink,
                    ["ResetPasswordLink"] = request.InviteLink,
                    ["LoginUrl"] = request.LoginUrl,
                    ["CompanyName"] = tenant?.CompanyName ?? tenant?.Name ?? "Ecosys",
                    ["WorkspaceName"] = tenant?.Name ?? tenant?.CompanyName ?? "Ecosys Workspace",
                    ["TenantName"] = tenant?.Name ?? tenant?.CompanyName ?? "Ecosys Workspace",
                    ["SupportEmail"] = supportEmail,
                },
                cancellationToken);

            if (!template.Enabled)
            {
                return new UserCredentialDeliveryResult(false, "Disabled", "Credential email is disabled for this template.");
            }

            await emailSender.SendAsync(
                new EmailMessage(
                    user.Email,
                    template.Subject,
                    template.HtmlBody,
                    template.SenderNameOverride ?? effectiveSettings.SenderName,
                    effectiveSettings.SenderAddress,
                    template.ReplyToOverride ?? effectiveSettings.ReplyToEmail,
                    IsHtml: true),
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
            EmailDeliveryModeResolver.ResolveSecureMode(settings.Port, settings.UseSsl),
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
