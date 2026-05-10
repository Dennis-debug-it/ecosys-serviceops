using Ecosys.Domain.Entities;
using Ecosys.Infrastructure.Data;
using Ecosys.Shared.Auth;
using Ecosys.Shared.Contracts.Integration;
using Ecosys.Shared.Options;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;

namespace Ecosys.Infrastructure.Services;

public interface IUserCredentialDeliveryService
{
    string BuildLoginUrl();
    string BuildInviteUrl(string token);
    string BuildResetPasswordUrl(string token);
    Task<UserCredentialDeliveryResult> SendAsync(
        Guid tenantId,
        User user,
        UserCredentialDeliveryRequest request,
        CancellationToken cancellationToken = default);
    Task<UserCredentialDeliveryResult> SendPasswordResetLinkAsync(
        Guid tenantId,
        User user,
        PasswordResetLinkDeliveryRequest request,
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

public sealed record PasswordResetLinkDeliveryRequest(
    string ResetLink,
    DateTime ExpiresAt);

internal sealed class UserCredentialDeliveryService(
    AppDbContext dbContext,
    IHttpContextAccessor httpContextAccessor,
    IEmailSender emailSender,
    IEmailTemplateService emailTemplateService,
    IEmailDeliveryLogService emailDeliveryLogService,
    IEmailSubjectRuleService emailSubjectRuleService,
    ISecretEncryptionService secretEncryptionService,
    IOptions<PublicAppOptions> publicAppOptions,
    ILogger<UserCredentialDeliveryService> logger) : IUserCredentialDeliveryService
{
    public string BuildLoginUrl() => $"{ResolveBaseUrl()}/login";

    public string BuildInviteUrl(string token) => $"{ResolveBaseUrl()}/accept-invite?token={Uri.EscapeDataString(token)}";

    public string BuildResetPasswordUrl(string token) => $"{ResolvePublicBaseUrl()}/reset-password?token={Uri.EscapeDataString(token)}";

    public async Task<UserCredentialDeliveryResult> SendAsync(
        Guid tenantId,
        User user,
        UserCredentialDeliveryRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!user.IsActive)
        {
            await WriteDeliveryLogAsync(
                tenantId,
                user.Email,
                request.TemplateEventKey,
                "Skipped",
                null,
                "Credential email was skipped because the user is inactive.",
                cancellationToken);
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
            await WriteDeliveryLogAsync(
                tenantId,
                user.Email,
                request.TemplateEventKey,
                "Failed",
                "Not configured",
                "Credential email could not be sent because email settings are not configured.",
                cancellationToken);
            return new UserCredentialDeliveryResult(false, "NotConfigured", "Credential email could not be sent because email settings are not configured.");
        }

        if (!effectiveSettings.IsEnabled || string.Equals(effectiveSettings.Provider, EmailDeliveryMode.Disabled.ToString(), StringComparison.OrdinalIgnoreCase))
        {
            await WriteDeliveryLogAsync(
                tenantId,
                user.Email,
                request.TemplateEventKey,
                "Skipped",
                "Disabled",
                "Credential email could not be sent because email delivery is disabled.",
                cancellationToken);
            return new UserCredentialDeliveryResult(false, "NotConfigured", "Credential email could not be sent because email delivery is disabled.");
        }

        var delivery = CreateDeliveryOptions(effectiveSettings);
        if (delivery is null)
        {
            await WriteDeliveryLogAsync(
                tenantId,
                user.Email,
                request.TemplateEventKey,
                "Failed",
                "Not configured",
                "Credential email could not be sent because SMTP settings are incomplete.",
                cancellationToken);
            return new UserCredentialDeliveryResult(false, "NotConfigured", "Credential email could not be sent because SMTP settings are incomplete.");
        }

        try
        {
            var template = await emailTemplateService.RenderTenantTemplateAsync(
                tenantId,
                request.TemplateEventKey,
                EmailTemplateVariables.WithRecipientAndActorAliases(
                    user.FullName,
                    null,
                    new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
                    {
                        ["email"] = user.Email,
                        ["temporaryPassword"] = request.TemporaryPassword,
                        ["inviteLink"] = request.InviteLink,
                        ["resetPasswordLink"] = request.InviteLink,
                        ["resetLink"] = request.InviteLink,
                        ["loginUrl"] = request.LoginUrl,
                        ["companyName"] = tenant?.CompanyName ?? tenant?.Name ?? "Ecosys",
                        ["workspaceName"] = tenant?.Name ?? tenant?.CompanyName ?? "Ecosys Workspace",
                        ["tenantName"] = tenant?.Name ?? tenant?.CompanyName ?? "Ecosys Workspace",
                        ["platformName"] = "Ecosys",
                        ["supportEmail"] = supportEmail,
                    }),
                cancellationToken);
            var finalSubject = await emailSubjectRuleService.BuildFinalSubjectAsync(
                tenantId,
                ResolveEventKey(tenantId, request.TemplateEventKey),
                template.Subject,
                tenant?.Name ?? tenant?.CompanyName,
                cancellationToken);

            if (!template.Enabled)
            {
                await WriteDeliveryLogAsync(
                    tenantId,
                    user.Email,
                    request.TemplateEventKey,
                    "Skipped",
                    "Disabled",
                    "Credential email is disabled for this template.",
                    cancellationToken,
                    finalSubject);
                return new UserCredentialDeliveryResult(false, "Disabled", "Credential email is disabled for this template.");
            }

            await emailSender.SendAsync(
                new EmailMessage(
                    user.Email,
                    finalSubject,
                    template.HtmlBody,
                    template.SenderNameOverride ?? effectiveSettings.SenderName,
                    effectiveSettings.SenderAddress,
                    template.ReplyToOverride ?? effectiveSettings.ReplyToEmail,
                    IsHtml: true),
                delivery,
                cancellationToken);

            await WriteDeliveryLogAsync(
                tenantId,
                user.Email,
                request.TemplateEventKey,
                "Sent",
                null,
                null,
                cancellationToken,
                finalSubject,
                DateTime.UtcNow);
            return new UserCredentialDeliveryResult(true, "Sent", "User credentials sent.");
        }
        catch (Exception ex)
        {
            var errorCategory = ex is EmailDeliveryException emailDeliveryException
                ? emailDeliveryException.ErrorCategory
                : EmailErrorCategories.UnknownSmtpError;

            logger.LogWarning(
                ex,
                "Credential email failed for tenant {TenantId} and user {UserId}. Status {Status}.",
                tenantId,
                user.Id,
                errorCategory);

            await WriteDeliveryLogAsync(
                tenantId,
                user.Email,
                request.TemplateEventKey,
                "Failed",
                errorCategory,
                ex.Message,
                cancellationToken);

            var workspaceName = tenant?.CompanyName ?? tenant?.Name ?? "this workspace";
            return new UserCredentialDeliveryResult(false, "Failed", $"Credential email could not be sent for {workspaceName}. Please verify email settings and try again.");
        }
    }

    public async Task<UserCredentialDeliveryResult> SendPasswordResetLinkAsync(
        Guid tenantId,
        User user,
        PasswordResetLinkDeliveryRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!user.IsActive)
        {
            await WriteDeliveryLogAsync(
                tenantId,
                user.Email,
                "password-reset-link",
                "Skipped",
                null,
                "Password reset email was skipped because the user is inactive.",
                cancellationToken);
            return new UserCredentialDeliveryResult(false, "SkippedInactive", "Password reset email was skipped because the user is inactive.");
        }

        if (string.IsNullOrWhiteSpace(user.Email))
        {
            return new UserCredentialDeliveryResult(false, "MissingEmail", "Password reset email could not be sent because the user email address is missing.");
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
            await WriteDeliveryLogAsync(
                tenantId,
                user.Email,
                "password-reset-link",
                "Failed",
                "Not configured",
                "Password reset email could not be sent because email settings are not configured.",
                cancellationToken);
            return new UserCredentialDeliveryResult(false, "NotConfigured", "Password reset email could not be sent because email settings are not configured.");
        }

        if (!effectiveSettings.IsEnabled || string.Equals(effectiveSettings.Provider, EmailDeliveryMode.Disabled.ToString(), StringComparison.OrdinalIgnoreCase))
        {
            await WriteDeliveryLogAsync(
                tenantId,
                user.Email,
                "password-reset-link",
                "Skipped",
                "Disabled",
                "Password reset email could not be sent because email delivery is disabled.",
                cancellationToken);
            return new UserCredentialDeliveryResult(false, "NotConfigured", "Password reset email could not be sent because email delivery is disabled.");
        }

        var delivery = CreateDeliveryOptions(effectiveSettings);
        if (delivery is null)
        {
            await WriteDeliveryLogAsync(
                tenantId,
                user.Email,
                "password-reset-link",
                "Failed",
                "Not configured",
                "Password reset email could not be sent because SMTP settings are incomplete.",
                cancellationToken);
            return new UserCredentialDeliveryResult(false, "NotConfigured", "Password reset email could not be sent because SMTP settings are incomplete.");
        }

        try
        {
            var template = await emailTemplateService.RenderTenantTemplateAsync(
                tenantId,
                "password-reset-link",
                EmailTemplateVariables.WithRecipientAndActorAliases(
                    user.FullName,
                    null,
                    new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
                    {
                        ["platformName"] = "Ecosys",
                        ["resetLink"] = request.ResetLink,
                        ["supportEmail"] = supportEmail,
                        ["expiresAt"] = request.ExpiresAt.ToString("u"),
                    }),
                cancellationToken);
            var finalSubject = await emailSubjectRuleService.BuildFinalSubjectAsync(
                tenantId,
                "auth.password-reset.requested",
                template.Subject,
                tenant?.Name ?? tenant?.CompanyName,
                cancellationToken);

            if (!template.Enabled)
            {
                await WriteDeliveryLogAsync(
                    tenantId,
                    user.Email,
                    "password-reset-link",
                    "Skipped",
                    "Disabled",
                    "Password reset email is disabled for this template.",
                    cancellationToken,
                    finalSubject);
                return new UserCredentialDeliveryResult(false, "Disabled", "Password reset email is disabled for this template.");
            }

            await emailSender.SendAsync(
                new EmailMessage(
                    user.Email,
                    finalSubject,
                    template.HtmlBody,
                    template.SenderNameOverride ?? effectiveSettings.SenderName,
                    effectiveSettings.SenderAddress,
                    template.ReplyToOverride ?? effectiveSettings.ReplyToEmail,
                    IsHtml: true),
                delivery,
                cancellationToken);

            await WriteDeliveryLogAsync(
                tenantId,
                user.Email,
                "password-reset-link",
                "Sent",
                null,
                null,
                cancellationToken,
                finalSubject,
                DateTime.UtcNow);
            return new UserCredentialDeliveryResult(true, "Sent", "Password reset email sent.");
        }
        catch (Exception ex)
        {
            var errorCategory = ex is EmailDeliveryException emailDeliveryException
                ? emailDeliveryException.ErrorCategory
                : EmailErrorCategories.UnknownSmtpError;

            logger.LogWarning(
                ex,
                "Password reset email failed for tenant {TenantId} and user {UserId}. Status {Status}.",
                tenantId,
                user.Id,
                errorCategory);

            await WriteDeliveryLogAsync(
                tenantId,
                user.Email,
                "password-reset-link",
                "Failed",
                errorCategory,
                ex.Message,
                cancellationToken);

            return new UserCredentialDeliveryResult(false, "Failed", "Password reset email could not be sent. Please verify email settings and try again.");
        }
    }

    private Task WriteDeliveryLogAsync(
        Guid tenantId,
        string? recipientEmail,
        string templateKey,
        string status,
        string? errorCategory,
        string? errorMessage,
        CancellationToken cancellationToken,
        string? subject = null,
        DateTime? sentAt = null)
    {
        return emailDeliveryLogService.LogAsync(
            new EmailDeliveryLogWriteRequest(
                tenantId,
                ResolveEventKey(tenantId, templateKey),
                templateKey,
                string.IsNullOrWhiteSpace(recipientEmail) ? "unknown@local" : recipientEmail,
                string.IsNullOrWhiteSpace(subject) ? $"Credential delivery - {templateKey}" : subject,
                status,
                errorCategory,
                errorMessage,
                null,
                sentAt),
            cancellationToken);
    }

    private static string ResolveEventKey(Guid tenantId, string templateKey)
    {
        var isPlatform = tenantId == PlatformConstants.RootTenantId;
        return templateKey switch
        {
            "user-credentials" when isPlatform => "platform.user.created",
            "user-credentials" => "tenant.user.created",
            "resend-credentials" when isPlatform => "platform.user.credentials.resent",
            "resend-credentials" => "tenant.user.credentials.resent",
            "password-reset" => "user.password-reset.admin",
            "tenant-onboarding" => "tenant.onboarding",
            _ => templateKey,
        };
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

    private string ResolvePublicBaseUrl()
    {
        var configuredUrl = publicAppOptions.Value.PublicUrl?.Trim();
        if (!string.IsNullOrWhiteSpace(configuredUrl))
        {
            return configuredUrl.TrimEnd('/');
        }

        return ResolveBaseUrl();
    }
}
