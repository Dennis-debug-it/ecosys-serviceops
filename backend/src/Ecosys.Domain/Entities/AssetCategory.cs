using Ecosys.Domain.Common;

namespace Ecosys.Domain.Entities;

public sealed class AssetCategory : AuditableEntity
{
    public Guid TenantId { get; set; }
    public string? ParentCategoryName { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Icon { get; set; } = "tool";
    public bool IsDefault { get; set; }
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; }

    public Tenant? Tenant { get; set; }
    public ICollection<AssetCategoryField> Fields { get; set; } = new List<AssetCategoryField>();
    public ICollection<Asset> Assets { get; set; } = new List<Asset>();
}

public sealed class AssetCategoryField : AuditableEntity
{
    public Guid AssetCategoryId { get; set; }
    public string FieldName { get; set; } = string.Empty;
    public string FieldLabel { get; set; } = string.Empty;
    public string FieldType { get; set; } = "Text";
    public string? DropdownOptions { get; set; }
    public string? Unit { get; set; }
    public bool IsRequired { get; set; }
    public int DisplayOrder { get; set; }

    public AssetCategory? AssetCategory { get; set; }
}

public sealed class AssetCustomFieldValue : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid AssetId { get; set; }
    public Guid FieldDefinitionId { get; set; }
    public string Value { get; set; } = string.Empty;

    public Tenant? Tenant { get; set; }
    public Asset? Asset { get; set; }
    public AssetCategoryField? FieldDefinition { get; set; }
}
