using Ecosys.Domain.Entities;
using Ecosys.Infrastructure.Data;
using Ecosys.Shared.Auth;
using Ecosys.Shared.Errors;
using Microsoft.EntityFrameworkCore;

namespace Ecosys.Infrastructure.Services;

public sealed record UserPermissionsModel(
    bool CanViewWorkOrders,
    bool CanCreateWorkOrders,
    bool CanAssignWorkOrders,
    bool CanCompleteWorkOrders,
    bool CanApproveMaterials,
    bool CanIssueMaterials,
    bool CanManageAssets,
    bool CanManageSettings,
    bool CanViewReports);

public interface IUserPermissionTemplateService
{
    UserPermissionsModel GetDefaultPermissions(string role, string? jobTitle);
    UserPermissionsModel GetFullTenantPermissions();
    UserPermissionsModel GetSuperAdminPermissions();
    UserPermissionsModel Merge(string role, string? jobTitle, UserPermissionsModel? customPermissions);
}

public interface IUserAccessService
{
    void EnsureAdmin();
    void EnsureAdminOrPermission(string permissionName);
    void EnsureTenantOperationalAccess();
}

internal sealed class UserPermissionTemplateService : IUserPermissionTemplateService
{
    public UserPermissionsModel GetDefaultPermissions(string role, string? jobTitle)
    {
        if (string.Equals(role, AppRoles.SuperAdmin, StringComparison.OrdinalIgnoreCase))
        {
            return GetSuperAdminPermissions();
        }

        if (string.Equals(role, AppRoles.Admin, StringComparison.OrdinalIgnoreCase))
        {
            return GetFullTenantPermissions();
        }

        return (jobTitle ?? string.Empty).Trim() switch
        {
            "Technician" => new UserPermissionsModel(true, false, false, true, false, false, false, false, false),
            "Supervisor" => new UserPermissionsModel(true, true, true, true, false, false, false, false, true),
            "Store Manager" => new UserPermissionsModel(true, false, false, false, true, true, false, false, true),
            "Helpdesk Officer" => new UserPermissionsModel(true, true, false, false, false, false, false, false, false),
            "Manager" => new UserPermissionsModel(true, false, false, false, false, false, false, false, true),
            _ => new UserPermissionsModel(true, false, false, false, false, false, false, false, false)
        };
    }

    public UserPermissionsModel GetFullTenantPermissions() =>
        new(true, true, true, true, true, true, true, true, true);

    public UserPermissionsModel GetSuperAdminPermissions() =>
        new(false, false, false, false, false, false, false, false, false);

    public UserPermissionsModel Merge(string role, string? jobTitle, UserPermissionsModel? customPermissions)
    {
        if (string.Equals(role, AppRoles.Admin, StringComparison.OrdinalIgnoreCase))
        {
            return GetFullTenantPermissions();
        }

        if (string.Equals(role, AppRoles.SuperAdmin, StringComparison.OrdinalIgnoreCase))
        {
            return GetSuperAdminPermissions();
        }

        return customPermissions ?? GetDefaultPermissions(role, jobTitle);
    }
}

internal sealed class UserAccessService(ITenantContext tenantContext) : IUserAccessService
{
    public void EnsureAdmin()
    {
        EnsureTenantOperationalAccess();

        if (!tenantContext.IsAdmin)
        {
            throw new ForbiddenException("Admin access is required for this action.");
        }
    }

    public void EnsureAdminOrPermission(string permissionName)
    {
        EnsureTenantOperationalAccess();

        if (tenantContext.IsAdmin)
        {
            return;
        }

        if (!tenantContext.HasPermission(permissionName))
        {
            throw new ForbiddenException("You do not have permission to perform this action.");
        }
    }

    public void EnsureTenantOperationalAccess()
    {
        if (tenantContext.IsSuperAdmin)
        {
            throw new ForbiddenException("SuperAdmin accounts cannot access tenant operational endpoints.");
        }
    }
}

public interface IStockLedgerService
{
    Task<StockMovement> RecordReceiptAsync(MaterialItem material, Guid? branchId, decimal quantity, Guid? createdByUserId, string? reason, string? referenceNumber, Guid? workOrderId = null, Guid? materialRequestId = null, CancellationToken cancellationToken = default);
    Task<StockMovement> RecordAdjustmentAsync(MaterialItem material, Guid? branchId, decimal quantityChange, Guid? createdByUserId, string? reason, string? referenceNumber = null, Guid? workOrderId = null, Guid? materialRequestId = null, CancellationToken cancellationToken = default);
    Task<StockMovement> RecordIssueAsync(MaterialItem material, Guid? branchId, decimal quantity, Guid? createdByUserId, string? reason, string? referenceNumber = null, Guid? workOrderId = null, Guid? materialRequestId = null, CancellationToken cancellationToken = default);
    Task<StockMovement> RecordReturnAsync(MaterialItem material, Guid? branchId, decimal quantity, Guid? createdByUserId, string? reason, string? referenceNumber = null, Guid? workOrderId = null, Guid? materialRequestId = null, CancellationToken cancellationToken = default);
    Task<StockMovement> RecordTransferOutAsync(MaterialItem material, Guid fromBranchId, decimal quantity, Guid? createdByUserId, string? reason, string? referenceNumber = null, CancellationToken cancellationToken = default);
    Task<StockMovement> RecordTransferInAsync(MaterialItem material, Guid toBranchId, decimal quantity, Guid? createdByUserId, string? reason, string? referenceNumber = null, CancellationToken cancellationToken = default);
}

internal sealed class StockLedgerService(AppDbContext dbContext) : IStockLedgerService
{
    private static readonly HashSet<string> AllowedMovementTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "Receipt",
        "Issue",
        "Return",
        "Adjustment",
        "TransferOut",
        "TransferIn"
    };

    public Task<StockMovement> RecordReceiptAsync(MaterialItem material, Guid? branchId, decimal quantity, Guid? createdByUserId, string? reason, string? referenceNumber, Guid? workOrderId = null, Guid? materialRequestId = null, CancellationToken cancellationToken = default) =>
        RecordAsync(material, branchId, "Receipt", quantity, createdByUserId, reason, referenceNumber, workOrderId, materialRequestId, cancellationToken);

    public Task<StockMovement> RecordAdjustmentAsync(MaterialItem material, Guid? branchId, decimal quantityChange, Guid? createdByUserId, string? reason, string? referenceNumber = null, Guid? workOrderId = null, Guid? materialRequestId = null, CancellationToken cancellationToken = default)
    {
        if (quantityChange == 0)
        {
            throw new BusinessRuleException("Adjustment quantity change cannot be zero.");
        }

        return RecordAsync(material, branchId, "Adjustment", quantityChange, createdByUserId, reason, referenceNumber, workOrderId, materialRequestId, cancellationToken);
    }

    public async Task<StockMovement> RecordIssueAsync(MaterialItem material, Guid? branchId, decimal quantity, Guid? createdByUserId, string? reason, string? referenceNumber = null, Guid? workOrderId = null, Guid? materialRequestId = null, CancellationToken cancellationToken = default)
    {
        if (quantity <= 0)
        {
            throw new BusinessRuleException("Issue quantity must be greater than zero.");
        }

        var stock = await EnsureStockAsync(material, branchId, cancellationToken);
        if (stock.QuantityOnHand < quantity)
        {
            throw new BusinessRuleException($"Insufficient stock for material '{material.ItemName}'.");
        }

        return await RecordAsync(material, branchId, "Issue", -quantity, createdByUserId, reason, referenceNumber, workOrderId, materialRequestId, cancellationToken);
    }

    public Task<StockMovement> RecordReturnAsync(MaterialItem material, Guid? branchId, decimal quantity, Guid? createdByUserId, string? reason, string? referenceNumber = null, Guid? workOrderId = null, Guid? materialRequestId = null, CancellationToken cancellationToken = default)
    {
        if (quantity <= 0)
        {
            throw new BusinessRuleException("Return quantity must be greater than zero.");
        }

        return RecordAsync(material, branchId, "Return", quantity, createdByUserId, reason, referenceNumber, workOrderId, materialRequestId, cancellationToken);
    }

    public async Task<StockMovement> RecordTransferOutAsync(MaterialItem material, Guid fromBranchId, decimal quantity, Guid? createdByUserId, string? reason, string? referenceNumber = null, CancellationToken cancellationToken = default)
    {
        var movement = await RecordIssueAsync(material, fromBranchId, quantity, createdByUserId, reason, referenceNumber, cancellationToken: cancellationToken);
        movement.MovementType = "TransferOut";
        return movement;
    }

    public async Task<StockMovement> RecordTransferInAsync(MaterialItem material, Guid toBranchId, decimal quantity, Guid? createdByUserId, string? reason, string? referenceNumber = null, CancellationToken cancellationToken = default)
    {
        var movement = await RecordReceiptAsync(material, toBranchId, quantity, createdByUserId, reason, referenceNumber, cancellationToken: cancellationToken);
        movement.MovementType = "TransferIn";
        return movement;
    }

    private async Task<StockMovement> RecordAsync(
        MaterialItem material,
        Guid? branchId,
        string movementType,
        decimal quantityDelta,
        Guid? createdByUserId,
        string? reason,
        string? referenceNumber,
        Guid? workOrderId,
        Guid? materialRequestId,
        CancellationToken cancellationToken)
    {
        if (!AllowedMovementTypes.Contains(movementType))
        {
            throw new BusinessRuleException("Invalid stock movement type.");
        }

        if (quantityDelta == 0)
        {
            throw new BusinessRuleException("Quantity change cannot be zero.");
        }

        decimal balanceAfter;
        if (branchId.HasValue)
        {
            var stock = await EnsureStockAsync(material, branchId, cancellationToken);
            var nextBalance = stock.QuantityOnHand + quantityDelta;
            if (nextBalance < 0)
            {
                throw new BusinessRuleException("Stock update would reduce stock below zero.");
            }

            stock.QuantityOnHand = nextBalance;
            if (material.UnitCost.HasValue && !stock.UnitCost.HasValue)
            {
                stock.UnitCost = material.UnitCost;
            }

            balanceAfter = stock.QuantityOnHand;
        }
        else
        {
            var nextBalance = material.QuantityOnHand + quantityDelta;
            if (nextBalance < 0)
            {
                throw new BusinessRuleException("Stock update would reduce stock below zero.");
            }

            balanceAfter = nextBalance;
        }

        material.QuantityOnHand += quantityDelta;
        if (material.QuantityOnHand < 0)
        {
            throw new BusinessRuleException("Stock update would reduce stock below zero.");
        }

        var movement = new StockMovement
        {
            TenantId = material.TenantId,
            BranchId = branchId,
            MaterialId = material.Id,
            WorkOrderId = workOrderId,
            MaterialRequestId = materialRequestId,
            MovementType = movementType,
            Quantity = Math.Abs(quantityDelta),
            BalanceAfter = branchId.HasValue ? balanceAfter : material.QuantityOnHand,
            Reason = reason?.Trim(),
            ReferenceNumber = referenceNumber?.Trim(),
            CreatedByUserId = createdByUserId
        };

        dbContext.StockMovements.Add(movement);
        return movement;
    }

    private async Task<BranchMaterialStock> EnsureStockAsync(MaterialItem material, Guid? branchId, CancellationToken cancellationToken)
    {
        if (!branchId.HasValue)
        {
            return new BranchMaterialStock
            {
                TenantId = material.TenantId,
                MaterialId = material.Id,
                QuantityOnHand = material.QuantityOnHand,
                ReorderLevel = material.ReorderLevel,
                UnitCost = material.UnitCost
            };
        }

        var stock = await dbContext.BranchMaterialStocks.SingleOrDefaultAsync(
            x => x.TenantId == material.TenantId && x.BranchId == branchId.Value && x.MaterialId == material.Id,
            cancellationToken);

        if (stock is null)
        {
            stock = new BranchMaterialStock
            {
                TenantId = material.TenantId,
                BranchId = branchId.Value,
                MaterialId = material.Id,
                QuantityOnHand = 0,
                ReorderLevel = material.ReorderLevel,
                UnitCost = material.UnitCost
            };
            dbContext.BranchMaterialStocks.Add(stock);
        }

        return stock;
    }
}
