using Ecosys.Domain.Common;

namespace Ecosys.Domain.Entities;

public sealed class WorkOrderChecklistItem : AuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid WorkOrderId { get; set; }
    public Guid? PmTemplateQuestionId { get; set; }
    public string? SectionName { get; set; }
    public string QuestionText { get; set; } = string.Empty;
    public string InputType { get; set; } = "text";
    public string QuestionType { get; set; } = "PassFail";
    public string? Unit { get; set; }
    public bool IsRequired { get; set; }
    public bool RequiresNoteOnFail { get; set; }
    public int SortOrder { get; set; }
    public string? ResponseValue { get; set; }
    public decimal? NumberValue { get; set; }
    public string? TextValue { get; set; }
    public Guid? AttachmentId { get; set; }
    public string? Remarks { get; set; }
    public string? FailureNote { get; set; }
    public bool IsCompleted { get; set; }
    public Guid? CompletedByUserId { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? OptionsJson { get; set; }

    public Tenant? Tenant { get; set; }
    public WorkOrder? WorkOrder { get; set; }
    public PmTemplateQuestion? PmTemplateQuestion { get; set; }
    public User? CompletedByUser { get; set; }
    public Attachment? Attachment { get; set; }
}
