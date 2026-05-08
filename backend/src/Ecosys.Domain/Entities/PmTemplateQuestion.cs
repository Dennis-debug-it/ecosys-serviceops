using Ecosys.Domain.Common;

namespace Ecosys.Domain.Entities;

public sealed class PmTemplateQuestion : AuditableEntity
{
    public Guid PmTemplateId { get; set; }
    public string? SectionName { get; set; }
    public string Prompt { get; set; } = string.Empty;
    public string ResponseType { get; set; } = "text";
    public bool IsRequired { get; set; }
    public int SortOrder { get; set; }
    public string? OptionsJson { get; set; }

    public PmTemplate? PmTemplate { get; set; }
}
