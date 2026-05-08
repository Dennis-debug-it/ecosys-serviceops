using System.Text;
using Ecosys.Domain.Entities;
using Ecosys.Infrastructure.Data;
using Ecosys.Infrastructure.Services;
using Ecosys.Shared.Auth;
using Ecosys.Shared.Errors;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ecosys.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/import")]
public sealed class ImportController(
    AppDbContext dbContext,
    ITenantContext tenantContext,
    IPreventiveMaintenancePlanService preventiveMaintenancePlanService,
    IAuditLogService auditLogService,
    IUserPermissionTemplateService permissionTemplateService,
    IPasswordHasher<User> passwordHasher) : TenantAwareControllerBase(tenantContext)
{
    private const string DefaultImportedPassword = "ChangeMe123!";

    private static readonly string[] ClientHeaders =
    [
        "ClientName",
        "ContactPerson",
        "Email",
        "Phone",
        "Country",
        "County",
        "City",
        "Address",
        "Status"
    ];

    private static readonly string[] AssetHeaders =
    [
        "AssetName",
        "AssetType",
        "SerialNumber",
        "ClientName",
        "BranchName",
        "Location",
        "Manufacturer",
        "Model",
        "Capacity",
        "InstallDate",
        "Status"
    ];

    private static readonly string[] UserHeaders =
    [
        "FullName",
        "Email",
        "Phone",
        "Role",
        "JobTitle",
        "BranchName",
        "IsTechnician",
        "Status"
    ];

    private static readonly string[] BranchHeaders =
    [
        "BranchName",
        "Code",
        "Country",
        "County",
        "City",
        "Address",
        "Status"
    ];

    private static readonly string[] MaterialHeaders =
    [
        "Material Name",
        "Material Code",
        "Category",
        "Unit",
        "Opening Quantity",
        "Reorder Level",
        "Unit Cost",
        "Branch"
    ];

    [HttpGet("templates/clients")]
    public async Task<IActionResult> DownloadClientTemplate(CancellationToken cancellationToken)
    {
        await LogTemplateDownloadAsync("clients", cancellationToken);
        return BuildTemplateFile(ClientHeaders, ["ABC Factory", "John Mwangi", "john@abcfactory.co.ke", "+254700000000", "Kenya", "Nairobi", "Nairobi", "Industrial Area", "Active"], "clients_import_template.csv");
    }

    [HttpGet("templates/assets")]
    public async Task<IActionResult> DownloadAssetTemplate(CancellationToken cancellationToken)
    {
        await LogTemplateDownloadAsync("assets", cancellationToken);
        return BuildTemplateFile(AssetHeaders, ["Generator 500kVA", "Generator", "GEN-001", "ABC Factory", "Head Office", "Generator Room", "Caterpillar", "DE500", "500kVA", "2025-01-15", "Active"], "assets_import_template.csv");
    }

    [HttpGet("templates/users")]
    public async Task<IActionResult> DownloadUserTemplate(CancellationToken cancellationToken)
    {
        await LogTemplateDownloadAsync("users", cancellationToken);
        return BuildTemplateFile(UserHeaders, ["Dennis Yegon", "dennis@example.com", "+254700000000", "TenantAdmin", "Operations Manager", "Head Office", "false", "Active"], "users_import_template.csv");
    }

    [HttpGet("templates/branches")]
    public async Task<IActionResult> DownloadBranchTemplate(CancellationToken cancellationToken)
    {
        await LogTemplateDownloadAsync("branches", cancellationToken);
        return BuildTemplateFile(BranchHeaders, ["Head Office", "HO", "Kenya", "Nairobi", "Nairobi", "Upper Hill", "Active"], "branches_import_template.csv");
    }

    [HttpGet("templates/materials")]
    public async Task<IActionResult> DownloadMaterialTemplate(CancellationToken cancellationToken)
    {
        await LogTemplateDownloadAsync("materials", cancellationToken);
        return BuildTemplateFile(MaterialHeaders, ["Generator Oil", "MAT-001", "Consumables", "Litres", "20", "5", "1200", "Head Office"], "materials_import_template.csv");
    }

    [HttpPost("clients/preview")]
    public async Task<ActionResult<ImportPreviewResponse>> PreviewClients([FromForm] CsvUploadRequest request, CancellationToken cancellationToken)
    {
        var rows = await BuildClientPreviewAsync(request.File, cancellationToken);
        return Ok(new ImportPreviewResponse("Clients", rows.Count, rows));
    }

    [HttpPost("assets/preview")]
    public async Task<ActionResult<ImportPreviewResponse>> PreviewAssets([FromForm] CsvUploadRequest request, CancellationToken cancellationToken)
    {
        var rows = await BuildAssetPreviewAsync(request.File, cancellationToken);
        return Ok(new ImportPreviewResponse("Assets", rows.Count, rows));
    }

    [HttpPost("users/preview")]
    public async Task<ActionResult<ImportPreviewResponse>> PreviewUsers([FromForm] CsvUploadRequest request, CancellationToken cancellationToken)
    {
        var rows = await BuildUserPreviewAsync(request.File, cancellationToken);
        return Ok(new ImportPreviewResponse("Users", rows.Count, rows));
    }

    [HttpPost("branches/preview")]
    public async Task<ActionResult<ImportPreviewResponse>> PreviewBranches([FromForm] CsvUploadRequest request, CancellationToken cancellationToken)
    {
        var rows = await BuildBranchPreviewAsync(request.File, cancellationToken);
        return Ok(new ImportPreviewResponse("Branches", rows.Count, rows));
    }

    [HttpPost("materials/preview")]
    public async Task<ActionResult<ImportPreviewResponse>> PreviewMaterials([FromForm] CsvUploadRequest request, CancellationToken cancellationToken)
    {
        var rows = await BuildMaterialPreviewAsync(request.File, cancellationToken);
        return Ok(new ImportPreviewResponse("Materials", rows.Count, rows));
    }

    [HttpPost("clients/commit")]
    public async Task<ActionResult<ImportCommitResponse>> CommitClients([FromForm] CsvUploadRequest request, CancellationToken cancellationToken)
    {
        var rows = await BuildClientPreviewAsync(request.File, cancellationToken);
        var successful = 0;
        var failed = 0;

        foreach (var row in rows)
        {
            if (!row.IsValid)
            {
                failed++;
                continue;
            }

            var client = new Client
            {
                TenantId = TenantId,
                ClientName = row.RawValues["ClientName"]!,
                Email = row.RawValues["Email"],
                Phone = row.RawValues["Phone"],
                Location = BuildJoinedValue(row.RawValues["Address"], row.RawValues["City"], row.RawValues["County"], row.RawValues["Country"]),
                ContactPerson = row.RawValues["ContactPerson"],
                Notes = BuildStatusNote(row.RawValues["Status"]),
                IsActive = IsActiveStatus(row.RawValues["Status"])
            };

            dbContext.Clients.Add(client);
            successful++;
        }

        var skipped = failed;
        dbContext.ImportBatches.Add(new ImportBatch
        {
            TenantId = TenantId,
            ImportType = "Clients",
            FileName = request.File.FileName,
            TotalRows = rows.Count,
            SuccessfulRows = successful,
            FailedRows = failed,
            Status = failed == 0 ? "Completed" : "CompletedWithErrors"
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(
            TenantId,
            UserId,
            "Import completed",
            nameof(ImportBatch),
            "clients",
            $"Completed client import with {successful} successful rows and {failed} failed rows.",
            cancellationToken);

        return Ok(new ImportCommitResponse(rows.Count, successful, failed, skipped));
    }

    [HttpPost("assets/commit")]
    public async Task<ActionResult<ImportCommitResponse>> CommitAssets([FromForm] CsvUploadRequest request, CancellationToken cancellationToken)
    {
        var rows = await BuildAssetPreviewAsync(request.File, cancellationToken);
        var successful = 0;
        var failed = 0;

        foreach (var row in rows)
        {
            if (!row.IsValid)
            {
                failed++;
                continue;
            }

            var clientName = row.RawValues["ClientName"]!;
            var client = await dbContext.Clients.SingleAsync(
                x => x.TenantId == TenantId && x.IsActive && x.ClientName.ToLower() == clientName.ToLower(),
                cancellationToken);

            var branchId = await dbContext.Branches
                .Where(x => x.TenantId == TenantId && x.IsActive && row.RawValues["BranchName"] != null && x.Name.ToLower() == row.RawValues["BranchName"]!.ToLower())
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            var asset = new Asset
            {
                TenantId = TenantId,
                ClientId = client.Id,
                BranchId = branchId,
                AssetName = row.RawValues["AssetName"]!,
                AssetCode = row.RawValues["SerialNumber"]!,
                AssetType = row.RawValues["AssetType"],
                Location = row.RawValues["Location"],
                SerialNumber = row.RawValues["SerialNumber"],
                Manufacturer = row.RawValues["Manufacturer"],
                Model = row.RawValues["Model"],
                InstallationDate = ParseNullableDate(row.RawValues["InstallDate"]),
                RecommendedPmFrequency = "Monthly",
                AutoSchedulePm = true,
                Notes = AppendNote($"Capacity: {row.RawValues["Capacity"]}", BuildStatusNote(row.RawValues["Status"])),
                Status = string.IsNullOrWhiteSpace(row.RawValues["Status"]) ? "Active" : row.RawValues["Status"]!,
                NextPmDate = CalculateNextPmDate(
                    ParseNullableDate(row.RawValues["InstallDate"]),
                    "Monthly")
            };

            dbContext.Assets.Add(asset);
            await dbContext.SaveChangesAsync(cancellationToken);
            await preventiveMaintenancePlanService.SyncForAssetAsync(asset, cancellationToken);
            successful++;
        }

        var skipped = failed;
        dbContext.ImportBatches.Add(new ImportBatch
        {
            TenantId = TenantId,
            ImportType = "Assets",
            FileName = request.File.FileName,
            TotalRows = rows.Count,
            SuccessfulRows = successful,
            FailedRows = failed,
            Status = failed == 0 ? "Completed" : "CompletedWithErrors"
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(
            TenantId,
            UserId,
            "Import completed",
            nameof(ImportBatch),
            "assets",
            $"Completed asset import with {successful} successful rows and {failed} failed rows.",
            cancellationToken);

        return Ok(new ImportCommitResponse(rows.Count, successful, failed, skipped));
    }

    [HttpPost("users/commit")]
    public async Task<ActionResult<ImportCommitResponse>> CommitUsers([FromForm] CsvUploadRequest request, CancellationToken cancellationToken)
    {
        var rows = await BuildUserPreviewAsync(request.File, cancellationToken);
        var branchLookup = await dbContext.Branches
            .Where(x => x.TenantId == TenantId && x.IsActive)
            .ToDictionaryAsync(x => x.Name.ToLower(), x => x.Id, cancellationToken);

        var successful = 0;
        var failed = 0;

        foreach (var row in rows)
        {
            if (!row.IsValid)
            {
                failed++;
                continue;
            }

            var role = NormalizeImportedRole(row.RawValues["Role"]);
            var branchId = ResolveBranchId(row.RawValues["BranchName"], branchLookup);
            var jobTitle = Normalize(row.RawValues["JobTitle"]);
            var user = new User
            {
                TenantId = TenantId,
                FullName = row.RawValues["FullName"]!,
                Email = row.RawValues["Email"]!.Trim().ToLowerInvariant(),
                Role = role,
                JobTitle = jobTitle,
                IsActive = IsActiveStatus(row.RawValues["Status"]),
                HasAllBranchAccess = string.Equals(role, AppRoles.Admin, StringComparison.OrdinalIgnoreCase),
                DefaultBranchId = branchId,
                Permission = ToPermissionEntity(permissionTemplateService.GetDefaultPermissions(role, jobTitle))
            };
            user.PasswordHash = passwordHasher.HashPassword(user, DefaultImportedPassword);

            dbContext.Users.Add(user);
            await dbContext.SaveChangesAsync(cancellationToken);

            if (ParseBoolean(row.RawValues["IsTechnician"]))
            {
                dbContext.Technicians.Add(new Technician
                {
                    TenantId = TenantId,
                    UserId = user.Id,
                    BranchId = branchId,
                    FullName = user.FullName,
                    Email = user.Email,
                    Phone = Normalize(row.RawValues["Phone"]),
                    IsActive = user.IsActive
                });
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            successful++;
        }

        var skipped = failed;
        dbContext.ImportBatches.Add(new ImportBatch
        {
            TenantId = TenantId,
            ImportType = "Users",
            FileName = request.File.FileName,
            TotalRows = rows.Count,
            SuccessfulRows = successful,
            FailedRows = failed,
            Status = failed == 0 ? "Completed" : "CompletedWithErrors"
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(
            TenantId,
            UserId,
            "Import completed",
            nameof(ImportBatch),
            "users",
            $"Completed user import with {successful} successful rows and {failed} failed rows.",
            cancellationToken);

        return Ok(new ImportCommitResponse(rows.Count, successful, failed, skipped));
    }

    [HttpPost("branches/commit")]
    public async Task<ActionResult<ImportCommitResponse>> CommitBranches([FromForm] CsvUploadRequest request, CancellationToken cancellationToken)
    {
        var rows = await BuildBranchPreviewAsync(request.File, cancellationToken);
        var successful = 0;
        var failed = 0;

        foreach (var row in rows)
        {
            if (!row.IsValid)
            {
                failed++;
                continue;
            }

            dbContext.Branches.Add(new Branch
            {
                TenantId = TenantId,
                Name = row.RawValues["BranchName"]!,
                Code = row.RawValues["Code"]!.Trim().ToUpperInvariant(),
                Location = BuildJoinedValue(row.RawValues["City"], row.RawValues["County"], row.RawValues["Country"]),
                Address = Normalize(row.RawValues["Address"]),
                IsActive = IsActiveStatus(row.RawValues["Status"])
            });
            successful++;
        }

        var skipped = failed;
        dbContext.ImportBatches.Add(new ImportBatch
        {
            TenantId = TenantId,
            ImportType = "Branches",
            FileName = request.File.FileName,
            TotalRows = rows.Count,
            SuccessfulRows = successful,
            FailedRows = failed,
            Status = failed == 0 ? "Completed" : "CompletedWithErrors"
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(
            TenantId,
            UserId,
            "Import completed",
            nameof(ImportBatch),
            "branches",
            $"Completed branch import with {successful} successful rows and {failed} failed rows.",
            cancellationToken);

        return Ok(new ImportCommitResponse(rows.Count, successful, failed, skipped));
    }

    [HttpPost("materials/commit")]
    public async Task<ActionResult<ImportCommitResponse>> CommitMaterials([FromForm] CsvUploadRequest request, CancellationToken cancellationToken)
    {
        var rows = await BuildMaterialPreviewAsync(request.File, cancellationToken);
        var branchLookup = await dbContext.Branches
            .Where(x => x.TenantId == TenantId && x.IsActive)
            .ToDictionaryAsync(x => x.Name.ToLower(), x => x.Id, cancellationToken);

        var successful = 0;
        var failed = 0;

        foreach (var row in rows)
        {
            if (!row.IsValid)
            {
                failed++;
                continue;
            }

            var item = new MaterialItem
            {
                TenantId = TenantId,
                ItemName = row.RawValues["Material Name"]!,
                ItemCode = row.RawValues["Material Code"]!,
                Category = row.RawValues["Category"],
                UnitOfMeasure = row.RawValues["Unit"]!,
                QuantityOnHand = ParseDecimal(row.RawValues["Opening Quantity"]) ?? 0,
                ReorderLevel = ParseDecimal(row.RawValues["Reorder Level"]) ?? 0,
                UnitCost = ParseDecimal(row.RawValues["Unit Cost"]),
                IsActive = true
            };

            dbContext.MaterialItems.Add(item);
            successful++;
        }

        var skipped = failed;
        dbContext.ImportBatches.Add(new ImportBatch
        {
            TenantId = TenantId,
            ImportType = "Materials",
            FileName = request.File.FileName,
            TotalRows = rows.Count,
            SuccessfulRows = successful,
            FailedRows = failed,
            Status = failed == 0 ? "Completed" : "CompletedWithErrors"
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(
            TenantId,
            UserId,
            "Import completed",
            nameof(ImportBatch),
            "materials",
            $"Completed material import with {successful} successful rows and {failed} failed rows.",
            cancellationToken);

        return Ok(new ImportCommitResponse(rows.Count, successful, failed, skipped));
    }

    private async Task<List<ImportPreviewRowResponse>> BuildClientPreviewAsync(IFormFile file, CancellationToken cancellationToken)
    {
        var records = await ReadCsvAsync(file, ClientHeaders.Length, cancellationToken);
        var existingNames = await dbContext.Clients
            .Where(x => x.TenantId == TenantId && x.IsActive)
            .Select(x => x.ClientName.ToLower())
            .ToListAsync(cancellationToken);
        var seen = new HashSet<string>(existingNames);
        var results = new List<ImportPreviewRowResponse>();

        foreach (var record in records)
        {
            var rawValues = ToDictionary(ClientHeaders, record.Values);
            var errors = new List<string>();
            var name = GetValue(rawValues, "ClientName");

            if (string.IsNullOrWhiteSpace(name))
            {
                errors.Add("Client Name is required.");
            }
            else if (!seen.Add(name.ToLowerInvariant()))
            {
                errors.Add("Duplicate client name for this tenant.");
            }

            results.Add(new ImportPreviewRowResponse(record.RowNumber, rawValues, errors.Count == 0, errors));
        }

        return results;
    }

    private async Task<List<ImportPreviewRowResponse>> BuildAssetPreviewAsync(IFormFile file, CancellationToken cancellationToken)
    {
        var records = await ReadCsvAsync(file, AssetHeaders.Length, cancellationToken);
        var clientNames = await dbContext.Clients
            .Where(x => x.TenantId == TenantId && x.IsActive)
            .Select(x => x.ClientName.ToLower())
            .ToListAsync(cancellationToken);
        var branchNames = await dbContext.Branches
            .Where(x => x.TenantId == TenantId && x.IsActive)
            .Select(x => x.Name.ToLower())
            .ToListAsync(cancellationToken);
        var existingCodes = await dbContext.Assets
            .Where(x => x.TenantId == TenantId)
            .Select(x => x.AssetCode.ToLower())
            .ToListAsync(cancellationToken);
        var clientLookup = new HashSet<string>(clientNames);
        var branchLookup = new HashSet<string>(branchNames);
        var codeLookup = new HashSet<string>(existingCodes);
        var results = new List<ImportPreviewRowResponse>();

        foreach (var record in records)
        {
            var rawValues = ToDictionary(AssetHeaders, record.Values);
            var errors = new List<string>();
            var clientName = GetValue(rawValues, "ClientName");
            var branchName = GetValue(rawValues, "BranchName");
            var assetName = GetValue(rawValues, "AssetName");
            var assetCode = GetValue(rawValues, "SerialNumber");

            if (string.IsNullOrWhiteSpace(clientName))
            {
                errors.Add("ClientName is required.");
            }
            else if (!clientLookup.Contains(clientName.ToLowerInvariant()))
            {
                errors.Add("ClientName must exist.");
            }

            if (!string.IsNullOrWhiteSpace(branchName) && !branchLookup.Contains(branchName.ToLowerInvariant()))
            {
                errors.Add("BranchName must exist when provided.");
            }

            if (string.IsNullOrWhiteSpace(assetName))
            {
                errors.Add("AssetName is required.");
            }

            if (string.IsNullOrWhiteSpace(assetCode))
            {
                errors.Add("SerialNumber is required.");
            }
            else if (!codeLookup.Add(assetCode.ToLowerInvariant()))
            {
                errors.Add("SerialNumber must be unique per tenant.");
            }

            if (!string.IsNullOrWhiteSpace(rawValues["InstallDate"]) && ParseNullableDate(rawValues["InstallDate"]) is null)
            {
                errors.Add("InstallDate must be a valid date.");
            }

            results.Add(new ImportPreviewRowResponse(record.RowNumber, rawValues, errors.Count == 0, errors));
        }

        return results;
    }

    private async Task<List<ImportPreviewRowResponse>> BuildUserPreviewAsync(IFormFile file, CancellationToken cancellationToken)
    {
        var records = await ReadCsvAsync(file, UserHeaders.Length, cancellationToken);
        var existingEmails = await dbContext.Users
            .Where(x => x.TenantId == TenantId)
            .Select(x => x.Email.ToLower())
            .ToListAsync(cancellationToken);
        var branchNames = await dbContext.Branches
            .Where(x => x.TenantId == TenantId && x.IsActive)
            .Select(x => x.Name.ToLower())
            .ToListAsync(cancellationToken);

        var emailLookup = new HashSet<string>(existingEmails);
        var branchLookup = new HashSet<string>(branchNames);
        var results = new List<ImportPreviewRowResponse>();

        foreach (var record in records)
        {
            var rawValues = ToDictionary(UserHeaders, record.Values);
            var errors = new List<string>();
            var fullName = GetValue(rawValues, "FullName");
            var email = GetValue(rawValues, "Email");
            var branchName = GetValue(rawValues, "BranchName");

            if (string.IsNullOrWhiteSpace(fullName))
            {
                errors.Add("FullName is required.");
            }

            if (string.IsNullOrWhiteSpace(email))
            {
                errors.Add("Email is required.");
            }
            else if (!email.Contains('@'))
            {
                errors.Add("Email must be valid.");
            }
            else if (!emailLookup.Add(email.ToLowerInvariant()))
            {
                errors.Add("Email must be unique per tenant.");
            }

            if (!string.IsNullOrWhiteSpace(branchName) && !branchLookup.Contains(branchName.ToLowerInvariant()))
            {
                errors.Add("BranchName must exist when provided.");
            }

            try
            {
                NormalizeImportedRole(rawValues["Role"]);
            }
            catch (Exception error) when (error is BusinessRuleException or ForbiddenException)
            {
                errors.Add(error.Message);
            }

            results.Add(new ImportPreviewRowResponse(record.RowNumber, rawValues, errors.Count == 0, errors));
        }

        return results;
    }

    private async Task<List<ImportPreviewRowResponse>> BuildBranchPreviewAsync(IFormFile file, CancellationToken cancellationToken)
    {
        var records = await ReadCsvAsync(file, BranchHeaders.Length, cancellationToken);
        var existingNames = await dbContext.Branches
            .Where(x => x.TenantId == TenantId)
            .Select(x => x.Name.ToLower())
            .ToListAsync(cancellationToken);
        var existingCodes = await dbContext.Branches
            .Where(x => x.TenantId == TenantId)
            .Select(x => x.Code.ToLower())
            .ToListAsync(cancellationToken);

        var nameLookup = new HashSet<string>(existingNames);
        var codeLookup = new HashSet<string>(existingCodes);
        var results = new List<ImportPreviewRowResponse>();

        foreach (var record in records)
        {
            var rawValues = ToDictionary(BranchHeaders, record.Values);
            var errors = new List<string>();
            var branchName = GetValue(rawValues, "BranchName");
            var code = GetValue(rawValues, "Code");

            if (string.IsNullOrWhiteSpace(branchName))
            {
                errors.Add("BranchName is required.");
            }
            else if (!nameLookup.Add(branchName.ToLowerInvariant()))
            {
                errors.Add("BranchName must be unique per tenant.");
            }

            if (string.IsNullOrWhiteSpace(code))
            {
                errors.Add("Code is required.");
            }
            else if (!codeLookup.Add(code.ToLowerInvariant()))
            {
                errors.Add("Code must be unique per tenant.");
            }

            results.Add(new ImportPreviewRowResponse(record.RowNumber, rawValues, errors.Count == 0, errors));
        }

        return results;
    }

    private async Task<List<ImportPreviewRowResponse>> BuildMaterialPreviewAsync(IFormFile file, CancellationToken cancellationToken)
    {
        var records = await ReadCsvAsync(file, MaterialHeaders.Length, cancellationToken);
        var existingCodes = await dbContext.MaterialItems
            .Where(x => x.TenantId == TenantId && x.IsActive)
            .Select(x => x.ItemCode.ToLower())
            .ToListAsync(cancellationToken);
        var branchNames = await dbContext.Branches
            .Where(x => x.TenantId == TenantId && x.IsActive)
            .Select(x => x.Name.ToLower())
            .ToListAsync(cancellationToken);

        var codeLookup = new HashSet<string>(existingCodes);
        var branchLookup = new HashSet<string>(branchNames);
        var results = new List<ImportPreviewRowResponse>();

        foreach (var record in records)
        {
            var rawValues = ToDictionary(MaterialHeaders, record.Values);
            var errors = new List<string>();
            var itemName = GetValue(rawValues, "Material Name");
            var itemCode = GetValue(rawValues, "Material Code");
            var unit = GetValue(rawValues, "Unit");
            var branchName = GetValue(rawValues, "Branch");

            if (string.IsNullOrWhiteSpace(itemName))
            {
                errors.Add("Material Name is required.");
            }

            if (string.IsNullOrWhiteSpace(itemCode))
            {
                errors.Add("Material Code is required.");
            }
            else if (!codeLookup.Add(itemCode.ToLowerInvariant()))
            {
                errors.Add("Material Code must be unique per tenant.");
            }

            if (string.IsNullOrWhiteSpace(unit))
            {
                errors.Add("Unit is required.");
            }

            if (!string.IsNullOrWhiteSpace(branchName) && !branchLookup.Contains(branchName.ToLowerInvariant()))
            {
                errors.Add("Branch must exist when provided.");
            }

            if (!TryParseDecimal(rawValues["Opening Quantity"], out _))
            {
                errors.Add("Opening Quantity must be numeric.");
            }

            if (!TryParseDecimal(rawValues["Reorder Level"], out _))
            {
                errors.Add("Reorder Level must be numeric.");
            }

            if (!TryParseDecimal(rawValues["Unit Cost"], out _, true))
            {
                errors.Add("Unit Cost must be numeric.");
            }

            results.Add(new ImportPreviewRowResponse(record.RowNumber, rawValues, errors.Count == 0, errors));
        }

        return results;
    }

    private static async Task<List<CsvRecord>> ReadCsvAsync(IFormFile file, int expectedColumnCount, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            throw new BusinessRuleException("CSV file is required.");
        }

        if (!string.Equals(Path.GetExtension(file.FileName), ".csv", StringComparison.OrdinalIgnoreCase))
        {
            throw new BusinessRuleException("Only CSV files are supported.");
        }

        using var stream = file.OpenReadStream();
        using var reader = new StreamReader(stream);
        var lines = new List<string>();
        while (true)
        {
            var line = await reader.ReadLineAsync(cancellationToken);
            if (line is null)
            {
                break;
            }

            lines.Add(line);
        }

        if (lines.Count == 0)
        {
            return [];
        }

        var headerValues = ParseCsvLine(lines[0]);
        if (headerValues.Count < expectedColumnCount)
        {
            throw new BusinessRuleException("The import file is missing one or more required headers.");
        }

        var dataLines = lines.Skip(1).Where(line => !string.IsNullOrWhiteSpace(line)).ToList();
        var records = new List<CsvRecord>();

        for (var index = 0; index < dataLines.Count; index++)
        {
            var values = ParseCsvLine(dataLines[index]);
            if (values.Count < expectedColumnCount)
            {
                values.AddRange(Enumerable.Repeat(string.Empty, expectedColumnCount - values.Count));
            }

            records.Add(new CsvRecord(index + 2, values.Take(expectedColumnCount).ToArray()));
        }

        return records;
    }

    private static List<string> ParseCsvLine(string line)
    {
        var values = new List<string>();
        var current = new StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (ch == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    current.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (ch == ',' && !inQuotes)
            {
                values.Add(current.ToString().Trim());
                current.Clear();
            }
            else
            {
                current.Append(ch);
            }
        }

        values.Add(current.ToString().Trim());
        return values;
    }

    private static Dictionary<string, string?> ToDictionary(string[] headers, string[] values)
    {
        var dictionary = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < headers.Length; i++)
        {
            dictionary[headers[i]] = i < values.Length ? values[i] : null;
        }

        return dictionary;
    }

    private static string? GetValue(IReadOnlyDictionary<string, string?> values, string key) =>
        values.TryGetValue(key, out var value) ? value?.Trim() : null;

    private static bool ParseAutoSchedule(string? value, out bool result)
    {
        var normalized = value?.Trim().ToLowerInvariant();
        switch (normalized)
        {
            case "yes":
            case "true":
                result = true;
                return true;
            case "no":
            case "false":
            case "":
            case null:
                result = false;
                return true;
            default:
                result = false;
                return false;
        }
    }

    private static string NormalizeImportedRole(string? value)
    {
        var normalized = value?.Trim().ToLowerInvariant();
        return normalized switch
        {
            null or "" or "user" or "technician" or "supervisor" or "normaluser" or "normal user" or "requester" => AppRoles.User,
            "tenantadmin" or "tenant admin" or "admin" => AppRoles.Admin,
            "platformowner" or "platform owner" or "superadmin" or "super admin" => throw new ForbiddenException("Only platform owners can create PlatformOwner accounts."),
            _ => throw new BusinessRuleException("Role must be TenantAdmin, Supervisor, Technician, NormalUser, or User.")
        };
    }

    private static bool ParseBoolean(string? value)
    {
        var normalized = value?.Trim().ToLowerInvariant();
        return normalized is "true" or "yes" or "1";
    }

    private static bool IsActiveStatus(string? value)
    {
        var normalized = value?.Trim().ToLowerInvariant();
        return normalized is null or "" or "active" or "enabled" or "true";
    }

    private static string? BuildStatusNote(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : $"Imported status: {value.Trim()}";

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? BuildJoinedValue(params string?[] values)
    {
        var parts = values.Select(Normalize).Where(value => !string.IsNullOrWhiteSpace(value)).ToList();
        return parts.Count == 0 ? null : string.Join(", ", parts);
    }

    private static string? AppendNote(string? first, string? second)
    {
        var parts = new[] { Normalize(first), Normalize(second) }.Where(value => !string.IsNullOrWhiteSpace(value)).ToList();
        return parts.Count == 0 ? null : string.Join(" | ", parts);
    }

    private static bool TryParseDecimal(string? value, out decimal result, bool allowEmpty = false)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            result = 0;
            return allowEmpty;
        }

        return decimal.TryParse(value, out result);
    }

    private static decimal? ParseDecimal(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return decimal.TryParse(value, out var result) ? result : null;
    }

    private static Guid? ResolveBranchId(string? branchName, IReadOnlyDictionary<string, Guid> branchLookup)
    {
        if (string.IsNullOrWhiteSpace(branchName))
        {
            return null;
        }

        return branchLookup.TryGetValue(branchName.Trim().ToLowerInvariant(), out var branchId) ? branchId : null;
    }

    private static UserPermission ToPermissionEntity(UserPermissionsModel permissions) =>
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
            CanViewReports = permissions.CanViewReports
        };

    private Task LogTemplateDownloadAsync(string templateType, CancellationToken cancellationToken) =>
        auditLogService.LogAsync(
            TenantId,
            UserId,
            "Import template downloaded",
            nameof(ImportBatch),
            templateType,
            $"Downloaded {templateType} import template.",
            cancellationToken);

    private static IActionResult BuildTemplateFile(IReadOnlyList<string> headers, IReadOnlyList<string> sampleRow, string fileName)
    {
        var content = string.Join(",", headers) + Environment.NewLine + string.Join(",", sampleRow) + Environment.NewLine;
        return new FileContentResult(Encoding.UTF8.GetBytes(content), "text/csv")
        {
            FileDownloadName = fileName
        };
    }

    private static DateTime? ParseNullableDate(string? value) =>
        DateTime.TryParse(value, out var parsed) ? parsed : null;

    private static DateTime? CalculateNextPmDate(DateTime? installationDate, string? frequency)
    {
        if (!installationDate.HasValue || string.IsNullOrWhiteSpace(frequency))
        {
            return null;
        }

        return frequency.Trim().ToLowerInvariant() switch
        {
            "daily" => installationDate.Value.AddDays(1),
            "weekly" => installationDate.Value.AddDays(7),
            "monthly" => installationDate.Value.AddMonths(1),
            "quarterly" => installationDate.Value.AddMonths(3),
            "semi-annual" => installationDate.Value.AddMonths(6),
            "annual" => installationDate.Value.AddYears(1),
            "yearly" => installationDate.Value.AddYears(1),
            _ => installationDate.Value.AddMonths(1)
        };
    }

    private sealed record CsvRecord(int RowNumber, string[] Values);
}

public sealed record CsvUploadRequest(IFormFile File);

public sealed record ImportPreviewResponse(string ImportType, int TotalRows, IReadOnlyCollection<ImportPreviewRowResponse> Rows);

public sealed record ImportPreviewRowResponse(int RowNumber, IReadOnlyDictionary<string, string?> RawValues, bool IsValid, IReadOnlyCollection<string> Errors);

public sealed record ImportCommitResponse(int TotalRows, int SuccessfulRows, int FailedRows, int SkippedRows);
