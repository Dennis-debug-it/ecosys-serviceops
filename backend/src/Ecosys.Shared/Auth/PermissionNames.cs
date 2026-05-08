namespace Ecosys.Shared.Auth;

public static class PermissionNames
{
    public const string CanViewWorkOrders = "can_view_workorders";
    public const string CanCreateWorkOrders = "can_create_workorders";
    public const string CanAssignWorkOrders = "can_assign_workorders";
    public const string CanCompleteWorkOrders = "can_complete_workorders";
    public const string CanApproveMaterials = "can_approve_materials";
    public const string CanIssueMaterials = "can_issue_materials";
    public const string CanManageAssets = "can_manage_assets";
    public const string CanManageSettings = "can_manage_settings";
    public const string CanViewReports = "can_view_reports";

    public static readonly string[] All =
    [
        CanViewWorkOrders,
        CanCreateWorkOrders,
        CanAssignWorkOrders,
        CanCompleteWorkOrders,
        CanApproveMaterials,
        CanIssueMaterials,
        CanManageAssets,
        CanManageSettings,
        CanViewReports
    ];
}
