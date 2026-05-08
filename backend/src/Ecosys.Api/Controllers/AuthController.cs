using Ecosys.Infrastructure.Services;
using Ecosys.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Ecosys.Infrastructure.Data;

namespace Ecosys.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    IMvpAuthService authService,
    ITenantContext tenantContext,
    IUserSessionService userSessionService,
    AppDbContext dbContext,
    IAuditLogService auditLogService) : ControllerBase
{
    [HttpPost("signup")]
    public async Task<ActionResult<SignupResponse>> Signup([FromBody] SignupRequest request, CancellationToken cancellationToken)
    {
        var result = await authService.SignupAsync(
            request.FullName,
            request.Email,
            request.Password,
            request.CompanyName,
            request.Industry,
            request.Country,
            cancellationToken);

        return Ok(new SignupResponse(
            result.Token,
            result.TenantId,
            result.UserId,
            result.CompanyName,
            result.Role,
            result.JobTitle,
            MapPermissions(result.Permissions, IsPlatformRole(result.Role))));
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var result = await authService.LoginAsync(request.Email, request.Password, cancellationToken);

        return Ok(new LoginResponse(
            result.Token,
            new LoginUserDto(result.UserId, result.FullName, result.Email, result.Role, result.JobTitle, result.Department, MapPermissions(result.Permissions, IsPlatformRole(result.Role))),
            new LoginTenantDto(result.TenantId, result.CompanyName, result.Country, result.Industry, result.LogoUrl, result.ShowPoweredByEcosys)));
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        var sessionId = tenantContext.GetRequiredSessionId();
        await userSessionService.LogoutAsync(tenantContext.GetRequiredSessionId(), cancellationToken);

        if (!tenantContext.IsSuperAdmin && tenantContext.TenantId.HasValue && tenantContext.UserId.HasValue)
        {
            await auditLogService.LogAsync(
                tenantContext.TenantId.Value,
                tenantContext.UserId.Value,
                "Logout",
                nameof(Domain.Entities.UserSession),
                sessionId.ToString(),
                $"User '{tenantContext.Email}' signed out.",
                cancellationToken);
        }

        return Ok();
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<AuthenticatedContextResponse>> GetCurrentUser(CancellationToken cancellationToken)
    {
        var userId = tenantContext.GetRequiredUserId();
        var user = await dbContext.Users
            .Include(x => x.Tenant)
            .Include(x => x.Permission)
            .Include(x => x.BranchAssignments)
            .SingleOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new UnauthorizedAccessException("User context was not found.");

        var isPlatformUser = IsPlatformRole(user.Role);

        if (isPlatformUser)
        {
            return Ok(new AuthenticatedContextResponse(
                new AuthenticatedUserDto(
                    user.Id,
                    user.FullName,
                    user.Email,
                    user.Role,
                    user.JobTitle,
                    user.Department,
                    user.HasAllBranchAccess,
                    user.DefaultBranchId,
                    MapPermissions(user.Permission, true)),
                new AuthenticatedTenantDto(
                    user.TenantId,
                    user.Tenant?.CompanyName ?? "Platform",
                    user.Tenant?.Country ?? "Platform",
                    user.Tenant?.Industry,
                    user.Tenant?.LogoUrl,
                    user.Tenant?.PrimaryColor ?? "#0F4C81",
                    user.Tenant?.SecondaryColor ?? "#F4B942"),
                []));
        }

        var branches = user.HasAllBranchAccess
            ? await dbContext.Branches
                .Where(x => x.TenantId == user.TenantId && x.IsActive)
                .OrderBy(x => x.Name)
                .Select(x => new AuthenticatedBranchDto(x.Id, x.Name, x.Code, x.Location, x.IsActive))
                .ToListAsync(cancellationToken)
            : await dbContext.Branches
                .Where(x => x.TenantId == user.TenantId && x.IsActive && user.BranchAssignments.Select(a => a.BranchId).Contains(x.Id))
                .OrderBy(x => x.Name)
                .Select(x => new AuthenticatedBranchDto(x.Id, x.Name, x.Code, x.Location, x.IsActive))
                .ToListAsync(cancellationToken);

        return Ok(new AuthenticatedContextResponse(
            new AuthenticatedUserDto(
                user.Id,
                user.FullName,
                user.Email,
                user.Role,
                user.JobTitle,
                user.Department,
                user.HasAllBranchAccess,
                user.DefaultBranchId,
                MapPermissions(user.Permission, isPlatformUser)),
            new AuthenticatedTenantDto(
                user.TenantId,
                user.Tenant?.CompanyName ?? string.Empty,
                user.Tenant?.Country ?? string.Empty,
                user.Tenant?.Industry,
                user.Tenant?.LogoUrl,
                user.Tenant?.PrimaryColor ?? "#0F4C81",
                user.Tenant?.SecondaryColor ?? "#F4B942"),
            branches));
    }

    private static PermissionResponse MapPermissions(UserPermissionsModel permissions, bool isPlatformOwner) =>
        new(
            permissions.CanViewWorkOrders,
            permissions.CanCreateWorkOrders,
            permissions.CanAssignWorkOrders,
            permissions.CanCompleteWorkOrders,
            permissions.CanApproveMaterials,
            permissions.CanIssueMaterials,
            permissions.CanManageAssets,
            permissions.CanManageSettings,
            permissions.CanViewReports,
            isPlatformOwner,
            isPlatformOwner,
            isPlatformOwner,
            isPlatformOwner,
            isPlatformOwner);

    private static PermissionResponse MapPermissions(Domain.Entities.UserPermission? permission, bool isPlatformOwner) =>
        permission is null
            ? new PermissionResponse(false, false, false, false, false, false, false, false, false, isPlatformOwner, isPlatformOwner, isPlatformOwner, isPlatformOwner, isPlatformOwner)
            : new PermissionResponse(
                permission.CanViewWorkOrders,
                permission.CanCreateWorkOrders,
                permission.CanAssignWorkOrders,
                permission.CanCompleteWorkOrders,
                permission.CanApproveMaterials,
                permission.CanIssueMaterials,
                permission.CanManageAssets,
                permission.CanManageSettings,
                permission.CanViewReports,
                isPlatformOwner,
                isPlatformOwner,
                isPlatformOwner,
                isPlatformOwner,
                isPlatformOwner);

    private static bool IsPlatformRole(string role) =>
        AppRoles.PlatformRoles.Contains(role, StringComparer.OrdinalIgnoreCase);
}

public sealed record SignupRequest(
    string FullName,
    string Email,
    string Password,
    string CompanyName,
    string? Industry,
    string Country);

public sealed record SignupResponse(
    string Token,
    Guid TenantId,
    Guid UserId,
    string CompanyName,
    string Role,
    string? JobTitle,
    PermissionResponse Permissions);

public sealed record LoginRequest(string Email, string Password);

public sealed record LoginResponse(
    string Token,
    LoginUserDto User,
    LoginTenantDto Tenant);

public sealed record LoginUserDto(Guid UserId, string FullName, string Email, string Role, string? JobTitle, string? Department, PermissionResponse Permissions);

public sealed record LoginTenantDto(
    Guid TenantId,
    string CompanyName,
    string Country,
    string? Industry,
    string? LogoUrl,
    bool ShowPoweredByEcosys);

public sealed record PermissionResponse(
    bool CanViewWorkOrders,
    bool CanCreateWorkOrders,
    bool CanAssignWorkOrders,
    bool CanCompleteWorkOrders,
    bool CanApproveMaterials,
    bool CanIssueMaterials,
    bool CanManageAssets,
    bool CanManageSettings,
    bool CanViewReports,
    bool CanViewPlatformTenants,
    bool CanCreatePlatformTenants,
    bool CanEditPlatformTenants,
    bool CanUpdatePlatformTenantStatus,
    bool CanDeactivatePlatformTenants);

public sealed record AuthenticatedContextResponse(
    AuthenticatedUserDto User,
    AuthenticatedTenantDto Tenant,
    IReadOnlyCollection<AuthenticatedBranchDto> Branches);

public sealed record AuthenticatedUserDto(
    Guid UserId,
    string FullName,
    string Email,
    string Role,
    string? JobTitle,
    string? Department,
    bool HasAllBranchAccess,
    Guid? DefaultBranchId,
    PermissionResponse Permissions);

public sealed record AuthenticatedTenantDto(
    Guid TenantId,
    string CompanyName,
    string Country,
    string? Industry,
    string? LogoUrl,
    string PrimaryColor,
    string SecondaryColor);

public sealed record AuthenticatedBranchDto(
    Guid Id,
    string Name,
    string Code,
    string? Location,
    bool IsActive);
