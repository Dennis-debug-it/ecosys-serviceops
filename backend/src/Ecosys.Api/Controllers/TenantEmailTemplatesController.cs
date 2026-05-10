using Ecosys.Domain.Entities;
using Ecosys.Infrastructure.Data;
using Ecosys.Infrastructure.Services;
using Ecosys.Shared.Auth;
using Ecosys.Shared.Contracts.Integration;
using Ecosys.Shared.Errors;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ecosys.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/settings/email-templates")]
public sealed class TenantEmailTemplatesController(
    AppDbContext dbContext,
    ITenantContext tenantContext,
    IUserAccessService userAccessService,
    IEmailTemplateService emailTemplateService,
    ISecretEncryptionService secretEncryptionService,
    IEmailSender emailSender,
    IAuditLogService auditLogService) : TenantAwareControllerBase(tenantContext)
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<EmailTemplateResponse>>> List(CancellationToken cancellationToken)
    {
        userAccessService.EnsureAdmin();
        var templates = await emailTemplateService.ListTenantTemplatesAsync(TenantId, cancellationToken);
        return Ok(templates.Select(Map));
    }

    [HttpGet("{eventKey}")]
    public async Task<ActionResult<EmailTemplateResponse>> Get(string eventKey, CancellationToken cancellationToken)
    {
        userAccessService.EnsureAdmin();
        return Ok(Map(await emailTemplateService.GetTenantTemplateAsync(TenantId, eventKey, cancellationToken)));
    }

    [HttpPut("{eventKey}")]
    public async Task<ActionResult<EmailTemplateResponse>> Save(string eventKey, [FromBody] EmailTemplateUpsertRequest request, CancellationToken cancellationToken)
    {
        userAccessService.EnsureAdmin();
        var template = await emailTemplateService.SaveTenantTemplateAsync(
            TenantId,
            eventKey,
            new EmailTemplateUpdateRequest(
                request.TemplateName,
                request.Subject,
                request.HtmlBody,
                request.TextBody,
                request.Enabled,
                request.SenderNameOverride,
                request.ReplyToOverride),
            UserId,
            cancellationToken);

        await auditLogService.LogAsync(
            TenantId,
            UserId,
            "tenant.email-template.updated",
            nameof(PlatformSetting),
            eventKey,
            $"Tenant email template '{eventKey}' was updated.",
            cancellationToken);

        return Ok(Map(template));
    }

    [HttpPost("{eventKey}/preview")]
    public async Task<ActionResult<EmailTemplatePreviewResponse>> Preview(string eventKey, [FromBody] EmailTemplatePreviewRequest? request, CancellationToken cancellationToken)
    {
        userAccessService.EnsureAdmin();
        var rendered = await emailTemplateService.RenderTenantTemplateAsync(TenantId, eventKey, BuildSampleValues(request?.SampleData), cancellationToken);
        return Ok(new EmailTemplatePreviewResponse(rendered.EventKey, rendered.TemplateName, rendered.Subject, rendered.HtmlBody, rendered.TextBody));
    }

    [HttpPost("{eventKey}/test")]
    public async Task<ActionResult<EmailTemplateTestResponse>> SendTest(string eventKey, [FromBody] EmailTemplateTestRequest request, CancellationToken cancellationToken)
    {
        userAccessService.EnsureAdmin();
        var settings = await ResolveEffectiveEmailSettingsAsync(cancellationToken)
            ?? throw new BusinessRuleException("Email settings are not configured.");

        var rendered = await emailTemplateService.RenderTenantTemplateAsync(TenantId, eventKey, BuildSampleValues(request.SampleData), cancellationToken);
        if (!rendered.Enabled)
        {
            return Ok(new EmailTemplateTestResponse(false, "This email template is disabled."));
        }

        var recipient = string.IsNullOrWhiteSpace(request.TestRecipientEmail) ? settings.SenderAddress : request.TestRecipientEmail.Trim();
        if (string.IsNullOrWhiteSpace(recipient))
        {
            throw new BusinessRuleException("A test recipient email is required.");
        }

        await emailSender.SendAsync(
            new EmailMessage(
                recipient,
                rendered.Subject,
                rendered.HtmlBody,
                rendered.SenderNameOverride ?? settings.SenderName,
                settings.SenderAddress,
                rendered.ReplyToOverride ?? settings.ReplyToEmail,
                IsHtml: true),
            CreateDeliveryOptions(settings),
            cancellationToken);

        return Ok(new EmailTemplateTestResponse(true, null));
    }

    [HttpPost("{eventKey}/reset")]
    public async Task<ActionResult<EmailTemplateResponse>> Reset(string eventKey, CancellationToken cancellationToken)
    {
        userAccessService.EnsureAdmin();
        return Ok(Map(await emailTemplateService.ResetTenantTemplateAsync(TenantId, eventKey, cancellationToken)));
    }

    private async Task<EmailSetting?> ResolveEffectiveEmailSettingsAsync(CancellationToken cancellationToken)
    {
        var tenantSetting = await dbContext.EmailSettings.SingleOrDefaultAsync(x => x.TenantId == TenantId, cancellationToken);
        if (tenantSetting is not null && (!tenantSetting.UsePlatformDefaults || tenantSetting.OverrideSmtpSettings))
        {
            return tenantSetting;
        }

        return await dbContext.EmailSettings.SingleOrDefaultAsync(x => x.TenantId == PlatformConstants.RootTenantId, cancellationToken);
    }

    private EmailDeliverySettings CreateDeliveryOptions(EmailSetting settings)
    {
        var secret = secretEncryptionService.Decrypt(settings.EncryptedSecret) ?? settings.Password;
        return new EmailDeliverySettings(
            Enum.TryParse<EmailDeliveryMode>(settings.Provider, true, out var mode) ? mode : EmailDeliveryMode.Smtp,
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

    private static Dictionary<string, string?> BuildSampleValues(IReadOnlyDictionary<string, string?>? sampleData)
    {
        var values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["FullName"] = "Jane Doe",
            ["fullName"] = "Jane Doe",
            ["Email"] = "jane.doe@example.com",
            ["email"] = "jane.doe@example.com",
            ["TemporaryPassword"] = "Eco!TempPass9",
            ["temporaryPassword"] = "Eco!TempPass9",
            ["InviteLink"] = "https://app.example.com/accept-invite?token=sample",
            ["ResetPasswordLink"] = "https://app.example.com/reset-password?token=sample",
            ["resetLink"] = "https://app.example.com/reset-password?token=sample",
            ["LoginUrl"] = "https://app.example.com/login",
            ["loginUrl"] = "https://app.example.com/login",
            ["CompanyName"] = "Acme Facilities Ltd",
            ["companyName"] = "Acme Facilities Ltd",
            ["WorkspaceName"] = "Acme Facilities Ltd",
            ["TenantName"] = "Acme Facilities Ltd",
            ["tenantName"] = "Acme Facilities Ltd",
            ["platformName"] = "Ecosys ServiceOps",
            ["WorkOrderNumber"] = "WO-000123",
            ["workOrderNumber"] = "WO-000123",
            ["AssetName"] = "Generator 250kVA",
            ["assetName"] = "Generator 250kVA",
            ["AssignedTo"] = "Alex Kimani",
            ["assignedTo"] = "Alex Kimani",
            ["Priority"] = "High",
            ["priority"] = "High",
            ["DueDate"] = DateTime.UtcNow.AddDays(2).ToString("yyyy-MM-dd"),
            ["dueDate"] = DateTime.UtcNow.AddDays(2).ToString("yyyy-MM-dd"),
            ["SupportEmail"] = "support@ecosysdigital.co.ke",
            ["supportEmail"] = "support@ecosysdigital.co.ke",
            ["senderName"] = "Ecosys ServiceOps",
            ["sentAt"] = DateTime.UtcNow.ToString("u"),
            ["Phone"] = "+254700000001",
            ["contactPhone"] = "+254700000001",
            ["Country"] = "Kenya",
            ["Industry"] = "Facilities",
            ["industry"] = "Facilities",
            ["Message"] = "We need help onboarding our team.",
            ["message"] = "We need help onboarding our team.",
            ["leadCompanyName"] = "Acme Facilities Ltd",
            ["contactName"] = "Jane Doe",
            ["contactEmail"] = "jane.doe@example.com",
            ["submittedAt"] = DateTime.UtcNow.ToString("u"),
            ["expiresAt"] = DateTime.UtcNow.AddHours(1).ToString("u")
        };

        if (sampleData is not null)
        {
            foreach (var item in sampleData)
            {
                values[item.Key] = item.Value;
            }
        }

        return values;
    }

    private static EmailTemplateResponse Map(EmailTemplateDescriptor template) =>
        new(
            template.EventKey,
            template.TemplateName,
            template.Subject,
            template.HtmlBody,
            template.TextBody,
            template.Enabled,
            template.SenderNameOverride,
            template.ReplyToOverride,
            template.AvailablePlaceholders.ToList(),
            template.RequiredPlaceholders.ToList(),
            template.SupportsTenantOverride,
            template.IsOverride,
            template.Source,
            template.LastUpdatedBy,
            template.LastUpdatedAt);
}
