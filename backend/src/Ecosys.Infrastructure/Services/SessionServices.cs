using Ecosys.Domain.Entities;
using Ecosys.Infrastructure.Data;
using Ecosys.Shared.Auth;
using Ecosys.Shared.Errors;
using Ecosys.Shared.Options;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Ecosys.Infrastructure.Services;

public interface IUserSessionService
{
    UserSession StartSession(User user, string? jwtId);
    Task<bool> TouchAsync(Guid sessionId, TimeSpan minimumInterval, CancellationToken cancellationToken = default);
    Task LogoutAsync(Guid sessionId, CancellationToken cancellationToken = default);
    Task<UserSession?> GetAsync(Guid sessionId, CancellationToken cancellationToken = default);
}

internal sealed class UserSessionService(AppDbContext dbContext, IHttpContextAccessor httpContextAccessor) : IUserSessionService
{
    public UserSession StartSession(User user, string? jwtId)
    {
        var now = DateTime.UtcNow;
        var session = new UserSession
        {
            TenantId = user.TenantId,
            UserId = user.Id,
            JwtId = jwtId,
            LoginAt = now,
            LastSeenAt = now,
            IpAddress = httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString(),
            UserAgent = httpContextAccessor.HttpContext?.Request.Headers.UserAgent.ToString(),
            IsRevoked = false
        };

        dbContext.UserSessions.Add(session);
        return session;
    }

    public async Task<bool> TouchAsync(Guid sessionId, TimeSpan minimumInterval, CancellationToken cancellationToken = default)
    {
        var session = await dbContext.UserSessions.SingleOrDefaultAsync(x => x.Id == sessionId, cancellationToken);
        if (session is null || session.IsRevoked || session.LogoutAt.HasValue)
        {
            return false;
        }

        var now = DateTime.UtcNow;
        if (session.LastSeenAt >= now.Subtract(minimumInterval))
        {
            return true;
        }

        session.LastSeenAt = now;
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task LogoutAsync(Guid sessionId, CancellationToken cancellationToken = default)
    {
        var session = await dbContext.UserSessions.SingleOrDefaultAsync(x => x.Id == sessionId, cancellationToken)
            ?? throw new NotFoundException("Session was not found.");

        if (!session.LogoutAt.HasValue)
        {
            var now = DateTime.UtcNow;
            session.LogoutAt = now;
            session.IsRevoked = true;
            session.RevokedAt = now;
            session.LastSeenAt = now;
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    public Task<UserSession?> GetAsync(Guid sessionId, CancellationToken cancellationToken = default) =>
        dbContext.UserSessions.SingleOrDefaultAsync(x => x.Id == sessionId, cancellationToken);

    public static bool IsActive(UserSession session, DateTime utcNow) =>
        !session.IsRevoked
        && !session.LogoutAt.HasValue
        && session.LastSeenAt >= utcNow.AddMinutes(-15);
}

public interface IPlatformBootstrapService
{
    Task EnsurePlatformAdminAsync(CancellationToken cancellationToken = default);
}

internal sealed class PlatformBootstrapService(
    AppDbContext dbContext,
    IPasswordHasher<User> passwordHasher,
    IOptions<PlatformAdminOptions> platformAdminOptions) : IPlatformBootstrapService
{
    public async Task EnsurePlatformAdminAsync(CancellationToken cancellationToken = default)
    {
        var tenant = await dbContext.Tenants.SingleOrDefaultAsync(x => x.Id == PlatformConstants.RootTenantId, cancellationToken);
        if (tenant is null)
        {
            tenant = new Tenant
            {
                Id = PlatformConstants.RootTenantId,
                Name = "Ecosys Platform",
                Slug = "ecosys-platform",
                CompanyName = "Ecosys Platform",
                Email = platformAdminOptions.Value.Email.Trim().ToLowerInvariant(),
                ContactEmail = platformAdminOptions.Value.Email.Trim().ToLowerInvariant(),
                Country = "Platform",
                Industry = "SaaS",
                Status = "Active",
                LicenseStatus = "Active",
                PlanName = "Platform",
                IsActive = true
            };
            dbContext.Tenants.Add(tenant);
        }
        else
        {
            tenant.Name = string.IsNullOrWhiteSpace(tenant.Name) ? tenant.CompanyName : tenant.Name;
            tenant.Slug = string.IsNullOrWhiteSpace(tenant.Slug) ? "ecosys-platform" : tenant.Slug;
            tenant.ContactEmail = string.IsNullOrWhiteSpace(tenant.ContactEmail) ? tenant.Email : tenant.ContactEmail;
            tenant.Status = string.IsNullOrWhiteSpace(tenant.Status) ? "Active" : tenant.Status;
            tenant.LicenseStatus = string.IsNullOrWhiteSpace(tenant.LicenseStatus) ? "Active" : tenant.LicenseStatus;
            tenant.PlanName ??= "Platform";
            tenant.IsActive = true;
        }

        var user = await dbContext.Users.SingleOrDefaultAsync(x => x.Id == PlatformConstants.SuperAdminUserId, cancellationToken);
        if (user is null)
        {
            user = new User
            {
                Id = PlatformConstants.SuperAdminUserId,
                TenantId = tenant.Id,
                FullName = platformAdminOptions.Value.FullName,
                Email = platformAdminOptions.Value.Email.Trim().ToLowerInvariant(),
                Role = AppRoles.SuperAdmin,
                JobTitle = "Platform SuperAdmin",
                IsActive = true,
                HasAllBranchAccess = true
            };
            user.PasswordHash = passwordHasher.HashPassword(user, platformAdminOptions.Value.Password);
            user.Permission = new UserPermission();
            dbContext.Users.Add(user);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
