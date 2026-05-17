using System.Security.Claims;
using System.Text;
using Ecosys.Api.Controllers;
using Ecosys.Domain.Entities;
using Ecosys.Infrastructure.Data;
using Ecosys.Infrastructure.Services;
using Ecosys.Shared.Auth;
using Ecosys.Shared.Contracts.Integration;
using Ecosys.Shared.Errors;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Ecosys.Tests;

public sealed class WorkOrderExecutionFlowTests
{
    [Fact]
    public async Task PhotoEvidence_SaveLoad_PersistsCaptionAndCategory()
    {
        await using var dbContext = CreateDbContext();
        var fixture = await SeedFixtureAsync(dbContext);
        var fileStorage = new FakeFileStorageService();
        var pdfRenderer = new FakePdfRenderer();
        var controller = CreateExecutionController(dbContext, fixture, fileStorage, pdfRenderer);

        var file = CreateFormFile("before.jpg", "image/jpeg", "before-image");
        var uploadResult = await controller.UploadPhoto(fixture.WorkOrder.Id, "Burnt contactor before replacement", "Before", true, file, CancellationToken.None);
        Assert.IsType<OkObjectResult>(uploadResult.Result);

        var bundleResult = await controller.GetExecutionBundle(fixture.WorkOrder.Id, CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(bundleResult.Result);
        var bundle = Assert.IsType<WorkOrderExecutionBundleResponse>(ok.Value);

        var photo = Assert.Single(bundle.Photos);
        Assert.Equal("Burnt contactor before replacement", photo.Caption);
        Assert.Equal("Before", photo.Category);
        Assert.True(photo.IncludeInReport);

        var stored = await dbContext.WorkOrderPhotoEvidence.SingleAsync();
        Assert.Equal("Burnt contactor before replacement", stored.Caption);
        Assert.Equal("Before", stored.Category);
    }

    [Fact]
    public async Task MaterialUsage_SaveLoad_PersistsUsage()
    {
        await using var dbContext = CreateDbContext();
        var fixture = await SeedFixtureAsync(dbContext);
        var controller = CreateExecutionController(dbContext, fixture);

        var addResult = await controller.AddMaterialUsage(
            fixture.WorkOrder.Id,
            new AddWorkOrderMaterialUsageRequest(fixture.Material.Id, fixture.Asset.Id, 2, 150m, true, "Replaced failed contactor", DateTime.UtcNow),
            CancellationToken.None);

        Assert.IsType<OkObjectResult>(addResult.Result);

        var bundleResult = await controller.GetExecutionBundle(fixture.WorkOrder.Id, CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(bundleResult.Result);
        var bundle = Assert.IsType<WorkOrderExecutionBundleResponse>(ok.Value);

        var usage = Assert.Single(bundle.MaterialUsages);
        Assert.Equal(fixture.Material.ItemName, usage.MaterialName);
        Assert.Equal(2, usage.QuantityUsed);
        Assert.True(usage.Chargeable);

        var stored = await dbContext.WorkOrderMaterialUsages.SingleAsync();
        Assert.Equal(2, stored.QuantityUsed);
        Assert.Equal("Replaced failed contactor", stored.Notes);
    }

    [Fact]
    public async Task Signature_SaveLoadDelete_Works()
    {
        await using var dbContext = CreateDbContext();
        var fixture = await SeedFixtureAsync(dbContext);
        var controller = CreateExecutionController(dbContext, fixture);

        var saveResult = await controller.CaptureSignature(
            fixture.WorkOrder.Id,
            new CaptureWorkOrderSignatureRequest("Technician", "Moses Otieno", "Technician", ValidSignatureDataUrl, "Signed after repair"),
            CancellationToken.None);

        Assert.IsType<OkObjectResult>(saveResult.Result);

        var listResult = await controller.GetSignatures(fixture.WorkOrder.Id, CancellationToken.None);
        var listOk = Assert.IsType<OkObjectResult>(listResult.Result);
        var signatures = Assert.IsAssignableFrom<IReadOnlyCollection<WorkOrderSignatureResponse>>(listOk.Value);
        var signature = Assert.Single(signatures);
        Assert.Equal("Technician", signature.SignatureType);

        var deleteResult = await controller.DeleteSignature(fixture.WorkOrder.Id, signature.Id, CancellationToken.None);
        Assert.IsType<NoContentResult>(deleteResult);
        Assert.Empty(await dbContext.WorkOrderSignatures.ToListAsync());
    }

    [Fact]
    public async Task ServiceReportPreview_ReturnsPhotosMaterialsAndSignatures()
    {
        await using var dbContext = CreateDbContext();
        var fixture = await SeedFixtureAsync(dbContext);
        var fileStorage = new FakeFileStorageService();
        var controller = CreateExecutionController(dbContext, fixture, fileStorage);

        await SeedPhotoSignatureAndMaterialAsync(dbContext, fixture, fileStorage);

        var previewResult = await controller.GetServiceReport(fixture.WorkOrder.Id, CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(previewResult.Result);
        var preview = Assert.IsType<WorkOrderServiceReportPreviewResponse>(ok.Value);

        Assert.Equal(fixture.WorkOrder.WorkOrderNumber, preview.WorkOrderNumber);
        Assert.Contains(preview.PhotoGroups, group => group.Category == "Before");
        Assert.Single(preview.Materials);
        Assert.Equal(2, preview.Signatures.Count);
    }

    [Fact]
    public async Task ServiceReportPdf_GeneratesUsingSavedData()
    {
        await using var dbContext = CreateDbContext();
        var fixture = await SeedFixtureAsync(dbContext);
        var fileStorage = new FakeFileStorageService();
        var pdfRenderer = new FakePdfRenderer();
        var controller = CreateExecutionController(dbContext, fixture, fileStorage, pdfRenderer);

        await SeedPhotoSignatureAndMaterialAsync(dbContext, fixture, fileStorage);

        var result = await controller.DownloadServiceReportPdf(fixture.WorkOrder.Id, CancellationToken.None);
        var fileResult = Assert.IsType<FileContentResult>(result);
        Assert.Equal("application/pdf", fileResult.ContentType);
        Assert.NotEmpty(fileResult.FileContents);

        Assert.NotNull(pdfRenderer.LastReport);
        Assert.Contains(pdfRenderer.LastReport!.PhotoGroups, group => group.Photos.Any(photo => photo.Caption.Contains("Burnt contactor", StringComparison.OrdinalIgnoreCase)));
        Assert.Equal(2, pdfRenderer.LastReport.Signatures.Count);
        Assert.Single(pdfRenderer.LastReport.Materials);
    }

    [Fact]
    public async Task Complete_IsBlocked_WhenSignaturesAreMissing()
    {
        await using var dbContext = CreateDbContext();
        var fixture = await SeedFixtureAsync(dbContext);
        var controller = CreateWorkOrdersController(dbContext, fixture, hasArrival: true);

        var error = await Assert.ThrowsAsync<BusinessRuleException>(() => controller.Complete(
            fixture.WorkOrder.Id,
            new CompleteWorkOrderRequest("Replaced faulty contactor", null, fixture.Technician.Id, fixture.AssignmentGroup.Id, "Summary", null),
            CancellationToken.None));

        Assert.Contains("signature", error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Complete_IsAllowed_WhenTechnicianAndClientSignaturesExist()
    {
        await using var dbContext = CreateDbContext();
        var fixture = await SeedFixtureAsync(dbContext);

        dbContext.WorkOrderSignatures.AddRange(
            new WorkOrderSignature
            {
                TenantId = fixture.Tenant.Id,
                WorkOrderId = fixture.WorkOrder.Id,
                SignatureType = "Technician",
                SignerName = "Moses Otieno",
                SignatureDataUrl = ValidSignatureDataUrl,
                CapturedByUserId = fixture.User.Id,
                CapturedAt = DateTime.UtcNow
            },
            new WorkOrderSignature
            {
                TenantId = fixture.Tenant.Id,
                WorkOrderId = fixture.WorkOrder.Id,
                SignatureType = "Client",
                SignerName = "Alice Njeri",
                SignatureDataUrl = ValidSignatureDataUrl,
                CapturedByUserId = fixture.User.Id,
                CapturedAt = DateTime.UtcNow
            });
        await dbContext.SaveChangesAsync();

        var controller = CreateWorkOrdersController(dbContext, fixture, hasArrival: true);
        var result = await controller.Complete(
            fixture.WorkOrder.Id,
            new CompleteWorkOrderRequest("Replaced faulty contactor", null, fixture.Technician.Id, fixture.AssignmentGroup.Id, "Summary", null),
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<WorkOrderResponse>(ok.Value);
        Assert.Equal("Completed", response.Status);
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"ecosys-work-order-execution-{Guid.NewGuid():N}")
            .Options;

        return new AppDbContext(options);
    }

    private static async Task<FixtureData> SeedFixtureAsync(AppDbContext dbContext)
    {
        var tenant = new Tenant
        {
            Name = "Acme",
            Slug = $"acme-{Guid.NewGuid():N}".Substring(0, 12),
            CompanyName = "Acme Manufacturing",
            Email = "ops@acme.test",
            Country = "Kenya",
            PrimaryColor = "#0F4C81",
            SecondaryColor = "#F4B942",
            ShowPoweredByEcosys = true
        };

        var branch = new Branch
        {
            TenantId = tenant.Id,
            Name = "Nairobi",
            Code = $"NRB-{Guid.NewGuid():N}".Substring(0, 8),
            IsActive = true
        };

        var user = new User
        {
            TenantId = tenant.Id,
            DefaultBranchId = branch.Id,
            FullName = "Moses Otieno",
            Email = $"moses-{Guid.NewGuid():N}@acme.test",
            PasswordHash = "hash",
            Role = AppRoles.Admin,
            IsActive = true,
            HasAllBranchAccess = true
        };

        var client = new Client
        {
            TenantId = tenant.Id,
            ClientName = "Acme Manufacturing",
            Email = "client@acme.test",
            IsActive = true
        };

        var site = new Site
        {
            TenantId = tenant.Id,
            ClientId = client.Id,
            SiteCode = $"SITE-{Guid.NewGuid():N}".Substring(0, 10),
            SiteName = "Main Plant",
            SiteType = "Factory",
            Status = "Active"
        };

        var asset = new Asset
        {
            TenantId = tenant.Id,
            ClientId = client.Id,
            SiteId = site.Id,
            BranchId = branch.Id,
            AssetName = "Generator 02",
            AssetCode = $"GEN-{Guid.NewGuid():N}".Substring(0, 10),
            OwnershipType = "ClientOwned",
            Status = "Active"
        };

        var technician = new Technician
        {
            TenantId = tenant.Id,
            UserId = user.Id,
            BranchId = branch.Id,
            FullName = "Moses Otieno",
            Email = $"tech-{Guid.NewGuid():N}@acme.test",
            IsActive = true
        };

        var assignmentGroup = new AssignmentGroup
        {
            TenantId = tenant.Id,
            BranchId = branch.Id,
            Name = $"Generator Team {Guid.NewGuid():N}".Substring(0, 20),
            IsActive = true
        };

        var material = new MaterialItem
        {
            TenantId = tenant.Id,
            ItemCode = $"CT-{Guid.NewGuid():N}".Substring(0, 8),
            ItemName = "25A Contactor",
            UnitOfMeasure = "pcs",
            QuantityOnHand = 10,
            ReorderLevel = 1,
            UnitCost = 150m,
            IsActive = true
        };

        var workOrder = new WorkOrder
        {
            TenantId = tenant.Id,
            BranchId = branch.Id,
            ClientId = client.Id,
            SiteId = site.Id,
            AssetId = asset.Id,
            AssignmentGroupId = assignmentGroup.Id,
            AssignmentType = "AssignmentGroup",
            WorkOrderNumber = $"WO-{Guid.NewGuid():N}".Substring(0, 12),
            Title = "Generator transfer fault",
            Description = "Generator failed to transfer load after outage.",
            Priority = "High",
            Status = "Open",
            AssignedTechnicianId = technician.Id,
            LeadTechnicianId = technician.Id
        };

        dbContext.AddRange(tenant, branch, user, client, site, asset, technician, assignmentGroup, material, workOrder);
        dbContext.WorkOrderAssignments.Add(new WorkOrderAssignment
        {
            TenantId = tenant.Id,
            WorkOrderId = workOrder.Id,
            AssignmentGroupId = assignmentGroup.Id,
            AssignedByUserId = user.Id,
            AssignedAt = DateTime.UtcNow,
            AssignmentStatus = "AssignedToTechnician",
            Notes = "Urgent site attendance"
        });
        dbContext.WorkOrderTechnicianAssignments.Add(new WorkOrderTechnicianAssignment
        {
            TenantId = tenant.Id,
            WorkOrderId = workOrder.Id,
            TechnicianId = technician.Id,
            AssignedByUserId = user.Id,
            AssignedAt = DateTime.UtcNow,
            IsLead = true,
            Status = "Accepted"
        });
        await dbContext.SaveChangesAsync();

        return new FixtureData(tenant, branch, user, client, site, asset, technician, assignmentGroup, material, workOrder);
    }

    private static async Task SeedPhotoSignatureAndMaterialAsync(AppDbContext dbContext, FixtureData fixture, FakeFileStorageService fileStorage)
    {
        fileStorage.Store("tenant/photo-1.jpg", Encoding.UTF8.GetBytes("image-bytes"));
        var attachment = new Attachment
        {
            TenantId = fixture.Tenant.Id,
            EntityType = "WorkOrderPhotoEvidence",
            EntityId = fixture.WorkOrder.Id,
            FileName = "before.jpg",
            FileSize = 11,
            MimeType = "image/jpeg",
            StoragePath = "tenant/photo-1.jpg",
            PublicUrl = "https://files.test/photo-1.jpg",
            UploadedByUserId = fixture.User.Id
        };
        dbContext.Attachments.Add(attachment);
        dbContext.WorkOrderPhotoEvidence.Add(new WorkOrderPhotoEvidence
        {
            TenantId = fixture.Tenant.Id,
            WorkOrderId = fixture.WorkOrder.Id,
            Attachment = attachment,
            Caption = "Burnt contactor before replacement",
            Category = "Before",
            IncludeInReport = true,
            UploadedByUserId = fixture.User.Id,
            UploadedAt = DateTime.UtcNow
        });
        dbContext.WorkOrderMaterialUsages.Add(new WorkOrderMaterialUsage
        {
            TenantId = fixture.Tenant.Id,
            WorkOrderId = fixture.WorkOrder.Id,
            MaterialItemId = fixture.Material.Id,
            AssetId = fixture.Asset.Id,
            QuantityUsed = 1,
            UnitCost = 150m,
            Chargeable = true,
            Notes = "Replacement part",
            UsedByUserId = fixture.User.Id,
            UsedAt = DateTime.UtcNow
        });
        dbContext.WorkOrderSignatures.AddRange(
            new WorkOrderSignature
            {
                TenantId = fixture.Tenant.Id,
                WorkOrderId = fixture.WorkOrder.Id,
                SignatureType = "Technician",
                SignerName = "Moses Otieno",
                SignatureDataUrl = ValidSignatureDataUrl,
                CapturedByUserId = fixture.User.Id,
                CapturedAt = DateTime.UtcNow
            },
            new WorkOrderSignature
            {
                TenantId = fixture.Tenant.Id,
                WorkOrderId = fixture.WorkOrder.Id,
                SignatureType = "Client",
                SignerName = "Alice Njeri",
                SignatureDataUrl = ValidSignatureDataUrl,
                CapturedByUserId = fixture.User.Id,
                CapturedAt = DateTime.UtcNow
            });
        await dbContext.SaveChangesAsync();
    }

    private static WorkOrderExecutionController CreateExecutionController(
        AppDbContext dbContext,
        FixtureData fixture,
        FakeFileStorageService? fileStorage = null,
        FakePdfRenderer? pdfRenderer = null)
    {
        var controller = new WorkOrderExecutionController(
            dbContext,
            new FakeTenantContext(fixture.Tenant.Id, fixture.User.Id),
            new FakeUserAccessService(),
            new FakeBranchAccessService(),
            fileStorage ?? new FakeFileStorageService(),
            new AuditLogService(dbContext, new HttpContextAccessor()),
            new FakeStockLedgerService(),
            new FakeAssignmentWorkflowService(),
            new FakeWorkOrderLifecycleService(dbContext),
            pdfRenderer ?? new FakePdfRenderer());

        controller.ControllerContext = CreateControllerContext(fixture.User);
        return controller;
    }

    private static WorkOrdersController CreateWorkOrdersController(AppDbContext dbContext, FixtureData fixture, bool hasArrival)
    {
        var controller = new WorkOrdersController(
            dbContext,
            new FakeTenantContext(fixture.Tenant.Id, fixture.User.Id),
            new FakeDocumentNumberingService(),
            new AuditLogService(dbContext, new HttpContextAccessor()),
            new FakeUserAccessService(),
            new FakeBranchAccessService(),
            new FakeLicenseGuardService(),
            new FakeWorkOrderLifecycleService(dbContext),
            new FakeAssignmentWorkflowService(hasArrival),
            new FakePmChecklistService(),
            new FakeSlaService());

        controller.ControllerContext = CreateControllerContext(fixture.User);
        return controller;
    }

    private static ControllerContext CreateControllerContext(User user)
    {
        var identity = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.FullName),
                new Claim(ClaimTypes.Email, user.Email)
            ],
            "Test");

        return new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(identity)
            }
        };
    }

    private static IFormFile CreateFormFile(string fileName, string contentType, string content)
    {
        var bytes = Encoding.UTF8.GetBytes(content);
        var stream = new MemoryStream(bytes);
        return new FormFile(stream, 0, bytes.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }

    private sealed record FixtureData(
        Tenant Tenant,
        Branch Branch,
        User User,
        Client Client,
        Site Site,
        Asset Asset,
        Technician Technician,
        AssignmentGroup AssignmentGroup,
        MaterialItem Material,
        WorkOrder WorkOrder);

    private sealed class FakeTenantContext(Guid tenantId, Guid userId) : ITenantContext
    {
        public Guid? TenantId => tenantId;
        public Guid? UserId => userId;
        public Guid? SessionId => Guid.NewGuid();
        public string? Email => "test@acme.test";
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

    private sealed class FakeUserAccessService : IUserAccessService
    {
        public void EnsureAdmin() { }
        public void EnsureAdminOrPermission(string permissionName) { }
        public void EnsureTenantOperationalAccess() { }
    }

    private sealed class FakeBranchAccessService : IBranchAccessService
    {
        public Task EnsureCanAccessBranchAsync(Guid tenantId, Guid branchId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyCollection<Guid>> GetAccessibleBranchIdsAsync(Guid tenantId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyCollection<Guid>>([]);
        public Task<BranchQueryScope> GetQueryScopeAsync(Guid tenantId, Guid? requestedBranchId, CancellationToken cancellationToken = default) =>
            Task.FromResult(new BranchQueryScope(false, requestedBranchId, [], true));
        public Task<Guid?> ResolveBranchIdForWriteAsync(Guid tenantId, Guid? requestedBranchId, CancellationToken cancellationToken = default) =>
            Task.FromResult(requestedBranchId);
    }

    private sealed class FakeFileStorageService : IFileStorageService
    {
        private readonly Dictionary<string, byte[]> _files = new(StringComparer.OrdinalIgnoreCase);

        public Task DeleteAsync(string storagePath, CancellationToken ct)
        {
            _files.Remove(storagePath);
            return Task.CompletedTask;
        }

        public Task<Stream> DownloadAsync(string storagePath, CancellationToken ct)
        {
            var bytes = _files.TryGetValue(storagePath, out var stored) ? stored : [];
            return Task.FromResult<Stream>(new MemoryStream(bytes));
        }

        public string GetPublicUrl(string storagePath) => $"https://files.test/{storagePath}";

        public Task<UploadResult> UploadAsync(Stream stream, string fileName, string mimeType, Guid tenantId, CancellationToken ct)
        {
            using var memory = new MemoryStream();
            stream.CopyTo(memory);
            var path = $"{tenantId}/{Guid.NewGuid():N}-{fileName}";
            _files[path] = memory.ToArray();
            return Task.FromResult(new UploadResult(path, GetPublicUrl(path), memory.Length));
        }

        public void Store(string path, byte[] content) => _files[path] = content;
    }

    private sealed class FakeStockLedgerService : IStockLedgerService
    {
        public Task<StockMovement> RecordAdjustmentAsync(MaterialItem material, Guid? branchId, decimal quantityChange, Guid? createdByUserId, string? reason, string? referenceNumber = null, Guid? workOrderId = null, Guid? materialRequestId = null, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<StockMovement> RecordIssueAsync(MaterialItem material, Guid? branchId, decimal quantity, Guid? createdByUserId, string? reason, string? referenceNumber = null, Guid? workOrderId = null, Guid? materialRequestId = null, CancellationToken cancellationToken = default)
        {
            material.QuantityOnHand -= quantity;
            return Task.FromResult(new StockMovement
            {
                TenantId = material.TenantId,
                BranchId = branchId,
                MaterialId = material.Id,
                WorkOrderId = workOrderId,
                MaterialRequestId = materialRequestId,
                MovementType = "Issue",
                Quantity = quantity,
                BalanceAfter = material.QuantityOnHand,
                CreatedByUserId = createdByUserId
            });
        }
        public Task<StockMovement> RecordReceiptAsync(MaterialItem material, Guid? branchId, decimal quantity, Guid? createdByUserId, string? reason, string? referenceNumber, Guid? workOrderId = null, Guid? materialRequestId = null, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<StockMovement> RecordReturnAsync(MaterialItem material, Guid? branchId, decimal quantity, Guid? createdByUserId, string? reason, string? referenceNumber = null, Guid? workOrderId = null, Guid? materialRequestId = null, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<StockMovement> RecordTransferInAsync(MaterialItem material, Guid toBranchId, decimal quantity, Guid? createdByUserId, string? reason, string? referenceNumber = null, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<StockMovement> RecordTransferOutAsync(MaterialItem material, Guid fromBranchId, decimal quantity, Guid? createdByUserId, string? reason, string? referenceNumber = null, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private sealed class FakeAssignmentWorkflowService(bool hasArrival = true) : IWorkOrderAssignmentWorkflowService
    {
        public Task ApplyAssignmentsAsync(Guid tenantId, Guid workOrderId, Guid? actorUserId, WorkOrderAssignmentUpdateRequest request, bool isReassignment, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyCollection<WorkOrderAssignmentHistory>> GetHistoryAsync(Guid tenantId, Guid workOrderId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyCollection<WorkOrderAssignmentHistory>>([]);
        public Task<bool> HasAcceptedTechnicianAsync(Guid tenantId, Guid workOrderId, CancellationToken cancellationToken = default) => Task.FromResult(true);
        public Task<bool> HasArrivalAsync(Guid tenantId, Guid workOrderId, CancellationToken cancellationToken = default) => Task.FromResult(hasArrival);
        public Task RecordArrivalAsync(Guid tenantId, Guid workOrderId, Guid? actorUserId, TechnicianArrivalRequest request, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task RecordDepartureAsync(Guid tenantId, Guid workOrderId, Guid? actorUserId, TechnicianDepartureRequest request, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task RecordInTransitAsync(Guid tenantId, Guid workOrderId, Guid? actorUserId, TechnicianInTransitRequest request, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task RecordTechnicianResponseAsync(Guid tenantId, Guid workOrderId, Guid? actorUserId, TechnicianDispatchResponseRequest request, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class FakePdfRenderer : IPdfRenderer
    {
        public WorkOrderReportPdfModel? LastReport { get; private set; }
        public byte[] RenderWorkOrderReportPdf(string title, IReadOnlyCollection<string> sections) => Encoding.UTF8.GetBytes(title);
        public byte[] RenderWorkOrderReportPdf(WorkOrderReportPdfModel report)
        {
            LastReport = report;
            return Encoding.UTF8.GetBytes($"PDF:{report.WorkOrderNumber}");
        }
    }

    private sealed class FakeWorkOrderLifecycleService(AppDbContext dbContext) : IWorkOrderLifecycleService
    {
        public Task<WorkOrderEvent> AddCommentAsync(Guid tenantId, Guid workOrderId, Guid actorUserId, WorkOrderCommentRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<WorkOrder> ArriveAsync(Guid tenantId, Guid workOrderId, Guid actorUserId, Ecosys.Infrastructure.Services.WorkOrderLocationRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<WorkOrder> AssignAsync(Guid tenantId, Guid workOrderId, Guid? actorUserId, Guid? technicianId, Guid? assignmentGroupId, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public async Task<WorkOrder> ChangeStatusAsync(Guid tenantId, Guid workOrderId, Guid actorUserId, string status, string? message = null, CancellationToken cancellationToken = default)
        {
            var workOrder = await dbContext.WorkOrders.SingleAsync(x => x.TenantId == tenantId && x.Id == workOrderId, cancellationToken);
            workOrder.Status = status;
            if (string.Equals(status, "Closed", StringComparison.OrdinalIgnoreCase))
            {
                workOrder.ClosedAt = DateTime.UtcNow;
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            return workOrder;
        }
        public async Task<WorkOrder> CompleteAsync(Guid tenantId, Guid workOrderId, Guid actorUserId, WorkOrderCompletionRequest request, CancellationToken cancellationToken = default)
        {
            var workOrder = await dbContext.WorkOrders.SingleAsync(x => x.TenantId == tenantId && x.Id == workOrderId, cancellationToken);
            workOrder.Status = "Completed";
            workOrder.WorkDoneNotes = request.WorkDoneNotes;
            workOrder.CompletedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            return workOrder;
        }
        public Task<WorkOrder> DepartAsync(Guid tenantId, Guid workOrderId, Guid actorUserId, Ecosys.Infrastructure.Services.WorkOrderLocationRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<IReadOnlyCollection<WorkOrderEvent>> GetEventsAsync(Guid tenantId, Guid workOrderId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyCollection<WorkOrderEvent>>([]);
        public string NormalizeStatus(string status) => status;
        public Task RecordCreatedAsync(Guid tenantId, Guid workOrderId, Guid? actorUserId, string workOrderNumber, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<WorkOrder> StartAsync(Guid tenantId, Guid workOrderId, Guid actorUserId, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private sealed class FakeDocumentNumberingService : IDocumentNumberingService
    {
        public Task<string> GenerateAsync(Guid tenantId, Guid? branchId, string documentType, CancellationToken cancellationToken = default) => Task.FromResult("WO-TEST");
        public Task<NumberingSetting> UpsertAsync(
            Guid tenantId,
            Guid? branchId,
            string documentType,
            string prefix,
            long nextNumber,
            int paddingLength,
            string resetFrequency,
            bool includeYear,
            bool includeMonth,
            bool isActive,
            CancellationToken cancellationToken = default,
            string? suffix = null,
            string yearFormat = "YYYY",
            string separator = "-",
            bool isLocked = false) =>
            Task.FromResult(new NumberingSetting
            {
                TenantId = tenantId,
                BranchId = branchId,
                DocumentType = documentType,
                Prefix = prefix,
                NextNumber = nextNumber,
                PaddingLength = paddingLength,
                ResetFrequency = resetFrequency,
                IncludeYear = includeYear,
                IncludeMonth = includeMonth,
                IsActive = isActive,
                Suffix = suffix,
                YearFormat = yearFormat,
                Separator = separator,
                IsLocked = isLocked
            });
    }

    private sealed class FakeLicenseGuardService : ILicenseGuardService
    {
        public Task<TenantLicenseSnapshot> GetSnapshotAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
            Task.FromResult(new TenantLicenseSnapshot(
                tenantId,
                Guid.NewGuid(),
                "Trial",
                "Trial",
                "Trial",
                DateTime.UtcNow,
                DateTime.UtcNow.AddDays(14),
                DateTime.UtcNow.AddDays(14),
                null,
                false,
                false,
                false,
                null,
                null,
                null,
                null,
                false,
                false,
                false,
                false,
                null));
        public Task<LicenseUsageSnapshot> GetUsageAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
            Task.FromResult(new LicenseUsageSnapshot(1, 1, 1, 1));
        public Task<IReadOnlyCollection<PlatformLicenseUsageSnapshot>> GetPlatformUsageAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyCollection<PlatformLicenseUsageSnapshot>>([]);
        public Task EnsureTenantCanMutateAsync(Guid tenantId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task EnsureCanCreateAssetAsync(Guid tenantId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task EnsureCanCreateBranchAsync(Guid tenantId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task EnsureCanCreateUserAsync(Guid tenantId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task EnsureCanCreateWorkOrderAsync(Guid tenantId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task EnsureFeatureEnabledAsync(Guid tenantId, string featureName, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<TenantLicense> GetOrCreateTenantLicenseAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
            Task.FromResult(new TenantLicense
            {
                TenantId = tenantId,
                LicensePlanId = Guid.NewGuid(),
                Status = "Trial",
                StartsAt = DateTime.UtcNow,
                TrialEndsAt = DateTime.UtcNow.AddDays(14),
                ExpiresAt = DateTime.UtcNow.AddDays(14)
            });
    }

    private sealed class FakePmChecklistService : IPmWorkOrderChecklistService
    {
        public Task<int> AttachPmTemplateToWorkOrderAsync(Guid workOrderId, Guid pmTemplateId, Guid tenantId, Guid? actorUserId = null, bool replaceExisting = false, CancellationToken cancellationToken = default) => Task.FromResult(0);
        public Task EnsureRequiredChecklistCompletedAsync(Guid workOrderId, Guid tenantId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<PmTemplate> GetActiveTemplateAsync(Guid tenantId, Guid pmTemplateId, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<WorkOrderChecklistItem> UpdateChecklistItemAsync(Guid workOrderId, Guid itemId, Guid tenantId, Guid actorUserId, string? responseValue, string? remarks, bool isCompleted, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private sealed class FakeSlaService : ISlaService
    {
        public Task ApplyDefinitionAsync(WorkOrder workOrder, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<bool> RefreshWorkOrderAsync(Guid workOrderId, DateTime nowUtc, CancellationToken cancellationToken = default) => Task.FromResult(false);
    }

    private const string ValidSignatureDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yKJcAAAAASUVORK5CYII=";
}
