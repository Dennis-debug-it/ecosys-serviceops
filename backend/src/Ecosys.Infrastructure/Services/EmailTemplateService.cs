using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Ecosys.Domain.Entities;
using Ecosys.Infrastructure.Data;
using Ecosys.Shared.Auth;
using Microsoft.EntityFrameworkCore;

namespace Ecosys.Infrastructure.Services;

public interface IEmailTemplateService
{
    Task<IReadOnlyCollection<EmailTemplateDescriptor>> ListPlatformTemplatesAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<EmailTemplateDescriptor>> ListTenantTemplatesAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<EmailTemplateDescriptor> GetPlatformTemplateAsync(string eventKey, CancellationToken cancellationToken = default);
    Task<EmailTemplateDescriptor> GetTenantTemplateAsync(Guid tenantId, string eventKey, CancellationToken cancellationToken = default);
    Task<EmailTemplateDescriptor> SavePlatformTemplateAsync(string eventKey, EmailTemplateUpdateRequest request, Guid actorUserId, CancellationToken cancellationToken = default);
    Task<EmailTemplateDescriptor> SaveTenantTemplateAsync(Guid tenantId, string eventKey, EmailTemplateUpdateRequest request, Guid actorUserId, CancellationToken cancellationToken = default);
    Task<EmailTemplateDescriptor> ResetPlatformTemplateAsync(string eventKey, CancellationToken cancellationToken = default);
    Task<EmailTemplateDescriptor> ResetTenantTemplateAsync(Guid tenantId, string eventKey, CancellationToken cancellationToken = default);
    Task<RenderedEmailTemplate> RenderPlatformTemplateAsync(string eventKey, IReadOnlyDictionary<string, string?> values, CancellationToken cancellationToken = default);
    Task<RenderedEmailTemplate> RenderTenantTemplateAsync(Guid tenantId, string eventKey, IReadOnlyDictionary<string, string?> values, CancellationToken cancellationToken = default);
}

public sealed record EmailTemplateDescriptor(
    string EventKey,
    string TemplateName,
    string Subject,
    string HtmlBody,
    string TextBody,
    bool Enabled,
    string? SenderNameOverride,
    string? ReplyToOverride,
    IReadOnlyCollection<string> AvailablePlaceholders,
    IReadOnlyCollection<string> RequiredPlaceholders,
    bool SupportsTenantOverride,
    bool IsOverride,
    string Source,
    Guid? LastUpdatedBy,
    DateTime? LastUpdatedAt);

public sealed record EmailTemplateUpdateRequest(
    string TemplateName,
    string Subject,
    string HtmlBody,
    string? TextBody,
    bool Enabled,
    string? SenderNameOverride,
    string? ReplyToOverride);

public sealed record RenderedEmailTemplate(
    string EventKey,
    string TemplateName,
    string Subject,
    string HtmlBody,
    string TextBody,
    string? SenderNameOverride,
    string? ReplyToOverride,
    bool Enabled);

internal sealed class EmailTemplateService(AppDbContext dbContext) : IEmailTemplateService
{
    private const string PlatformCategory = "email-templates:platform";
    private const string TenantCategoryPrefix = "email-templates:tenant:";
    private static readonly Regex PlaceholderRegex = new(@"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", RegexOptions.Compiled);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly IReadOnlyDictionary<string, BuiltInEmailTemplate> BuiltIns =
        new Dictionary<string, BuiltInEmailTemplate>(StringComparer.OrdinalIgnoreCase)
        {
            ["user-credentials"] = new(
                "user-credentials",
                "User credentials",
                "Your {{platformName}} account is ready",
                """
                <p>Hello {{fullName}},</p>
                <p>Your {{platformName}} account for {{companyName}} is ready.</p>
                <p><strong>Login URL:</strong> {{loginUrl}}<br />
                <strong>Username:</strong> {{email}}<br />
                <strong>Temporary Password:</strong> {{temporaryPassword}}</p>
                <p>For security, you will be asked to change your password after signing in.</p>
                <p>Regards,<br />{{supportEmail}}</p>
                """,
                """
                Hello {{fullName}},

                Your {{platformName}} account for {{companyName}} is ready.

                Login URL: {{loginUrl}}
                Username: {{email}}
                Temporary Password: {{temporaryPassword}}

                For security, you will be asked to change your password after signing in.

                Regards,
                {{supportEmail}}
                """,
                ["fullName", "companyName", "platformName", "loginUrl", "email", "temporaryPassword", "supportEmail"],
                ["fullName", "email", "loginUrl"],
                true),
            ["resend-credentials"] = new(
                "resend-credentials",
                "Credentials resent",
                "Your {{platformName}} sign-in details",
                """
                <p>Hello {{fullName}},</p>
                <p>Your Ecosys sign-in details have been refreshed.</p>
                <p><strong>Login URL:</strong> {{loginUrl}}<br />
                <strong>Username:</strong> {{email}}<br />
                <strong>Temporary Password:</strong> {{temporaryPassword}}</p>
                <p>For security, you will be asked to change your password after signing in.</p>
                <p>Regards,<br />{{supportEmail}}</p>
                """,
                """
                Hello {{fullName}},

                Your Ecosys sign-in details have been refreshed.

                Login URL: {{loginUrl}}
                Username: {{email}}
                Temporary Password: {{temporaryPassword}}

                For security, you will be asked to change your password after signing in.

                Regards,
                {{supportEmail}}
                """,
                ["fullName", "companyName", "platformName", "loginUrl", "email", "temporaryPassword", "supportEmail"],
                ["fullName", "email", "loginUrl"],
                true),
            ["password-reset"] = new(
                "password-reset",
                "Admin password reset",
                "Your {{platformName}} password was reset",
                """
                <p>Hello {{fullName}},</p>
                <p>Your {{platformName}} password has been reset by an administrator.</p>
                <p><strong>Login URL:</strong> {{loginUrl}}<br />
                <strong>Username:</strong> {{email}}<br />
                <strong>Temporary Password:</strong> {{temporaryPassword}}</p>
                <p>For security, you will be asked to change your password after signing in.</p>
                <p>Regards,<br />{{supportEmail}}</p>
                """,
                """
                Hello {{fullName}},

                Your {{platformName}} password has been reset by an administrator.

                Login URL: {{loginUrl}}
                Username: {{email}}
                Temporary Password: {{temporaryPassword}}

                For security, you will be asked to change your password after signing in.

                Regards,
                {{supportEmail}}
                """,
                ["fullName", "platformName", "loginUrl", "email", "temporaryPassword", "supportEmail"],
                ["fullName", "email", "loginUrl"],
                true),
            ["password-reset-link"] = new(
                "password-reset-link",
                "Self-service password reset",
                "Reset your {{platformName}} password",
                """
                <p>Hello {{fullName}},</p>
                <p>We received a request to reset your {{platformName}} password.</p>
                <p><a href="{{resetLink}}">Reset your password</a></p>
                <p>This link expires at {{expiresAt}}. If you did not request a reset, you can ignore this message.</p>
                <p>Need help? Contact {{supportEmail}}.</p>
                """,
                """
                Hello {{fullName}},

                We received a request to reset your {{platformName}} password.
                Reset your password: {{resetLink}}
                This link expires at {{expiresAt}}.
                Need help? Contact {{supportEmail}}.
                """,
                ["fullName", "platformName", "resetLink", "supportEmail", "expiresAt"],
                ["fullName", "resetLink"],
                true),
            ["workspace-request-received"] = new(
                "workspace-request-received",
                "Platform lead received",
                "New {{platformName}} workspace request from {{leadCompanyName}}",
                """
                <p>A new {{platformName}} workspace request has been submitted.</p>
                <p><strong>Company:</strong> {{leadCompanyName}}<br />
                <strong>Contact:</strong> {{contactName}}<br />
                <strong>Email:</strong> {{contactEmail}}<br />
                <strong>Phone:</strong> {{contactPhone}}<br />
                <strong>Industry:</strong> {{industry}}</p>
                <p><strong>Message:</strong><br />{{message}}</p>
                <p><strong>Submitted:</strong> {{submittedAt}}</p>
                """,
                """
                A new {{platformName}} workspace request has been submitted.

                Company: {{leadCompanyName}}
                Contact: {{contactName}}
                Email: {{contactEmail}}
                Phone: {{contactPhone}}
                Industry: {{industry}}
                Message: {{message}}
                Submitted: {{submittedAt}}
                """,
                ["platformName", "leadCompanyName", "contactName", "contactEmail", "contactPhone", "industry", "message", "submittedAt"],
                ["leadCompanyName", "contactName", "contactEmail"],
                false),
            ["tenant-onboarding"] = new(
                "tenant-onboarding",
                "Tenant welcome / onboarding",
                "Your {{platformName}} workspace is ready",
                """
                <p>Hello {{fullName}},</p>
                <p>Your {{platformName}} workspace for {{companyName}} is ready.</p>
                <p><strong>Tenant:</strong> {{tenantName}}<br />
                <strong>Login URL:</strong> {{loginUrl}}</p>
                <p>Contact {{supportEmail}} if you need help getting started.</p>
                """,
                """
                Hello {{fullName}},

                Your {{platformName}} workspace for {{companyName}} is ready.

                Tenant: {{tenantName}}
                Login URL: {{loginUrl}}

                Contact {{supportEmail}} if you need help getting started.

                Regards,
                {{supportEmail}}
                """,
                ["fullName", "companyName", "tenantName", "platformName", "loginUrl", "supportEmail"],
                ["fullName", "tenantName", "loginUrl"],
                false),
            ["test-email"] = new(
                "test-email",
                "Test email",
                "{{platformName}} email delivery test",
                "<p>Hello from {{platformName}}.</p><p>This test email was sent at {{sentAt}} by {{senderName}}.</p>",
                "Hello from {{platformName}}.\nThis test email was sent at {{sentAt}} by {{senderName}}.",
                ["platformName", "senderName", "sentAt"],
                [],
                false),
            ["work-order-assigned"] = new("work-order-assigned", "Work order assigned email", "Work order {{WorkOrderNumber}} assigned", "<p>Hello {{AssignedTo}},</p><p>Work order <strong>{{WorkOrderNumber}}</strong> has been assigned to you.</p><p><strong>Priority:</strong> {{Priority}}<br /><strong>Due Date:</strong> {{DueDate}}<br /><strong>Asset:</strong> {{AssetName}}</p>", "Hello {{AssignedTo}},\n\nWork order {{WorkOrderNumber}} has been assigned to you.\nPriority: {{Priority}}\nDue Date: {{DueDate}}\nAsset: {{AssetName}}", ["AssignedTo", "WorkOrderNumber", "Priority", "DueDate", "AssetName"], ["AssignedTo", "WorkOrderNumber"], true),
            ["pm-due"] = new("pm-due", "Preventive maintenance due", "Preventive maintenance due for {{assetName}}", "<p>Preventive maintenance is due for <strong>{{assetName}}</strong>.</p><p><strong>Assigned Group:</strong> {{fullName}}<br /><strong>Due Date:</strong> {{dueDate}}</p>", "Preventive maintenance is due for {{assetName}}.\nAssigned Group: {{fullName}}\nDue Date: {{dueDate}}", ["fullName", "assetName", "dueDate", "platformName"], ["assetName"], true),
            ["material-request"] = new("material-request", "Material request", "Material request submitted", "<p>A material request has been submitted.</p><p><strong>Work Order:</strong> {{workOrderNumber}}<br /><strong>Requested By:</strong> {{fullName}}</p>", "A material request has been submitted.\nWork Order: {{workOrderNumber}}\nRequested By: {{fullName}}", ["fullName", "workOrderNumber", "platformName"], ["workOrderNumber"], true),
            ["smtp-failure-alert"] = new("smtp-failure-alert", "SMTP failure alert", "{{platformName}} email delivery warning", "<p>An outbound email failure needs attention.</p><p><strong>Error:</strong> {{message}}</p>", "An outbound email failure needs attention.\nError: {{message}}", ["platformName", "message", "senderName"], ["message"], false),
            ["work-order-reassigned"] = new("work-order-reassigned", "Work order reassigned email", "Work order {{WorkOrderNumber}} reassigned", "<p>Hello {{AssignedTo}},</p><p>Work order <strong>{{WorkOrderNumber}}</strong> has been reassigned.</p><p><strong>Priority:</strong> {{Priority}}<br /><strong>Due Date:</strong> {{DueDate}}<br /><strong>Asset:</strong> {{AssetName}}</p>", "Hello {{AssignedTo}},\n\nWork order {{WorkOrderNumber}} has been reassigned.\nPriority: {{Priority}}\nDue Date: {{DueDate}}\nAsset: {{AssetName}}", ["AssignedTo", "WorkOrderNumber", "Priority", "DueDate", "AssetName"], ["AssignedTo", "WorkOrderNumber"], true),
            ["work-order-overdue"] = new("work-order-overdue", "Work order overdue/escalation email", "Work order {{WorkOrderNumber}} needs attention", "<p>Work order <strong>{{WorkOrderNumber}}</strong> requires attention.</p><p><strong>Assigned To:</strong> {{AssignedTo}}<br /><strong>Priority:</strong> {{Priority}}<br /><strong>Due Date:</strong> {{DueDate}}<br /><strong>Asset:</strong> {{AssetName}}</p>", "Work order {{WorkOrderNumber}} requires attention.\nAssigned To: {{AssignedTo}}\nPriority: {{Priority}}\nDue Date: {{DueDate}}\nAsset: {{AssetName}}", ["AssignedTo", "WorkOrderNumber", "Priority", "DueDate", "AssetName"], ["WorkOrderNumber"], true),
            ["work-order-completed"] = new("work-order-completed", "Work order completed/closed email", "Work order {{WorkOrderNumber}} completed", "<p>Work order <strong>{{WorkOrderNumber}}</strong> has been completed.</p><p><strong>Assigned To:</strong> {{AssignedTo}}<br /><strong>Asset:</strong> {{AssetName}}</p>", "Work order {{WorkOrderNumber}} has been completed.\nAssigned To: {{AssignedTo}}\nAsset: {{AssetName}}", ["AssignedTo", "WorkOrderNumber", "AssetName"], ["WorkOrderNumber"], true),
            ["pm-due-reminder"] = new("pm-due-reminder", "Preventive maintenance due reminder", "Preventive maintenance due for {{AssetName}}", "<p>Preventive maintenance is due for <strong>{{AssetName}}</strong>.</p><p><strong>Assigned To:</strong> {{AssignedTo}}<br /><strong>Due Date:</strong> {{DueDate}}</p>", "Preventive maintenance is due for {{AssetName}}.\nAssigned To: {{AssignedTo}}\nDue Date: {{DueDate}}", ["AssignedTo", "AssetName", "DueDate"], ["AssetName"], true),
            ["material-request-submitted"] = new("material-request-submitted", "Material request submitted", "Material request submitted for {{WorkOrderNumber}}", "<p>A material request was submitted.</p><p><strong>Work Order:</strong> {{WorkOrderNumber}}<br /><strong>Assigned To:</strong> {{AssignedTo}}</p>", "A material request was submitted.\nWork Order: {{WorkOrderNumber}}\nAssigned To: {{AssignedTo}}", ["AssignedTo", "WorkOrderNumber"], ["WorkOrderNumber"], true),
            ["material-request-approved-rejected"] = new("material-request-approved-rejected", "Material request approved/rejected", "Material request update for {{WorkOrderNumber}}", "<p>A material request has been updated.</p><p><strong>Work Order:</strong> {{WorkOrderNumber}}<br /><strong>Assigned To:</strong> {{AssignedTo}}</p>", "A material request has been updated.\nWork Order: {{WorkOrderNumber}}\nAssigned To: {{AssignedTo}}", ["AssignedTo", "WorkOrderNumber"], ["WorkOrderNumber"], true),
            ["smtp-test"] = new(
                "smtp-test",
                "SMTP test email",
                "Ecosys email delivery test",
                "<p>This is a test email from Ecosys.</p><p>If you received this message, outbound email delivery is working.</p>",
                "This is a test email from Ecosys.\nIf you received this message, outbound email delivery is working.",
                [],
                [],
                false),
        };

    public async Task<IReadOnlyCollection<EmailTemplateDescriptor>> ListPlatformTemplatesAsync(CancellationToken cancellationToken = default)
    {
        var stored = await LoadStoredTemplatesAsync(PlatformCategory, cancellationToken);
        return BuiltIns.Values.Select(item => ToDescriptor(item, stored.FirstOrDefault(x => Matches(x.EventKey, item.EventKey)), false)).ToList();
    }

    public async Task<IReadOnlyCollection<EmailTemplateDescriptor>> ListTenantTemplatesAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var platformTemplates = await LoadStoredTemplatesAsync(PlatformCategory, cancellationToken);
        var tenantTemplates = await LoadStoredTemplatesAsync(GetTenantCategory(tenantId), cancellationToken);
        return BuiltIns.Values.Select(item =>
            ToDescriptor(
                item,
                tenantTemplates.FirstOrDefault(x => Matches(x.EventKey, item.EventKey))
                ?? platformTemplates.FirstOrDefault(x => Matches(x.EventKey, item.EventKey)),
                tenantTemplates.Any(x => Matches(x.EventKey, item.EventKey))))
            .ToList();
    }

    public async Task<EmailTemplateDescriptor> GetPlatformTemplateAsync(string eventKey, CancellationToken cancellationToken = default)
    {
        var builtIn = GetBuiltIn(eventKey);
        var stored = await LoadStoredTemplatesAsync(PlatformCategory, cancellationToken);
        return ToDescriptor(builtIn, stored.FirstOrDefault(x => Matches(x.EventKey, builtIn.EventKey)), false);
    }

    public async Task<EmailTemplateDescriptor> GetTenantTemplateAsync(Guid tenantId, string eventKey, CancellationToken cancellationToken = default)
    {
        var builtIn = GetBuiltIn(eventKey);
        var platformTemplates = await LoadStoredTemplatesAsync(PlatformCategory, cancellationToken);
        var tenantTemplates = await LoadStoredTemplatesAsync(GetTenantCategory(tenantId), cancellationToken);
        var tenantTemplate = tenantTemplates.FirstOrDefault(x => Matches(x.EventKey, builtIn.EventKey));
        return ToDescriptor(builtIn, tenantTemplate ?? platformTemplates.FirstOrDefault(x => Matches(x.EventKey, builtIn.EventKey)), tenantTemplate is not null);
    }

    public async Task<EmailTemplateDescriptor> SavePlatformTemplateAsync(string eventKey, EmailTemplateUpdateRequest request, Guid actorUserId, CancellationToken cancellationToken = default)
    {
        var builtIn = GetBuiltIn(eventKey);
        ValidateTemplateUpdate(builtIn, request);
        var templates = await LoadStoredTemplatesAsync(PlatformCategory, cancellationToken);
        UpsertTemplate(templates, builtIn.EventKey, request, actorUserId);
        await SaveStoredTemplatesAsync(PlatformCategory, templates, cancellationToken);
        return await GetPlatformTemplateAsync(eventKey, cancellationToken);
    }

    public async Task<EmailTemplateDescriptor> SaveTenantTemplateAsync(Guid tenantId, string eventKey, EmailTemplateUpdateRequest request, Guid actorUserId, CancellationToken cancellationToken = default)
    {
        var builtIn = GetBuiltIn(eventKey);
        if (!builtIn.SupportsTenantOverride)
        {
            throw new Shared.Errors.BusinessRuleException("This email template can only be managed at platform level.");
        }

        ValidateTemplateUpdate(builtIn, request);
        var category = GetTenantCategory(tenantId);
        var templates = await LoadStoredTemplatesAsync(category, cancellationToken);
        UpsertTemplate(templates, builtIn.EventKey, request, actorUserId);
        await SaveStoredTemplatesAsync(category, templates, cancellationToken);
        return await GetTenantTemplateAsync(tenantId, eventKey, cancellationToken);
    }

    public async Task<EmailTemplateDescriptor> ResetPlatformTemplateAsync(string eventKey, CancellationToken cancellationToken = default)
    {
        var builtIn = GetBuiltIn(eventKey);
        var templates = await LoadStoredTemplatesAsync(PlatformCategory, cancellationToken);
        templates.RemoveAll(x => Matches(x.EventKey, builtIn.EventKey));
        await SaveStoredTemplatesAsync(PlatformCategory, templates, cancellationToken);
        return await GetPlatformTemplateAsync(eventKey, cancellationToken);
    }

    public async Task<EmailTemplateDescriptor> ResetTenantTemplateAsync(Guid tenantId, string eventKey, CancellationToken cancellationToken = default)
    {
        var builtIn = GetBuiltIn(eventKey);
        var category = GetTenantCategory(tenantId);
        var templates = await LoadStoredTemplatesAsync(category, cancellationToken);
        templates.RemoveAll(x => Matches(x.EventKey, builtIn.EventKey));
        await SaveStoredTemplatesAsync(category, templates, cancellationToken);
        return await GetTenantTemplateAsync(tenantId, eventKey, cancellationToken);
    }

    public async Task<RenderedEmailTemplate> RenderPlatformTemplateAsync(string eventKey, IReadOnlyDictionary<string, string?> values, CancellationToken cancellationToken = default)
    {
        var descriptor = await GetPlatformTemplateAsync(eventKey, cancellationToken);
        return Render(descriptor, values);
    }

    public async Task<RenderedEmailTemplate> RenderTenantTemplateAsync(Guid tenantId, string eventKey, IReadOnlyDictionary<string, string?> values, CancellationToken cancellationToken = default)
    {
        var descriptor = await GetTenantTemplateAsync(tenantId, eventKey, cancellationToken);
        return Render(descriptor, values);
    }

    private static RenderedEmailTemplate Render(EmailTemplateDescriptor descriptor, IReadOnlyDictionary<string, string?> values)
    {
        var safeValues = values.ToDictionary(
            item => item.Key,
            item => item.Value ?? string.Empty,
            StringComparer.OrdinalIgnoreCase);

        var renderedHtml = ReplacePlaceholders(descriptor.HtmlBody, safeValues, encodeHtml: true);
        var renderedText = ReplacePlaceholders(descriptor.TextBody, safeValues, encodeHtml: false);
        var renderedSubject = ReplacePlaceholders(descriptor.Subject, safeValues, encodeHtml: false);
        return new RenderedEmailTemplate(
            descriptor.EventKey,
            descriptor.TemplateName,
            renderedSubject,
            renderedHtml,
            renderedText,
            descriptor.SenderNameOverride,
            descriptor.ReplyToOverride,
            descriptor.Enabled);
    }

    private static string ReplacePlaceholders(string source, IReadOnlyDictionary<string, string> values, bool encodeHtml)
    {
        return PlaceholderRegex.Replace(source ?? string.Empty, match =>
        {
            var key = match.Groups[1].Value.Trim();
            if (!values.TryGetValue(key, out var value))
            {
                return string.Empty;
            }

            return encodeHtml ? WebUtility.HtmlEncode(value) : value;
        });
    }

    private static void ValidateTemplateUpdate(BuiltInEmailTemplate builtIn, EmailTemplateUpdateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.TemplateName))
        {
            throw new Shared.Errors.BusinessRuleException("Template name is required.");
        }

        if (string.IsNullOrWhiteSpace(request.Subject))
        {
            throw new Shared.Errors.BusinessRuleException("Subject is required.");
        }

        if (string.IsNullOrWhiteSpace(request.HtmlBody))
        {
            throw new Shared.Errors.BusinessRuleException("HTML body is required.");
        }

        foreach (var placeholder in builtIn.RequiredPlaceholders)
        {
            var token = $"{{{{{placeholder}}}}}";
            if (!request.Subject.Contains(token, StringComparison.OrdinalIgnoreCase)
                && !request.HtmlBody.Contains(token, StringComparison.OrdinalIgnoreCase)
                && !(request.TextBody?.Contains(token, StringComparison.OrdinalIgnoreCase) ?? false))
            {
                throw new Shared.Errors.BusinessRuleException($"The {builtIn.TemplateName} template must include {token}.");
            }
        }
    }

    private async Task<List<StoredEmailTemplate>> LoadStoredTemplatesAsync(string category, CancellationToken cancellationToken)
    {
        var row = await dbContext.PlatformSettings.SingleOrDefaultAsync(x => x.Category == category, cancellationToken);
        if (row is null || string.IsNullOrWhiteSpace(row.JsonValue))
        {
            return [];
        }

        return JsonSerializer.Deserialize<List<StoredEmailTemplate>>(row.JsonValue, JsonOptions) ?? [];
    }

    private async Task SaveStoredTemplatesAsync(string category, List<StoredEmailTemplate> templates, CancellationToken cancellationToken)
    {
        var row = await dbContext.PlatformSettings.SingleOrDefaultAsync(x => x.Category == category, cancellationToken);
        if (row is null)
        {
            dbContext.PlatformSettings.Add(new PlatformSetting
            {
                Category = category,
                JsonValue = JsonSerializer.Serialize(templates, JsonOptions)
            });
        }
        else
        {
            row.JsonValue = JsonSerializer.Serialize(templates, JsonOptions);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static void UpsertTemplate(List<StoredEmailTemplate> templates, string eventKey, EmailTemplateUpdateRequest request, Guid actorUserId)
    {
        var existing = templates.FirstOrDefault(x => Matches(x.EventKey, eventKey));
        if (existing is null)
        {
            templates.Add(new StoredEmailTemplate(
                eventKey,
                request.TemplateName.Trim(),
                request.Subject.Trim(),
                request.HtmlBody.Trim(),
                string.IsNullOrWhiteSpace(request.TextBody) ? StripHtml(request.HtmlBody) : request.TextBody.Trim(),
                request.Enabled,
                NormalizeOptional(request.SenderNameOverride),
                NormalizeOptional(request.ReplyToOverride),
                actorUserId,
                DateTime.UtcNow));
            return;
        }

        templates.Remove(existing);
        templates.Add(existing with
        {
            TemplateName = request.TemplateName.Trim(),
            Subject = request.Subject.Trim(),
            HtmlBody = request.HtmlBody.Trim(),
            TextBody = string.IsNullOrWhiteSpace(request.TextBody) ? StripHtml(request.HtmlBody) : request.TextBody.Trim(),
            Enabled = request.Enabled,
            SenderNameOverride = NormalizeOptional(request.SenderNameOverride),
            ReplyToOverride = NormalizeOptional(request.ReplyToOverride),
            LastUpdatedBy = actorUserId,
            LastUpdatedAt = DateTime.UtcNow,
        });
    }

    private static string NormalizeOptional(string? value) => string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim();

    private static string StripHtml(string value) => Regex.Replace(value ?? string.Empty, "<.*?>", string.Empty).Trim();

    private static bool Matches(string? left, string right) => string.Equals(left?.Trim(), right.Trim(), StringComparison.OrdinalIgnoreCase);

    private static BuiltInEmailTemplate GetBuiltIn(string eventKey) =>
        BuiltIns.TryGetValue(eventKey.Trim(), out var builtIn)
            ? builtIn
            : throw new Shared.Errors.NotFoundException("Email template was not found.");

    private static EmailTemplateDescriptor ToDescriptor(BuiltInEmailTemplate builtIn, StoredEmailTemplate? stored, bool isOverride)
    {
        var subject = stored?.Subject ?? builtIn.Subject;
        var htmlBody = stored?.HtmlBody ?? builtIn.HtmlBody;
        var textBody = stored?.TextBody ?? builtIn.TextBody;
        return new EmailTemplateDescriptor(
            builtIn.EventKey,
            stored?.TemplateName ?? builtIn.TemplateName,
            subject,
            htmlBody,
            textBody,
            stored?.Enabled ?? true,
            string.IsNullOrWhiteSpace(stored?.SenderNameOverride) ? null : stored!.SenderNameOverride,
            string.IsNullOrWhiteSpace(stored?.ReplyToOverride) ? null : stored!.ReplyToOverride,
            builtIn.AvailablePlaceholders,
            builtIn.RequiredPlaceholders,
            builtIn.SupportsTenantOverride,
            isOverride,
            stored is null ? "BuiltInFallback" : isOverride ? "TenantOverride" : "PlatformDefault",
            stored?.LastUpdatedBy,
            stored?.LastUpdatedAt);
    }

    private static string GetTenantCategory(Guid tenantId) => $"{TenantCategoryPrefix}{tenantId:D}";

    private sealed record BuiltInEmailTemplate(
        string EventKey,
        string TemplateName,
        string Subject,
        string HtmlBody,
        string TextBody,
        IReadOnlyCollection<string> AvailablePlaceholders,
        IReadOnlyCollection<string> RequiredPlaceholders,
        bool SupportsTenantOverride);

    private sealed record StoredEmailTemplate(
        string EventKey,
        string TemplateName,
        string Subject,
        string HtmlBody,
        string TextBody,
        bool Enabled,
        string? SenderNameOverride,
        string? ReplyToOverride,
        Guid? LastUpdatedBy,
        DateTime? LastUpdatedAt);
}
