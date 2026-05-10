using Ecosys.Api.Controllers;
using Ecosys.Domain.Entities;
using Ecosys.Infrastructure.Data;
using Ecosys.Infrastructure.Services;
using Ecosys.Shared.Auth;
using Ecosys.Shared.Contracts.Integration;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ecosys.Tests;

public sealed class AuthEmailSafetyTests
{
    [Fact]
    public async Task TenantResendCredentials_Success_UpdatesPasswordAndWritesSentLog()
    {
        await using var dbContext = CreateDbContext();
        var tenantId = Guid.NewGuid();
        var user = await SeedTenantUserAsync(dbContext, tenantId, "operator@tenant.test", mustChangePassword: false);
        var originalHash = user.PasswordHash;

        var controller = CreateUsersController(dbContext, tenantId, new FakeUserCredentialDeliveryService(dbContext, credentialSendSucceeds: true));

        var actionResult = await controller.ResendCredentials(user.Id, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(actionResult.Result);
        var response = Assert.IsType<CredentialDeliveryResponse>(ok.Value);
        Assert.True(response.Success);

        var updatedUser = await dbContext.Users.SingleAsync(x => x.Id == user.Id);
        Assert.NotEqual(originalHash, updatedUser.PasswordHash);
        Assert.True(updatedUser.MustChangePassword);
        Assert.NotNull(updatedUser.LastCredentialSentAt);

        var log = await dbContext.EmailDeliveryLogs.SingleAsync(x => x.RecipientEmail == user.Email);
        Assert.Equal("Sent", log.Status);
        Assert.Equal("resend-credentials", log.TemplateKey);
    }

    [Fact]
    public async Task TenantResendCredentials_Failure_DoesNotChangePasswordAndWritesFailedLog()
    {
        await using var dbContext = CreateDbContext();
        var tenantId = Guid.NewGuid();
        var user = await SeedTenantUserAsync(dbContext, tenantId, "dispatcher@tenant.test", mustChangePassword: false);
        var originalHash = user.PasswordHash;
        var originalMustChangePassword = user.MustChangePassword;

        var controller = CreateUsersController(dbContext, tenantId, new FakeUserCredentialDeliveryService(dbContext, credentialSendSucceeds: false));

        var actionResult = await controller.ResendCredentials(user.Id, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(actionResult.Result);
        var response = Assert.IsType<CredentialDeliveryResponse>(ok.Value);
        Assert.False(response.Success);
        Assert.Equal("Credentials could not be sent. The user's existing password was not changed.", response.Message);

        var updatedUser = await dbContext.Users.SingleAsync(x => x.Id == user.Id);
        Assert.Equal(originalHash, updatedUser.PasswordHash);
        Assert.Equal(originalMustChangePassword, updatedUser.MustChangePassword);
        Assert.Null(updatedUser.LastCredentialSentAt);

        var log = await dbContext.EmailDeliveryLogs.SingleAsync(x => x.RecipientEmail == user.Email);
        Assert.Equal("Failed", log.Status);
        Assert.Equal("resend-credentials", log.TemplateKey);
    }

    [Fact]
    public async Task PlatformResendCredentials_Failure_DoesNotChangePassword()
    {
        await using var dbContext = CreateDbContext();
        var user = await SeedPlatformUserAsync(dbContext, "platform.user@ecosys.test");
        var originalHash = user.PasswordHash;

        var controller = CreatePlatformUsersController(dbContext, new FakeUserCredentialDeliveryService(dbContext, credentialSendSucceeds: false));

        var actionResult = await controller.ResendCredentials(user.Id, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(actionResult.Result);
        var response = Assert.IsType<PlatformResetPasswordResponse>(ok.Value);
        Assert.False(response.Success);
        Assert.Equal("Credentials could not be sent. The user's existing password was not changed.", response.Message);

        var updatedUser = await dbContext.Users.SingleAsync(x => x.Id == user.Id);
        Assert.Equal(originalHash, updatedUser.PasswordHash);
        Assert.Null(updatedUser.LastCredentialSentAt);
    }

    [Fact]
    public async Task TenantCreateUser_EmailFailure_StillCreatesUser()
    {
        await using var dbContext = CreateDbContext();
        var tenantId = Guid.NewGuid();
        await SeedTenantAsync(dbContext, tenantId, "Acme", "admin@acme.test");

        var controller = CreateUsersController(dbContext, tenantId, new FakeUserCredentialDeliveryService(dbContext, credentialSendSucceeds: false));

        var request = new CreateUserRequest(
            "New User",
            "new.user@acme.test",
            null,
            null,
            AppRoles.User,
            null,
            null,
            true,
            "TemporaryPassword",
            null,
            [],
            null,
            false,
            []);

        var actionResult = await controller.Create(request, CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(actionResult.Result);
        var response = Assert.IsType<UserResponse>(created.Value);
        Assert.Equal("new.user@acme.test", response.Email);
        Assert.False(response.CredentialDelivery?.Success ?? true);

        var createdUser = await dbContext.Users.SingleAsync(x => x.Email == "new.user@acme.test");
        Assert.NotEqual(Guid.Empty, createdUser.Id);

        var log = await dbContext.EmailDeliveryLogs.SingleAsync(x => x.RecipientEmail == createdUser.Email);
        Assert.Equal("Failed", log.Status);
    }

    [Fact]
    public async Task ForgotPassword_ReturnsGenericMessage_ForExistingUser_AndStoresHashedToken()
    {
        await using var dbContext = CreateDbContext();
        var tenantId = Guid.NewGuid();
        var user = await SeedTenantUserAsync(dbContext, tenantId, "existing@tenant.test", mustChangePassword: false);
        var service = CreatePasswordResetService(dbContext, new FakeUserCredentialDeliveryService(dbContext, credentialSendSucceeds: true, resetSendSucceeds: true));

        var message = await service.RequestAsync(user.Email, CancellationToken.None);

        Assert.Equal("If an account exists for this email, password reset instructions will be sent shortly.", message);

        var token = await dbContext.PasswordResetTokens.SingleAsync(x => x.UserId == user.Id);
        Assert.NotEmpty(token.TokenHash);
        Assert.DoesNotContain("existing", token.TokenHash, StringComparison.OrdinalIgnoreCase);

        var log = await dbContext.EmailDeliveryLogs.SingleAsync(x => x.TemplateKey == "password-reset-link");
        Assert.Equal("Sent", log.Status);
    }

    [Fact]
    public async Task ForgotPassword_ReturnsSameGenericMessage_ForMissingUser()
    {
        await using var dbContext = CreateDbContext();
        var service = CreatePasswordResetService(dbContext, new FakeUserCredentialDeliveryService(dbContext, credentialSendSucceeds: true, resetSendSucceeds: true));

        var message = await service.RequestAsync("missing@tenant.test", CancellationToken.None);

        Assert.Equal("If an account exists for this email, password reset instructions will be sent shortly.", message);
        Assert.Empty(await dbContext.PasswordResetTokens.ToListAsync());
    }

    [Fact]
    public async Task ResetPassword_Succeeds_WithValidToken_AndRevokesSessions()
    {
        await using var dbContext = CreateDbContext();
        var tenantId = Guid.NewGuid();
        var user = await SeedTenantUserAsync(dbContext, tenantId, "resetme@tenant.test", mustChangePassword: true);
        dbContext.UserSessions.Add(new UserSession
        {
            TenantId = tenantId,
            UserId = user.Id,
            LoginAt = DateTime.UtcNow,
            LastSeenAt = DateTime.UtcNow,
            IsRevoked = false
        });
        var rawToken = "valid-reset-token";
        dbContext.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = ToTokenHash(rawToken),
            ExpiresAt = DateTime.UtcNow.AddMinutes(30)
        });
        await dbContext.SaveChangesAsync();

        var originalHash = user.PasswordHash;
        var service = CreatePasswordResetService(dbContext, new FakeUserCredentialDeliveryService(dbContext, credentialSendSucceeds: true, resetSendSucceeds: true));

        var message = await service.ResetAsync(rawToken, "NewStrongPass123!", "NewStrongPass123!", CancellationToken.None);

        Assert.Equal("Your password has been reset. You can now sign in.", message);

        var updatedUser = await dbContext.Users.SingleAsync(x => x.Id == user.Id);
        Assert.NotEqual(originalHash, updatedUser.PasswordHash);
        Assert.False(updatedUser.MustChangePassword);

        var token = await dbContext.PasswordResetTokens.SingleAsync(x => x.UserId == user.Id);
        Assert.NotNull(token.UsedAt);

        var session = await dbContext.UserSessions.SingleAsync(x => x.UserId == user.Id);
        Assert.True(session.IsRevoked);
    }

    [Fact]
    public async Task ResetPassword_RejectsExpiredOrUsedTokens_AndPasswordMismatch()
    {
        await using var dbContext = CreateDbContext();
        var tenantId = Guid.NewGuid();
        var user = await SeedTenantUserAsync(dbContext, tenantId, "expired@tenant.test", mustChangePassword: true);
        dbContext.PasswordResetTokens.AddRange(
            new PasswordResetToken
            {
                UserId = user.Id,
                TokenHash = ToTokenHash("expired-token"),
                ExpiresAt = DateTime.UtcNow.AddMinutes(-5)
            },
            new PasswordResetToken
            {
                UserId = user.Id,
                TokenHash = ToTokenHash("used-token"),
                ExpiresAt = DateTime.UtcNow.AddMinutes(30),
                UsedAt = DateTime.UtcNow.AddMinutes(-1)
            });
        await dbContext.SaveChangesAsync();

        var service = CreatePasswordResetService(dbContext, new FakeUserCredentialDeliveryService(dbContext, credentialSendSucceeds: true, resetSendSucceeds: true));

        await Assert.ThrowsAsync<Shared.Errors.BusinessRuleException>(() =>
            service.ResetAsync("expired-token", "Mismatch123!", "Different123!", CancellationToken.None));

        await Assert.ThrowsAsync<Shared.Errors.ForbiddenException>(() =>
            service.ResetAsync("expired-token", "NewStrongPass123!", "NewStrongPass123!", CancellationToken.None));

        await Assert.ThrowsAsync<Shared.Errors.ForbiddenException>(() =>
            service.ResetAsync("used-token", "NewStrongPass123!", "NewStrongPass123!", CancellationToken.None));
    }

    private static UsersController CreateUsersController(AppDbContext dbContext, Guid tenantId, FakeUserCredentialDeliveryService deliveryService)
    {
        return new UsersController(
            dbContext,
            new FakeTenantContext(tenantId, Guid.NewGuid(), isAdmin: true),
            new NoOpUserAccessService(),
            new FakeUserPermissionTemplateService(),
            new PasswordHasher<User>(),
            new NoOpLicenseGuardService(),
            new FakeTenantSecurityPolicyService(),
            new NoOpAuditLogService(),
            deliveryService,
            new TemporaryPasswordService());
    }

    private static PlatformUsersController CreatePlatformUsersController(AppDbContext dbContext, FakeUserCredentialDeliveryService deliveryService)
    {
        return new PlatformUsersController(
            dbContext,
            new FakeTenantContext(PlatformConstants.RootTenantId, Guid.NewGuid(), isAdmin: true, isSuperAdmin: true),
            new NoOpAuditLogService(),
            new PasswordHasher<User>(),
            deliveryService,
            new TemporaryPasswordService());
    }

    private static PasswordResetService CreatePasswordResetService(AppDbContext dbContext, FakeUserCredentialDeliveryService deliveryService)
    {
        return new PasswordResetService(
            dbContext,
            new HttpContextAccessor { HttpContext = new DefaultHttpContext() },
            new PasswordHasher<User>(),
            new FakeTenantSecurityPolicyService(),
            new FakeUserSessionService(dbContext),
            deliveryService,
            new NoOpAuditLogService());
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"ecosys-tests-{Guid.NewGuid():N}")
            .Options;

        return new AppDbContext(options);
    }

    private static async Task SeedTenantAsync(AppDbContext dbContext, Guid tenantId, string companyName, string email)
    {
        dbContext.Tenants.Add(new Tenant
        {
            Id = tenantId,
            Name = companyName,
            Slug = companyName.ToLowerInvariant(),
            CompanyName = companyName,
            Email = email,
            ContactEmail = email,
            Country = "Kenya",
            Status = "Active",
            LicenseStatus = "Active",
            PrimaryColor = "#0F4C81",
            SecondaryColor = "#F4B942",
            IsActive = true
        });

        dbContext.EmailSettings.Add(new EmailSetting
        {
            TenantId = tenantId,
            IsEnabled = true,
            Provider = EmailDeliveryMode.Smtp.ToString(),
            Host = "smtp.local.test",
            Port = 587,
            SenderName = companyName,
            SenderAddress = email,
            ReplyToEmail = email
        });

        await dbContext.SaveChangesAsync();
    }

    private static async Task<User> SeedTenantUserAsync(AppDbContext dbContext, Guid tenantId, string email, bool mustChangePassword)
    {
        await SeedTenantAsync(dbContext, tenantId, "Tenant Workspace", "support@tenant.test");
        var user = new User
        {
            TenantId = tenantId,
            FullName = "Tenant User",
            Email = email,
            Role = AppRoles.Admin,
            IsActive = true,
            MustChangePassword = mustChangePassword
        };
        user.PasswordHash = new PasswordHasher<User>().HashPassword(user, "OriginalPass123!");
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();
        return user;
    }

    private static async Task<User> SeedPlatformUserAsync(AppDbContext dbContext, string email)
    {
        await SeedTenantAsync(dbContext, PlatformConstants.RootTenantId, "Ecosys Platform", "superadmin@ecosys.local");
        var user = new User
        {
            TenantId = PlatformConstants.RootTenantId,
            FullName = "Platform User",
            Email = email,
            Role = AppRoles.PlatformAdmin,
            IsActive = true,
            MustChangePassword = false,
            HasAllBranchAccess = true
        };
        user.PasswordHash = new PasswordHasher<User>().HashPassword(user, "OriginalPass123!");
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();
        return user;
    }

    private static string ToTokenHash(string rawToken)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(rawToken);
        return Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes));
    }

    private sealed class FakeTenantContext : ITenantContext
    {
        public FakeTenantContext(Guid tenantId, Guid userId, bool isAdmin, bool isSuperAdmin = false)
        {
            TenantId = tenantId;
            UserId = userId;
            SessionId = Guid.NewGuid();
            IsAdmin = isAdmin;
            IsSuperAdmin = isSuperAdmin;
        }

        public Guid? TenantId { get; }
        public Guid? UserId { get; }
        public Guid? SessionId { get; }
        public string? Email => "tester@ecosys.local";
        public string? Role => IsSuperAdmin ? AppRoles.SuperAdmin : AppRoles.Admin;
        public string? JobTitle => null;
        public bool IsAuthenticated => true;
        public bool IsSuperAdmin { get; }
        public bool IsAdmin { get; }
        public bool HasRole(string role) => string.Equals(Role, role, StringComparison.OrdinalIgnoreCase);
        public bool HasPermission(string permissionName) => true;
        public Guid GetRequiredTenantId() => TenantId!.Value;
        public Guid GetRequiredUserId() => UserId!.Value;
        public Guid GetRequiredSessionId() => SessionId!.Value;
    }

    private sealed class FakeTenantSecurityPolicyService : ITenantSecurityPolicyService
    {
        public Task<TenantSecurityPolicy> GetOrCreateAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
            Task.FromResult(new TenantSecurityPolicy { TenantId = tenantId });

        public Task ValidatePasswordAsync(Guid tenantId, string password, CancellationToken cancellationToken = default)
        {
            ValidatePassword(password, new TenantSecurityPolicy { TenantId = tenantId });
            return Task.CompletedTask;
        }

        public void ValidatePassword(string password, TenantSecurityPolicy policy)
        {
            if (string.IsNullOrWhiteSpace(password))
            {
                throw new Shared.Errors.BusinessRuleException("Password is required.");
            }

            if (password.Length < 12)
            {
                throw new Shared.Errors.BusinessRuleException("Password must be at least 12 characters long.");
            }

            if (!password.Any(char.IsUpper) || !password.Any(char.IsLower) || !password.Any(char.IsDigit) || !password.Any(ch => !char.IsLetterOrDigit(ch)))
            {
                throw new Shared.Errors.BusinessRuleException("Password must contain uppercase, lowercase, number, and special character.");
            }
        }
    }

    private sealed class FakeUserSessionService(AppDbContext dbContext) : IUserSessionService
    {
        public UserSession StartSession(User user, string? jwtId)
        {
            var session = new UserSession
            {
                TenantId = user.TenantId,
                UserId = user.Id,
                JwtId = jwtId,
                LoginAt = DateTime.UtcNow,
                LastSeenAt = DateTime.UtcNow
            };
            dbContext.UserSessions.Add(session);
            return session;
        }

        public Task<bool> TouchAsync(Guid sessionId, TimeSpan minimumInterval, CancellationToken cancellationToken = default) => Task.FromResult(true);

        public Task LogoutAsync(Guid sessionId, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task<UserSession?> GetAsync(Guid sessionId, CancellationToken cancellationToken = default) =>
            dbContext.UserSessions.SingleOrDefaultAsync(x => x.Id == sessionId, cancellationToken);

        public async Task<int> RevokeAllForUserAsync(Guid userId, string? reason = null, CancellationToken cancellationToken = default)
        {
            var sessions = await dbContext.UserSessions.Where(x => x.UserId == userId).ToListAsync(cancellationToken);
            foreach (var session in sessions)
            {
                session.IsRevoked = true;
                session.RevokedAt = DateTime.UtcNow;
                session.LogoutAt = session.RevokedAt;
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            return sessions.Count;
        }
    }

    private sealed class NoOpUserAccessService : IUserAccessService
    {
        public void EnsureAdmin() { }
        public void EnsureAdminOrPermission(string permissionName) { }
        public void EnsureTenantOperationalAccess() { }
    }

    private sealed class FakeUserPermissionTemplateService : IUserPermissionTemplateService
    {
        public UserPermissionsModel GetDefaultPermissions(string role, string? jobTitle) => new(true, true, true, true, true, true, true, true, true);
        public UserPermissionsModel GetFullTenantPermissions() => new(true, true, true, true, true, true, true, true, true);
        public UserPermissionsModel GetSuperAdminPermissions() => new(false, false, false, false, false, false, false, false, false);
        public UserPermissionsModel Merge(string role, string? jobTitle, UserPermissionsModel? customPermissions) => customPermissions ?? GetFullTenantPermissions();
    }

    private sealed class NoOpLicenseGuardService : ILicenseGuardService
    {
        public Task<TenantLicenseSnapshot> GetSnapshotAsync(Guid tenantId, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<LicenseUsageSnapshot> GetUsageAsync(Guid tenantId, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<IReadOnlyCollection<PlatformLicenseUsageSnapshot>> GetPlatformUsageAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task EnsureTenantCanMutateAsync(Guid tenantId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task EnsureCanCreateUserAsync(Guid tenantId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task EnsureCanCreateBranchAsync(Guid tenantId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task EnsureCanCreateAssetAsync(Guid tenantId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task EnsureCanCreateWorkOrderAsync(Guid tenantId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task EnsureFeatureEnabledAsync(Guid tenantId, string featureName, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<TenantLicense> GetOrCreateTenantLicenseAsync(Guid tenantId, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private sealed class NoOpAuditLogService : IAuditLogService
    {
        public Task LogAsync(Guid? tenantId, Guid? userId, string action, string entityName, string entityId, string? details, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task LogAsync(Guid? tenantId, Guid? userId, string action, string entityName, string entityId, string? details, string severity = "Info", string? actorName = null, string? ipAddress = null, string? userAgent = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class FakeUserCredentialDeliveryService(AppDbContext dbContext, bool credentialSendSucceeds, bool? resetSendSucceeds = null) : IUserCredentialDeliveryService
    {
        public string BuildLoginUrl() => "https://app.ecosysdigital.co.ke/login";
        public string BuildInviteUrl(string token) => $"https://app.ecosysdigital.co.ke/accept-invite?token={token}";
        public string BuildResetPasswordUrl(string token) => $"https://app.ecosysdigital.co.ke/reset-password?token={token}";

        public async Task<UserCredentialDeliveryResult> SendAsync(Guid tenantId, User user, UserCredentialDeliveryRequest request, CancellationToken cancellationToken = default)
        {
            var success = credentialSendSucceeds;
            dbContext.EmailDeliveryLogs.Add(new EmailDeliveryLog
            {
                TenantId = tenantId,
                EventKey = request.TemplateEventKey,
                TemplateKey = request.TemplateEventKey,
                RecipientEmail = user.Email,
                Subject = $"{request.TemplateEventKey} subject",
                Status = success ? "Sent" : "Failed",
                ErrorMessage = success ? null : "SMTP failure",
                SentAt = success ? DateTime.UtcNow : null
            });
            await dbContext.SaveChangesAsync(cancellationToken);
            return success
                ? new UserCredentialDeliveryResult(true, "Sent", "User credentials sent.")
                : new UserCredentialDeliveryResult(false, "Failed", "Credential email could not be sent.");
        }

        public async Task<UserCredentialDeliveryResult> SendPasswordResetLinkAsync(Guid tenantId, User user, PasswordResetLinkDeliveryRequest request, CancellationToken cancellationToken = default)
        {
            var success = resetSendSucceeds ?? credentialSendSucceeds;
            dbContext.EmailDeliveryLogs.Add(new EmailDeliveryLog
            {
                TenantId = tenantId,
                EventKey = "auth.password-reset.requested",
                TemplateKey = "password-reset-link",
                RecipientEmail = user.Email,
                Subject = "Reset your Ecosys password",
                Status = success ? "Sent" : "Failed",
                ErrorMessage = success ? null : "SMTP failure",
                SentAt = success ? DateTime.UtcNow : null
            });
            await dbContext.SaveChangesAsync(cancellationToken);
            return success
                ? new UserCredentialDeliveryResult(true, "Sent", "Password reset email sent.")
                : new UserCredentialDeliveryResult(false, "Failed", "Password reset email could not be sent.");
        }
    }
}
