using System.Net.Mail;
using System.Text.RegularExpressions;
using System.Security.Cryptography;
using Ecosys.Domain.Entities;
using Ecosys.Infrastructure.Data;
using Ecosys.Infrastructure.Services;
using Ecosys.Shared.Auth;
using Ecosys.Shared.Contracts.Integration;
using Ecosys.Shared.Errors;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ecosys.Api.Controllers;

[ApiController]
[Authorize(Policy = "PlatformAccess")]
[Route("api/platform/tenants")]
public sealed class PlatformTenantsController(
    AppDbContext dbContext,
    ITenantContext tenantContext,
    ILicenseGuardService licenseGuardService,
    IAuditLogService auditLogService,
    IEmailTemplateService emailTemplateService,
    IEmailSubjectRuleService emailSubjectRuleService,
    IEmailOutboxService emailOutboxService,
    IPasswordHasher<User> passwordHasher,
    IUserPermissionTemplateService permissionTemplateService,
    IUserCredentialDeliveryService credentialDeliveryService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<PlatformTenantListResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var tenants = await dbContext.Tenants
            .Include(x => x.TenantLicenses)
            .ThenInclude(x => x.LicensePlan)
            .Where(x => x.Id != PlatformConstants.RootTenantId)
            .OrderBy(x => x.CompanyName)
            .ToListAsync(cancellationToken);

        var tenantIds = tenants.Select(x => x.Id).ToArray();
        var userCounts = await dbContext.Users
            .Where(x => tenantIds.Contains(x.TenantId) && x.IsActive && x.Role != AppRoles.SuperAdmin)
            .GroupBy(x => x.TenantId)
            .Select(group => new { TenantId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(x => x.TenantId, x => x.Count, cancellationToken);

        var branchCounts = await dbContext.Branches
            .Where(x => tenantIds.Contains(x.TenantId) && x.IsActive)
            .GroupBy(x => x.TenantId)
            .Select(group => new { TenantId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(x => x.TenantId, x => x.Count, cancellationToken);

        var response = tenants
            .Select(tenant => MapListItem(
                tenant,
                userCounts.GetValueOrDefault(tenant.Id),
                branchCounts.GetValueOrDefault(tenant.Id)))
            .ToList();

        return Ok(response);
    }

    [HttpGet("{tenantId:guid}")]
    public async Task<ActionResult<PlatformTenantDetailResponse>> Get(Guid tenantId, CancellationToken cancellationToken)
    {
        var tenant = await LoadManagedTenantAsync(tenantId, cancellationToken);
        return Ok(await BuildDetailResponseAsync(tenant, cancellationToken));
    }

    [HttpPost]
    public async Task<ActionResult<PlatformTenantDetailResponse>> Create([FromBody] UpsertPlatformTenantRequest request, CancellationToken cancellationToken)
    {
        ValidateDefaultAdminRequest(request);
        await ValidateDefaultAdminAvailabilityAsync(request, cancellationToken);

        var tenant = new Tenant
        {
            CreatedByUserId = tenantContext.GetRequiredUserId()
        };

        dbContext.Tenants.Add(tenant);
        await ApplyTenantAsync(tenant, request, cancellationToken);
        await EnsureTenantSupportRecordsAsync(tenant, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        await CreateDefaultAdminAsync(tenant, request, cancellationToken);
        await WriteAuditAsync(tenant, "TenantCreated", $"Tenant '{tenant.Name}' was created.", cancellationToken);
        await TrySendOnboardingEmailAsync(tenant, cancellationToken);

        var response = await BuildDetailResponseAsync(tenant, cancellationToken);
        return CreatedAtAction(nameof(Get), new { tenantId = tenant.Id }, response);
    }

    [HttpPut("{tenantId:guid}")]
    public async Task<ActionResult<PlatformTenantDetailResponse>> Update(Guid tenantId, [FromBody] UpsertPlatformTenantRequest request, CancellationToken cancellationToken)
    {
        var tenant = await LoadManagedTenantAsync(tenantId, cancellationToken);
        tenant.UpdatedByUserId = tenantContext.GetRequiredUserId();

        await ApplyTenantAsync(tenant, request, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        await WriteAuditAsync(tenant, "platform.tenant.updated", $"Tenant '{tenant.Name}' was updated.", cancellationToken);

        return Ok(await BuildDetailResponseAsync(tenant, cancellationToken));
    }

    [HttpPatch("{tenantId:guid}/status")]
    public async Task<ActionResult<PlatformTenantDetailResponse>> UpdateStatus(Guid tenantId, [FromBody] UpdatePlatformTenantStatusRequest request, CancellationToken cancellationToken)
    {
        var status = NormalizeTenantStatus(request.Status);
        if ((status is PlatformTenantStatuses.Suspended or PlatformTenantStatuses.Inactive) && string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new BusinessRuleException("A reason is required when suspending or deactivating a tenant.");
        }

        var tenant = await SetTenantStatusAsync(tenantId, status, request.Reason, cancellationToken);
        return Ok(await BuildDetailResponseAsync(tenant, cancellationToken));
    }

    [HttpPost("{tenantId:guid}/activate")]
    public async Task<ActionResult<PlatformTenantDetailResponse>> Activate(Guid tenantId, CancellationToken cancellationToken)
    {
        var tenant = await SetTenantStatusAsync(tenantId, PlatformTenantStatuses.Active, null, cancellationToken);
        return Ok(await BuildDetailResponseAsync(tenant, cancellationToken));
    }

    [HttpPost("{tenantId:guid}/suspend")]
    public async Task<ActionResult<PlatformTenantDetailResponse>> Suspend(Guid tenantId, [FromBody] UpdatePlatformTenantStatusReasonRequest? request, CancellationToken cancellationToken)
    {
        var tenant = await SetTenantStatusAsync(tenantId, PlatformTenantStatuses.Suspended, request?.Reason, cancellationToken);
        return Ok(await BuildDetailResponseAsync(tenant, cancellationToken));
    }

    [HttpPost("{tenantId:guid}/deactivate")]
    public async Task<ActionResult<PlatformTenantDetailResponse>> DeactivatePost(Guid tenantId, [FromBody] UpdatePlatformTenantStatusReasonRequest? request, CancellationToken cancellationToken)
    {
        var tenant = await SetTenantStatusAsync(tenantId, PlatformTenantStatuses.Inactive, request?.Reason, cancellationToken);
        return Ok(await BuildDetailResponseAsync(tenant, cancellationToken));
    }

    [HttpDelete("{tenantId:guid}")]
    public async Task<IActionResult> Deactivate(Guid tenantId, CancellationToken cancellationToken)
    {
        await SetTenantStatusAsync(tenantId, PlatformTenantStatuses.Inactive, "Tenant deactivated by platform owner.", cancellationToken);
        return NoContent();
    }

    [HttpGet("{tenantId:guid}/summary")]
    public async Task<ActionResult<PlatformTenantSummaryResponse>> GetSummary(Guid tenantId, CancellationToken cancellationToken)
    {
        var tenant = await LoadManagedTenantAsync(tenantId, cancellationToken);
        var summary = await BuildSummaryResponseAsync(tenant, cancellationToken);
        return Ok(summary);
    }

    [HttpGet("{tenantId:guid}/audit-logs")]
    public async Task<ActionResult<IReadOnlyCollection<PlatformTenantAuditLogResponse>>> GetAuditLogs(Guid tenantId, CancellationToken cancellationToken)
    {
        _ = await LoadManagedTenantAsync(tenantId, cancellationToken);

        var auditLogs = await dbContext.AuditLogs
            .Include(x => x.User)
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(25)
            .Select(x => new PlatformTenantAuditLogResponse(
                x.Id,
                x.Action,
                x.User != null ? x.User.FullName : "Platform Owner",
                x.Details,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

        return Ok(auditLogs);
    }

    private async Task<Tenant> LoadManagedTenantAsync(Guid tenantId, CancellationToken cancellationToken) =>
        await dbContext.Tenants
            .Include(x => x.TenantLicenses)
            .ThenInclude(x => x.LicensePlan)
            .SingleOrDefaultAsync(x => x.Id == tenantId && x.Id != PlatformConstants.RootTenantId, cancellationToken)
        ?? throw new NotFoundException("Tenant was not found.");

    private async Task ApplyTenantAsync(Tenant tenant, UpsertPlatformTenantRequest request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var todayUtc = StartOfUtcDay(now);
        var trimmedName = NormalizeRequired(request.Name ?? request.CompanyName, "Company name is required.");
        var slug = await NormalizeAndValidateSlugAsync(request.Slug, trimmedName, tenant.Id, cancellationToken);
        var normalizedStatus = NormalizeTenantStatus(request.Status);
        var normalizedLicenseStatus = NormalizeLicenseStatus(request.LicenseStatus);
        var normalizedContactEmail = NormalizeEmail(request.ContactEmail);
        var normalizedTrialEndsAt = EnsureUtc(request.TrialEndsAt);
        var normalizedSubscriptionEndsAt = EnsureUtc(request.SubscriptionEndsAt);
        var normalizedStartsAt = EnsureUtc(request.StartsAt);
        var normalizedExpiresAt = EnsureUtc(request.ExpiresAt);

        ValidatePositive(request.MaxUsers, "Max users");
        ValidatePositive(request.MaxBranches, "Max branches");
        ValidateNotInPast(normalizedTrialEndsAt, todayUtc, "Trial end date");
        ValidateNotInPast(normalizedSubscriptionEndsAt, todayUtc, "Subscription end date");
        ValidateNotInPast(normalizedStartsAt, todayUtc, "License start date");
        ValidateNotInPast(normalizedExpiresAt, todayUtc, "License expiry date");

        var companyInUse = await dbContext.Tenants.AnyAsync(
            x => x.Id != tenant.Id
                && x.Id != PlatformConstants.RootTenantId
                && x.CompanyName.ToLower() == trimmedName.ToLower(),
            cancellationToken);
        if (companyInUse)
        {
            throw new BusinessRuleException("A tenant with this company name already exists.");
        }

        LicensePlan? plan = null;
        var requestedPlanName = NormalizeOptional(request.PlanName);
        if (!string.IsNullOrWhiteSpace(requestedPlanName))
        {
            plan = await dbContext.LicensePlans
                .SingleOrDefaultAsync(
                    x => x.IsActive && (x.PlanCode.ToLower() == requestedPlanName.ToLower() || x.DisplayName.ToLower() == requestedPlanName.ToLower()),
                    cancellationToken)
                ?? throw new BusinessRuleException("Plan name is invalid.");
        }

        tenant.Name = trimmedName;
        tenant.CompanyName = trimmedName;
        tenant.Slug = slug;
        tenant.ContactName = NormalizeOptional(request.ContactName);
        tenant.ContactEmail = normalizedContactEmail;
        tenant.ContactPhone = NormalizeOptional(request.ContactPhone);
        tenant.Email = normalizedContactEmail ?? tenant.Email ?? $"{slug}@tenant.local";
        tenant.Phone = tenant.ContactPhone;
        tenant.Country = NormalizeOptional(request.Country) ?? "Kenya";
        tenant.County = NormalizeOptional(request.County);
        tenant.City = NormalizeOptional(request.City);
        tenant.Address = NormalizeOptional(request.Address);
        tenant.TaxPin = NormalizeOptional(request.TaxPin);
        tenant.Status = normalizedStatus;
        tenant.PlanName = plan?.DisplayName ?? requestedPlanName;
        tenant.LicenseStatus = normalizedLicenseStatus;
        tenant.MaxUsers = request.MaxUsers;
        tenant.MaxBranches = request.MaxBranches;
        tenant.TrialEndsAt = normalizedTrialEndsAt;
        tenant.SubscriptionStartsAt = normalizedStartsAt ?? tenant.SubscriptionStartsAt ?? now;
        tenant.SubscriptionEndsAt = normalizedSubscriptionEndsAt;
        tenant.IsActive = ComputeIsActive(normalizedStatus, normalizedLicenseStatus);
        tenant.SuspendedAt = normalizedStatus == PlatformTenantStatuses.Suspended ? now : null;
        tenant.DeactivatedAt = normalizedStatus == PlatformTenantStatuses.Inactive ? now : null;
        tenant.DeactivatedByUserId = normalizedStatus == PlatformTenantStatuses.Inactive ? tenantContext.GetRequiredUserId() : null;
        tenant.DeactivationReason = normalizedStatus == PlatformTenantStatuses.Inactive ? tenant.DeactivationReason : null;
        tenant.CreatedByUserId ??= tenantContext.GetRequiredUserId();
        tenant.UpdatedByUserId = tenantContext.GetRequiredUserId();
        tenant.CreatedAt = EnsureUtc(tenant.CreatedAt);
        tenant.UpdatedAt = EnsureUtc(tenant.UpdatedAt);
        tenant.SubscriptionStartsAt = EnsureUtc(tenant.SubscriptionStartsAt);
        tenant.SuspendedAt = EnsureUtc(tenant.SuspendedAt);
        tenant.DeactivatedAt = EnsureUtc(tenant.DeactivatedAt);

        var license = await licenseGuardService.GetOrCreateTenantLicenseAsync(tenant.Id, cancellationToken);
        if (plan is not null)
        {
            license.LicensePlanId = plan.Id;
            license.LicensePlan = plan;
            tenant.PlanName = plan.DisplayName;
        }

        license.Status = normalizedLicenseStatus;
        license.StartsAt = normalizedStartsAt ?? tenant.SubscriptionStartsAt ?? license.StartsAt;
        license.TrialEndsAt = normalizedTrialEndsAt;
        license.ExpiresAt = normalizedExpiresAt ?? normalizedSubscriptionEndsAt;
        license.MaxUsersOverride = request.MaxUsers;
        license.MaxBranchesOverride = request.MaxBranches;
        license.SuspendedAt = normalizedLicenseStatus == PlatformTenantLicenseStatuses.Suspended ? now : null;
        license.CreatedAt = EnsureUtc(license.CreatedAt);
        license.UpdatedAt = EnsureUtc(license.UpdatedAt);
        license.StartsAt = EnsureUtc(license.StartsAt);
        license.TrialEndsAt = EnsureUtc(license.TrialEndsAt);
        license.ExpiresAt = EnsureUtc(license.ExpiresAt);
        license.SuspendedAt = EnsureUtc(license.SuspendedAt);
        license.CancelledAt = EnsureUtc(license.CancelledAt);

        if (string.IsNullOrWhiteSpace(tenant.PlanName) && license.LicensePlan is not null)
        {
            tenant.PlanName = license.LicensePlan.DisplayName;
        }
    }

    private async Task<string> NormalizeAndValidateSlugAsync(string? requestedSlug, string companyName, Guid currentTenantId, CancellationToken cancellationToken)
    {
        var slug = NormalizeSlug(string.IsNullOrWhiteSpace(requestedSlug) ? companyName : requestedSlug);
        var exists = await dbContext.Tenants.AnyAsync(x => x.Slug == slug && x.Id != currentTenantId, cancellationToken);
        if (exists)
        {
            throw new BusinessRuleException("This workspace URL name is already in use. Please choose another.");
        }

        return slug;
    }

    private async Task EnsureTenantSupportRecordsAsync(Tenant tenant, CancellationToken cancellationToken)
    {
        await licenseGuardService.GetOrCreateTenantLicenseAsync(tenant.Id, cancellationToken);

        if (!await dbContext.EmailSettings.AnyAsync(x => x.TenantId == tenant.Id, cancellationToken))
        {
            dbContext.EmailSettings.Add(new EmailSetting
            {
                TenantId = tenant.Id,
                UsePlatformDefaults = true,
                OverrideSmtpSettings = false,
                Host = "localhost",
                Port = 25,
                UseSsl = false,
                SenderName = tenant.Name,
                SenderAddress = tenant.ContactEmail ?? tenant.Email
            });
        }

        if (!await dbContext.NotificationSettings.AnyAsync(x => x.TenantId == tenant.Id, cancellationToken))
        {
            dbContext.NotificationSettings.Add(new NotificationSetting { TenantId = tenant.Id });
        }

        if (!await dbContext.MonitoringSettings.AnyAsync(x => x.TenantId == tenant.Id, cancellationToken))
        {
            dbContext.MonitoringSettings.Add(new MonitoringSetting { TenantId = tenant.Id });
        }

        if (!await dbContext.TenantSecurityPolicies.AnyAsync(x => x.TenantId == tenant.Id, cancellationToken))
        {
            dbContext.TenantSecurityPolicies.Add(new TenantSecurityPolicy { TenantId = tenant.Id });
        }
    }

    private async Task ValidateDefaultAdminAvailabilityAsync(UpsertPlatformTenantRequest request, CancellationToken cancellationToken)
    {
        if (!request.CreateDefaultAdmin)
        {
            return;
        }

        var normalizedAdminEmail = NormalizeEmail(request.AdminEmail)!;
        var emailInUse = await dbContext.Users.AnyAsync(x => x.Email.ToLower() == normalizedAdminEmail.ToLower(), cancellationToken);
        if (emailInUse)
        {
            throw new BusinessRuleException("Admin email is already in use.");
        }
    }

    private async Task CreateDefaultAdminAsync(Tenant tenant, UpsertPlatformTenantRequest request, CancellationToken cancellationToken)
    {
        if (!request.CreateDefaultAdmin)
        {
            return;
        }

        var adminEmail = NormalizeEmail(request.AdminEmail)!;
        var existingAdmin = await dbContext.Users.AnyAsync(
            x => x.TenantId == tenant.Id && x.Email.ToLower() == adminEmail.ToLower(),
            cancellationToken);
        if (existingAdmin)
        {
            return;
        }

        var password = GenerateTemporaryPassword();
        var permissions = permissionTemplateService.GetFullTenantPermissions();
        var adminUser = new User
        {
            TenantId = tenant.Id,
            FullName = NormalizeRequired(request.AdminFullName, "Admin full name is required when creating a default admin."),
            Email = adminEmail,
            Role = AppRoles.Admin,
            JobTitle = "Tenant Administrator",
            IsActive = true,
            HasAllBranchAccess = true,
            MustChangePassword = true,
            Permission = ToEntity(permissions),
        };
        adminUser.PasswordHash = passwordHasher.HashPassword(adminUser, password);

        dbContext.Users.Add(adminUser);
        await dbContext.SaveChangesAsync(cancellationToken);

        var delivery = await credentialDeliveryService.SendAsync(
            tenant.Id,
            adminUser,
            new UserCredentialDeliveryRequest(
                "user-credentials",
                credentialDeliveryService.BuildLoginUrl(),
                password,
                null,
                true),
            cancellationToken);

        if (delivery.Success)
        {
            adminUser.LastCredentialSentAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        await auditLogService.LogAsync(
            tenant.Id,
            tenantContext.GetRequiredUserId(),
            "User created",
            nameof(User),
            adminUser.Id.ToString(),
            $"Created default tenant admin '{adminUser.Email}'.",
            cancellationToken);

        if (delivery.Success)
        {
            await auditLogService.LogAsync(
                tenant.Id,
                tenantContext.GetRequiredUserId(),
                "User credentials sent",
                nameof(User),
                adminUser.Id.ToString(),
                $"User credentials sent to '{adminUser.Email}'.",
                cancellationToken);
        }
    }

    private async Task TrySendOnboardingEmailAsync(Tenant tenant, CancellationToken cancellationToken)
    {
        var recipient = NormalizeOptional(tenant.ContactEmail) ?? NormalizeOptional(tenant.Email);
        if (string.IsNullOrWhiteSpace(recipient))
        {
            return;
        }

        var platformEmail = await dbContext.EmailSettings.SingleOrDefaultAsync(x => x.TenantId == PlatformConstants.RootTenantId, cancellationToken);
        if (platformEmail is null || string.IsNullOrWhiteSpace(platformEmail.Host))
        {
            return;
        }

        var template = await emailTemplateService.RenderPlatformTemplateAsync(
            "tenant-onboarding",
            EmailTemplateVariables.WithRecipientAndActorAliases(
                tenant.ContactName ?? tenant.Name,
                tenantContext.Email,
                new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
                {
                    ["workspaceName"] = tenant.Name,
                    ["tenantName"] = tenant.Name,
                    ["companyName"] = tenant.CompanyName,
                    ["email"] = recipient,
                    ["loginUrl"] = BuildLoginUrl(),
                    ["supportEmail"] = platformEmail.ReplyToEmail ?? platformEmail.SenderAddress,
                    ["platformName"] = "Ecosys",
                }),
            cancellationToken);

        if (!template.Enabled)
        {
            return;
        }

        var finalSubject = await emailSubjectRuleService.BuildFinalSubjectAsync(
            tenant.Id,
            "tenant.onboarding",
            template.Subject,
            tenant.Name,
            cancellationToken);

        await emailOutboxService.QueueEmailAsync(
            new QueueEmailRequest(
                PlatformConstants.RootTenantId,
                "tenant.onboarding",
                "tenant-onboarding",
                recipient,
                tenant.ContactName ?? tenant.Name,
                template.SenderNameOverride ?? platformEmail.SenderName,
                platformEmail.SenderAddress,
                template.ReplyToOverride ?? platformEmail.ReplyToEmail,
                finalSubject,
                template.HtmlBody,
                template.TextBody,
                tenantContext.UserId),
            cancellationToken);
    }

    private string BuildLoginUrl()
    {
        var origin = Request.Headers.Origin.FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(origin))
        {
            return $"{origin.TrimEnd('/')}/login";
        }

        return $"{Request.Scheme}://{Request.Host.Value}".TrimEnd('/') + "/login";
    }

    private async Task<Tenant> SetTenantStatusAsync(Guid tenantId, string status, string? reason, CancellationToken cancellationToken)
    {
        var tenant = await LoadManagedTenantAsync(tenantId, cancellationToken);
        var now = DateTime.UtcNow;
        var normalizedReason = NormalizeOptional(reason);

        if ((status is PlatformTenantStatuses.Suspended or PlatformTenantStatuses.Inactive) && string.IsNullOrWhiteSpace(normalizedReason))
        {
            throw new BusinessRuleException("A reason is required when suspending or deactivating a tenant.");
        }

        var license = await licenseGuardService.GetOrCreateTenantLicenseAsync(tenant.Id, cancellationToken);
        tenant.Status = status;
        tenant.IsActive = status == PlatformTenantStatuses.Active;
        tenant.UpdatedByUserId = tenantContext.GetRequiredUserId();

        if (status == PlatformTenantStatuses.Active || status == PlatformTenantStatuses.Trial)
        {
            tenant.SuspendedAt = null;
            tenant.DeactivatedAt = null;
            tenant.DeactivatedByUserId = null;
            tenant.DeactivationReason = null;
            tenant.LicenseStatus = status == PlatformTenantStatuses.Trial
                ? PlatformTenantLicenseStatuses.Trial
                : ResolveLicenseStatus(tenant, license) == PlatformTenantLicenseStatuses.Expired
                    ? PlatformTenantLicenseStatuses.Expired
                    : PlatformTenantLicenseStatuses.Active;
            license.Status = tenant.LicenseStatus;
            license.SuspendedAt = null;
        }
        else if (status == PlatformTenantStatuses.Suspended)
        {
            tenant.SuspendedAt = now;
            tenant.DeactivatedAt = null;
            tenant.DeactivatedByUserId = null;
            tenant.DeactivationReason = normalizedReason;
            tenant.LicenseStatus = PlatformTenantLicenseStatuses.Suspended;
            license.Status = PlatformTenantLicenseStatuses.Suspended;
            license.SuspendedAt = now;
        }
        else
        {
            tenant.IsActive = false;
            tenant.DeactivatedAt = now;
            tenant.DeactivatedByUserId = tenantContext.GetRequiredUserId();
            tenant.DeactivationReason = normalizedReason;
            tenant.LicenseStatus = PlatformTenantLicenseStatuses.Cancelled;
            license.Status = PlatformTenantLicenseStatuses.Cancelled;
            license.CancelledAt = now;
            license.SuspendedAt = null;

            await dbContext.Assets
                .Where(x => x.TenantId == tenant.Id && x.Status != "Inactive")
                .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.Status, _ => "Inactive"), cancellationToken);
        }

        license.Notes = normalizedReason;
        await dbContext.SaveChangesAsync(cancellationToken);

        var auditAction = status switch
        {
            PlatformTenantStatuses.Active => "platform.tenant.activated",
            PlatformTenantStatuses.Trial => "platform.tenant.activated",
            PlatformTenantStatuses.Suspended => "platform.tenant.suspended",
            _ => "platform.tenant.deactivated"
        };

        await WriteAuditAsync(
            tenant,
            auditAction,
            string.IsNullOrWhiteSpace(normalizedReason)
                ? $"Tenant '{tenant.Name}' status changed to {status}."
                : $"Tenant '{tenant.Name}' status changed to {status}. Reason: {normalizedReason}",
            cancellationToken);

        return tenant;
    }

    private async Task<PlatformTenantDetailResponse> BuildDetailResponseAsync(Tenant tenant, CancellationToken cancellationToken)
    {
        var summary = await BuildSummaryResponseAsync(tenant, cancellationToken);

        return new PlatformTenantDetailResponse(
            tenant.Id,
            tenant.Name,
            tenant.Slug,
            NormalizeOptional(tenant.ContactName),
            NormalizeOptional(tenant.ContactEmail),
            NormalizeOptional(tenant.ContactPhone),
            NullIfWhiteSpace(tenant.Country),
            tenant.County,
            tenant.City,
            tenant.Address,
            tenant.TaxPin,
            ResolveTenantStatus(tenant),
            tenant.PlanName,
            ResolveLicenseStatus(tenant, tenant.TenantLicenses.OrderByDescending(x => x.CreatedAt).FirstOrDefault()),
            tenant.MaxUsers,
            tenant.MaxBranches,
            tenant.TrialEndsAt,
            tenant.SubscriptionStartsAt,
            tenant.SubscriptionEndsAt,
            tenant.CreatedAt,
            tenant.UpdatedAt,
            tenant.SuspendedAt,
            tenant.DeactivatedAt,
            tenant.CreatedByUserId,
            tenant.UpdatedByUserId,
            summary.UserCount,
            summary.BranchCount,
            summary.WorkOrderCount,
            summary.ActiveUsersNow,
            summary.LastActivityAt);
    }

    private async Task<PlatformTenantSummaryResponse> BuildSummaryResponseAsync(Tenant tenant, CancellationToken cancellationToken)
    {
        var userCount = await dbContext.Users.CountAsync(
            x => x.TenantId == tenant.Id && x.IsActive && x.Role != AppRoles.SuperAdmin,
            cancellationToken);
        var branchCount = await dbContext.Branches.CountAsync(x => x.TenantId == tenant.Id && x.IsActive, cancellationToken);
        var workOrderCount = await dbContext.WorkOrders.CountAsync(x => x.TenantId == tenant.Id, cancellationToken);

        var now = DateTime.UtcNow;
        var activeUsersNow = await dbContext.UserSessions
            .Where(x => x.TenantId == tenant.Id && !x.IsRevoked && !x.LogoutAt.HasValue && x.LastSeenAt >= now.AddMinutes(-15))
            .Select(x => x.UserId)
            .Distinct()
            .CountAsync(cancellationToken);

        var lastActivityAt = await dbContext.UserSessions
            .Where(x => x.TenantId == tenant.Id)
            .OrderByDescending(x => x.LastSeenAt)
            .Select(x => (DateTime?)x.LastSeenAt)
            .FirstOrDefaultAsync(cancellationToken);

        return new PlatformTenantSummaryResponse(
            tenant.Id,
            userCount,
            branchCount,
            workOrderCount,
            activeUsersNow,
            lastActivityAt);
    }

    private async Task WriteAuditAsync(Tenant tenant, string action, string details, CancellationToken cancellationToken)
    {
        await auditLogService.LogAsync(
            tenant.Id,
            tenantContext.GetRequiredUserId(),
            action,
            nameof(Tenant),
            tenant.Id.ToString(),
            details,
            cancellationToken);
    }

    private static PlatformTenantListResponse MapListItem(Tenant tenant, int userCount, int branchCount)
    {
        var license = tenant.TenantLicenses.OrderByDescending(x => x.CreatedAt).FirstOrDefault();

        return new PlatformTenantListResponse(
            tenant.Id,
            tenant.Name,
            tenant.Slug,
            tenant.ContactName,
            tenant.ContactEmail,
            tenant.PlanName,
            ResolveLicenseStatus(tenant, license),
            userCount,
            branchCount,
            ResolveTenantStatus(tenant),
            tenant.CreatedAt);
    }

    private static string ResolveTenantStatus(Tenant tenant)
    {
        if (!string.IsNullOrWhiteSpace(tenant.Status))
        {
            return tenant.Status;
        }

        return tenant.IsActive ? PlatformTenantStatuses.Active : PlatformTenantStatuses.Inactive;
    }

    private static string ResolveLicenseStatus(Tenant tenant, TenantLicense? license)
    {
        if (!string.IsNullOrWhiteSpace(tenant.LicenseStatus))
        {
            return tenant.LicenseStatus!;
        }

        if (license is null)
        {
            return PlatformTenantLicenseStatuses.Trial;
        }

        if (string.Equals(license.Status, PlatformTenantLicenseStatuses.Suspended, StringComparison.OrdinalIgnoreCase))
        {
            return PlatformTenantLicenseStatuses.Suspended;
        }

        if (string.Equals(license.Status, PlatformTenantLicenseStatuses.Expired, StringComparison.OrdinalIgnoreCase))
        {
            return PlatformTenantLicenseStatuses.Expired;
        }

        if (string.Equals(license.Status, PlatformTenantLicenseStatuses.Cancelled, StringComparison.OrdinalIgnoreCase))
        {
            return PlatformTenantLicenseStatuses.Cancelled;
        }

        var expiresAt = license.ExpiresAt ?? license.TrialEndsAt;
        if (expiresAt.HasValue && expiresAt.Value < DateTime.UtcNow)
        {
            return PlatformTenantLicenseStatuses.Expired;
        }

        return string.Equals(license.Status, PlatformTenantLicenseStatuses.Trial, StringComparison.OrdinalIgnoreCase)
            ? PlatformTenantLicenseStatuses.Trial
            : PlatformTenantLicenseStatuses.Active;
    }

    private static bool ComputeIsActive(string status, string licenseStatus) =>
        (status == PlatformTenantStatuses.Active || status == PlatformTenantStatuses.Trial)
        && licenseStatus != PlatformTenantLicenseStatuses.Suspended
        && licenseStatus != PlatformTenantLicenseStatuses.Cancelled;

    private static void ValidateNotInPast(DateTime? value, DateTime todayUtc, string label)
    {
        if (value.HasValue && value.Value < todayUtc)
        {
            throw new BusinessRuleException($"{label} cannot be earlier than today.");
        }
    }

    private static void ValidatePositive(int? value, string label)
    {
        if (value.HasValue && value.Value <= 0)
        {
            throw new BusinessRuleException($"{label} must be greater than zero.");
        }
    }

    private static string NormalizeRequired(string? value, string message)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new BusinessRuleException(message);
        }

        return value.Trim();
    }

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? NormalizeEmail(string? value)
    {
        var trimmed = NormalizeOptional(value);
        if (trimmed is null)
        {
            return null;
        }

        try
        {
            var mailAddress = new MailAddress(trimmed);
            return mailAddress.Address.ToLowerInvariant();
        }
        catch (FormatException)
        {
            throw new BusinessRuleException("Contact email must be a valid email address.");
        }
    }

    private static string NormalizeSlug(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new BusinessRuleException("Workspace URL name is required.");
        }

        var normalized = value
            .Trim()
            .ToLowerInvariant()
            .Replace("&", "-")
            .Replace("'", string.Empty);

        normalized = Regex.Replace(normalized, "[^a-z0-9-]+", "-");
        normalized = Regex.Replace(normalized, "-{2,}", "-").Trim('-');

        if (string.IsNullOrWhiteSpace(normalized))
        {
            throw new BusinessRuleException("Workspace URL name is required.");
        }

        if (normalized.Length < 3)
        {
            throw new BusinessRuleException("Workspace URL name must be at least 3 characters long.");
        }

        if (!Regex.IsMatch(normalized, "^[a-z0-9]+(?:-[a-z0-9]+)*$"))
        {
            throw new BusinessRuleException("Workspace URL name can only contain lowercase letters, numbers, and hyphens.");
        }

        return normalized;
    }

    private static string? NullIfWhiteSpace(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;

    private static string NormalizeTenantStatus(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return PlatformTenantStatuses.Active;
        }

        var normalized = value.Trim();
        return normalized.ToLowerInvariant() switch
        {
            "active" => PlatformTenantStatuses.Active,
            "suspended" => PlatformTenantStatuses.Suspended,
            "trial" => PlatformTenantStatuses.Trial,
            "inactive" => PlatformTenantStatuses.Inactive,
            _ => throw new BusinessRuleException("Status must be Active, Suspended, Trial, or Inactive.")
        };
    }

    private static string NormalizeLicenseStatus(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return PlatformTenantLicenseStatuses.Trial;
        }

        var normalized = value.Trim();
        return normalized.ToLowerInvariant() switch
        {
            "trial" => PlatformTenantLicenseStatuses.Trial,
            "active" => PlatformTenantLicenseStatuses.Active,
            "expired" => PlatformTenantLicenseStatuses.Expired,
            "suspended" => PlatformTenantLicenseStatuses.Suspended,
            "cancelled" => PlatformTenantLicenseStatuses.Cancelled,
            _ => throw new BusinessRuleException("License status must be Trial, Active, Expired, Suspended, or Cancelled.")
        };
    }

    private static void ValidateDefaultAdminRequest(UpsertPlatformTenantRequest request)
    {
        if (!request.CreateDefaultAdmin)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(request.AdminFullName))
        {
            throw new BusinessRuleException("Admin full name is required when creating a default admin.");
        }

        if (string.IsNullOrWhiteSpace(request.AdminEmail))
        {
            throw new BusinessRuleException("Admin email is required when creating a default admin.");
        }

        _ = NormalizeEmail(request.AdminEmail);
    }

    private static DateTime StartOfUtcDay(DateTime value) =>
        new(value.Year, value.Month, value.Day, 0, 0, 0, DateTimeKind.Utc);

    private static DateTime EnsureUtc(DateTime value)
    {
        if (value.Kind == DateTimeKind.Utc)
        {
            return value;
        }

        if (value.Kind == DateTimeKind.Unspecified)
        {
            return DateTime.SpecifyKind(value, DateTimeKind.Utc);
        }

        return value.ToUniversalTime();
    }

    private static DateTime? EnsureUtc(DateTime? value) =>
        value.HasValue ? EnsureUtc(value.Value) : null;

    private static UserPermission ToEntity(UserPermissionsModel permissions) =>
        new()
        {
            CanViewWorkOrders = permissions.CanViewWorkOrders,
            CanCreateWorkOrders = permissions.CanCreateWorkOrders,
            CanAssignWorkOrders = permissions.CanAssignWorkOrders,
            CanCompleteWorkOrders = permissions.CanCompleteWorkOrders,
            CanApproveMaterials = permissions.CanApproveMaterials,
            CanIssueMaterials = permissions.CanIssueMaterials,
            CanManageAssets = permissions.CanManageAssets,
            CanManageSettings = permissions.CanManageSettings,
            CanViewReports = permissions.CanViewReports,
        };

    private static string GenerateTemporaryPassword()
    {
        var buffer = RandomNumberGenerator.GetBytes(12);
        return $"Eco!{Convert.ToBase64String(buffer).Replace('+', 'A').Replace('/', 'B').TrimEnd('=').Substring(0, 12)}9";
    }

    private static class PlatformTenantStatuses
    {
        public const string Active = "Active";
        public const string Suspended = "Suspended";
        public const string Trial = "Trial";
        public const string Inactive = "Inactive";
    }

    private static class PlatformTenantLicenseStatuses
    {
        public const string Trial = "Trial";
        public const string Active = "Active";
        public const string Expired = "Expired";
        public const string Suspended = "Suspended";
        public const string Cancelled = "Cancelled";
    }
}

public sealed record UpsertPlatformTenantRequest(
    string? Name,
    string? CompanyName,
    string? Slug,
    string? ContactName,
    string? ContactEmail,
    string? ContactPhone,
    string? Country,
    string? County,
    string? City,
    string? Address,
    string? TaxPin,
    string? PlanName,
    int? MaxUsers,
    int? MaxBranches,
    DateTime? TrialEndsAt,
    DateTime? SubscriptionEndsAt,
    DateTime? StartsAt,
    DateTime? ExpiresAt,
    string? Status,
    string? LicenseStatus,
    bool CreateDefaultAdmin = false,
    string? AdminFullName = null,
    string? AdminEmail = null);

public sealed record UpdatePlatformTenantStatusRequest(string Status, string? Reason);
public sealed record UpdatePlatformTenantStatusReasonRequest(string? Reason);

public sealed record PlatformTenantListResponse(
    Guid TenantId,
    string Name,
    string Slug,
    string? ContactName,
    string? ContactEmail,
    string? PlanName,
    string LicenseStatus,
    int UserCount,
    int BranchCount,
    string Status,
    DateTime CreatedAt);

public sealed record PlatformTenantDetailResponse(
    Guid TenantId,
    string Name,
    string Slug,
    string? ContactName,
    string? ContactEmail,
    string? ContactPhone,
    string? Country,
    string? County,
    string? City,
    string? Address,
    string? TaxPin,
    string Status,
    string? PlanName,
    string LicenseStatus,
    int? MaxUsers,
    int? MaxBranches,
    DateTime? TrialEndsAt,
    DateTime? SubscriptionStartsAt,
    DateTime? SubscriptionEndsAt,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateTime? SuspendedAt,
    DateTime? DeactivatedAt,
    Guid? CreatedByUserId,
    Guid? UpdatedByUserId,
    int UserCount,
    int BranchCount,
    int WorkOrderCount,
    int ActiveUsersNow,
    DateTime? LastActivityAt);

public sealed record PlatformTenantSummaryResponse(
    Guid TenantId,
    int UserCount,
    int BranchCount,
    int WorkOrderCount,
    int ActiveUsersNow,
    DateTime? LastActivityAt);

public sealed record PlatformTenantAuditLogResponse(
    Guid Id,
    string Action,
    string Actor,
    string? Details,
    DateTime CreatedAt);
