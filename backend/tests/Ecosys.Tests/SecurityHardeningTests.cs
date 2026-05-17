using Ecosys.Api.Controllers;
using Ecosys.Infrastructure.Data;
using Ecosys.Infrastructure.Services;
using Ecosys.Shared.Auth;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;

namespace Ecosys.Tests;

public sealed class SecurityHardeningTests
{
    [Fact]
    public async Task Swagger_IsNotExposedOutsideDevelopment()
    {
        await using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => builder.UseEnvironment("Production"));

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        var response = await client.GetAsync("/swagger/index.html");

        Assert.Equal(System.Net.HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DevSeed_ReturnsNotFoundOutsideDevelopment()
    {
        await using var dbContext = CreateDbContext();
        var tenant = new Domain.Entities.Tenant
        {
            Name = "Acme",
            Slug = $"acme-{Guid.NewGuid():N}".Substring(0, 12),
            CompanyName = "Acme Facilities",
            Email = "ops@acme.test",
            Country = "Kenya",
            Status = "Active",
            LicenseStatus = "Active"
        };
        var user = new Domain.Entities.User
        {
            TenantId = tenant.Id,
            FullName = "Alice Admin",
            Email = $"alice-{Guid.NewGuid():N}@acme.test",
            PasswordHash = "hash",
            Role = AppRoles.Admin,
            IsActive = true,
            HasAllBranchAccess = true
        };
        dbContext.AddRange(tenant, user);
        await dbContext.SaveChangesAsync();

        var controller = new DevController(
            dbContext,
            new FakeTenantContext(tenant.Id, user.Id),
            new FakeWebHostEnvironment("Production"),
            new NoOpDocumentNumberingService(),
            new NoOpPreventiveMaintenancePlanService(),
            new NoOpStockLedgerService(),
            new NoOpUserAccessService());

        var result = await controller.Seed(CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"ecosys-security-{Guid.NewGuid():N}")
            .Options;

        return new AppDbContext(options);
    }

    private sealed class FakeTenantContext(Guid tenantId, Guid userId) : ITenantContext
    {
        public Guid? TenantId => tenantId;
        public Guid? UserId => userId;
        public Guid? SessionId => Guid.NewGuid();
        public string? Email => "admin@acme.test";
        public string? Role => AppRoles.Admin;
        public string? JobTitle => "Admin";
        public bool IsAuthenticated => true;
        public bool IsSuperAdmin => false;
        public bool IsAdmin => true;
        public bool HasRole(string role) => string.Equals(role, AppRoles.Admin, StringComparison.OrdinalIgnoreCase);
        public bool HasPermission(string permissionName) => true;
        public Guid GetRequiredTenantId() => tenantId;
        public Guid GetRequiredUserId() => userId;
        public Guid GetRequiredSessionId() => SessionId!.Value;
    }

    private sealed class FakeWebHostEnvironment(string environmentName) : IWebHostEnvironment
    {
        public string ApplicationName { get; set; } = "Ecosys.Api";
        public IFileProvider WebRootFileProvider { get; set; } = new Microsoft.Extensions.FileProviders.NullFileProvider();
        public string WebRootPath { get; set; } = string.Empty;
        public string EnvironmentName { get; set; } = environmentName;
        public string ContentRootPath { get; set; } = Directory.GetCurrentDirectory();
        public IFileProvider ContentRootFileProvider { get; set; } = new Microsoft.Extensions.FileProviders.NullFileProvider();
    }

    private sealed class NoOpUserAccessService : IUserAccessService
    {
        public void EnsureAdmin() { }
        public void EnsureAdminOrPermission(string permissionName) { }
        public void EnsureTenantOperationalAccess() { }
    }

    private sealed class NoOpDocumentNumberingService : IDocumentNumberingService
    {
        public Task<string> GenerateAsync(Guid tenantId, Guid? branchId, string documentType, CancellationToken cancellationToken = default) =>
            Task.FromResult("DEV-0001");

        public Task<Domain.Entities.NumberingSetting> UpsertAsync(Guid tenantId, Guid? branchId, string documentType, string prefix, long nextNumber, int paddingLength, string resetFrequency, bool includeYear, bool includeMonth, bool isActive, CancellationToken cancellationToken = default, string? suffix = null, string yearFormat = "YYYY", string separator = "-", bool isLocked = false) =>
            Task.FromException<Domain.Entities.NumberingSetting>(new NotSupportedException());
    }

    private sealed class NoOpPreventiveMaintenancePlanService : IPreventiveMaintenancePlanService
    {
        public Task SyncForAssetAsync(Domain.Entities.Asset asset, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class NoOpStockLedgerService : IStockLedgerService
    {
        public Task<Domain.Entities.StockMovement> RecordReceiptAsync(Domain.Entities.MaterialItem material, Guid? branchId, decimal quantity, Guid? createdByUserId, string? reason, string? referenceNumber, Guid? workOrderId = null, Guid? materialRequestId = null, CancellationToken cancellationToken = default) =>
            Task.FromException<Domain.Entities.StockMovement>(new NotSupportedException());

        public Task<Domain.Entities.StockMovement> RecordAdjustmentAsync(Domain.Entities.MaterialItem material, Guid? branchId, decimal quantityChange, Guid? createdByUserId, string? reason, string? referenceNumber = null, Guid? workOrderId = null, Guid? materialRequestId = null, CancellationToken cancellationToken = default) =>
            Task.FromException<Domain.Entities.StockMovement>(new NotSupportedException());

        public Task<Domain.Entities.StockMovement> RecordIssueAsync(Domain.Entities.MaterialItem material, Guid? branchId, decimal quantity, Guid? createdByUserId, string? reason, string? referenceNumber = null, Guid? workOrderId = null, Guid? materialRequestId = null, CancellationToken cancellationToken = default) =>
            Task.FromException<Domain.Entities.StockMovement>(new NotSupportedException());

        public Task<Domain.Entities.StockMovement> RecordReturnAsync(Domain.Entities.MaterialItem material, Guid? branchId, decimal quantity, Guid? createdByUserId, string? reason, string? referenceNumber = null, Guid? workOrderId = null, Guid? materialRequestId = null, CancellationToken cancellationToken = default) =>
            Task.FromException<Domain.Entities.StockMovement>(new NotSupportedException());

        public Task<Domain.Entities.StockMovement> RecordTransferOutAsync(Domain.Entities.MaterialItem material, Guid fromBranchId, decimal quantity, Guid? createdByUserId, string? reason, string? referenceNumber = null, CancellationToken cancellationToken = default) =>
            Task.FromException<Domain.Entities.StockMovement>(new NotSupportedException());

        public Task<Domain.Entities.StockMovement> RecordTransferInAsync(Domain.Entities.MaterialItem material, Guid toBranchId, decimal quantity, Guid? createdByUserId, string? reason, string? referenceNumber = null, CancellationToken cancellationToken = default) =>
            Task.FromException<Domain.Entities.StockMovement>(new NotSupportedException());
    }
}
