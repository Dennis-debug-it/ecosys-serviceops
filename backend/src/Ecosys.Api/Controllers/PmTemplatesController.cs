using Ecosys.Domain.Entities;
using Ecosys.Infrastructure.Data;
using Ecosys.Infrastructure.Services;
using Ecosys.Shared.Auth;
using Ecosys.Shared.Errors;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ecosys.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/templates")]
[Route("api/pm/templates")]
public sealed class PmTemplatesController(
    AppDbContext dbContext,
    ITenantContext tenantContext,
    IUserAccessService userAccessService) : TenantAwareControllerBase(tenantContext)
{
    private static readonly HashSet<string> AllowedCategories = new(StringComparer.OrdinalIgnoreCase)
    {
        "HVAC",
        "Generator",
        "UPS",
        "Solar"
    };

    private static readonly HashSet<string> AllowedQuestionTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "text",
        "boolean",
        "number",
        "date",
        "dropdown",
        "yesno",
        "passfail"
    };

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<TemplateResponse>>> GetAll(CancellationToken cancellationToken)
    {
        userAccessService.EnsureTenantOperationalAccess();
        var templates = await dbContext.PmTemplates
            .Include(x => x.Questions)
            .Where(x => x.TenantId == TenantId)
            .OrderBy(x => x.Category)
            .ThenBy(x => x.Name)
            .ToListAsync(cancellationToken);

        return Ok(templates.Select(Map).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TemplateResponse>> Get(Guid id, CancellationToken cancellationToken)
    {
        userAccessService.EnsureTenantOperationalAccess();
        var template = await dbContext.PmTemplates
            .Include(x => x.Questions)
            .SingleOrDefaultAsync(x => x.TenantId == TenantId && x.Id == id, cancellationToken)
            ?? throw new NotFoundException("PM template was not found.");

        return Ok(Map(template));
    }

    [HttpPost]
    public async Task<ActionResult<TemplateResponse>> Create([FromBody] UpsertTemplateRequest request, CancellationToken cancellationToken)
    {
        userAccessService.EnsureAdmin();
        Validate(request);

        var template = new PmTemplate
        {
            TenantId = TenantId,
            Category = NormalizeCategory(request.Category),
            Name = request.Name.Trim(),
            Description = Normalize(request.Description),
            AutoScheduleByDefault = false,
            IsActive = request.IsActive,
            Questions = request.Checklist
                .OrderBy(x => x.Order)
                .Select(MapQuestion)
                .ToList()
        };

        dbContext.PmTemplates.Add(template);
        await dbContext.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = template.Id }, Map(template));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TemplateResponse>> Update(Guid id, [FromBody] UpsertTemplateRequest request, CancellationToken cancellationToken)
    {
        userAccessService.EnsureAdmin();
        Validate(request);

        var template = await dbContext.PmTemplates
            .Include(x => x.Questions)
            .SingleOrDefaultAsync(x => x.TenantId == TenantId && x.Id == id, cancellationToken)
            ?? throw new NotFoundException("PM template was not found.");

        template.Category = NormalizeCategory(request.Category);
        template.Name = request.Name.Trim();
        template.Description = Normalize(request.Description);
        template.IsActive = request.IsActive;

        dbContext.PmTemplateQuestions.RemoveRange(template.Questions);
        template.Questions = request.Checklist
            .OrderBy(x => x.Order)
            .Select(MapQuestion)
            .ToList();

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(Map(template));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        userAccessService.EnsureAdmin();

        var template = await dbContext.PmTemplates
            .SingleOrDefaultAsync(x => x.TenantId == TenantId && x.Id == id, cancellationToken)
            ?? throw new NotFoundException("PM template was not found.");

        dbContext.PmTemplates.Remove(template);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static void Validate(UpsertTemplateRequest request)
    {
        if (!AllowedCategories.Contains(request.Category))
        {
            throw new BusinessRuleException("Category must be HVAC, Generator, UPS, or Solar.");
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new BusinessRuleException("Template name is required.");
        }

        if (request.Checklist.Count == 0)
        {
            throw new BusinessRuleException("At least one checklist question is required.");
        }

        foreach (var question in request.Checklist)
        {
            if (string.IsNullOrWhiteSpace(question.Question))
            {
                throw new BusinessRuleException("Checklist question text is required.");
            }

            if (!AllowedQuestionTypes.Contains(question.Type))
            {
                throw new BusinessRuleException("Checklist question type must be text, boolean, number, date, dropdown, yesno, or passfail.");
            }

            if (string.Equals(question.Type, "dropdown", StringComparison.OrdinalIgnoreCase)
                && (question.Options is null || question.Options.All(string.IsNullOrWhiteSpace)))
            {
                throw new BusinessRuleException("Dropdown checklist questions require at least one option.");
            }
        }
    }

    private static string NormalizeCategory(string category) =>
        AllowedCategories.Single(x => string.Equals(x, category.Trim(), StringComparison.OrdinalIgnoreCase));

    private static string NormalizeType(string type) =>
        AllowedQuestionTypes.Single(x => string.Equals(x, type.Trim(), StringComparison.OrdinalIgnoreCase));

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static PmTemplateQuestion MapQuestion(UpsertTemplateChecklistItemRequest question) =>
        new()
        {
            SectionName = Normalize(question.SectionName),
            Prompt = question.Question.Trim(),
            ResponseType = NormalizeType(question.Type),
            IsRequired = question.Required,
            SortOrder = question.Order,
            OptionsJson = question.Options is { Count: > 0 }
                ? System.Text.Json.JsonSerializer.Serialize(question.Options.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).ToList())
                : null
        };

    private static TemplateResponse Map(PmTemplate template) =>
        new(
            template.Id,
            template.Name,
            NormalizeCategory(template.Category),
            template.Description,
            template.Questions
                .OrderBy(x => x.SortOrder)
                .Select(x => new TemplateChecklistItemResponse(
                    x.Id,
                    x.SectionName,
                    x.Prompt,
                    NormalizeType(x.ResponseType is "checkbox" ? "yesno" : x.ResponseType),
                    x.IsRequired,
                    x.SortOrder,
                    ParseOptions(x.OptionsJson)))
                .ToList(),
            template.IsActive);

    private static IReadOnlyCollection<string> ParseOptions(string? optionsJson)
    {
        if (string.IsNullOrWhiteSpace(optionsJson))
        {
            return [];
        }

        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<List<string>>(optionsJson) ?? [];
        }
        catch
        {
            return [];
        }
    }
}

public sealed record UpsertTemplateRequest(
    string Name,
    string Category,
    string? Description,
    IReadOnlyCollection<UpsertTemplateChecklistItemRequest> Checklist,
    bool IsActive);

public sealed record UpsertTemplateChecklistItemRequest(
    string? SectionName,
    string Question,
    string Type,
    bool Required,
    int Order,
    IReadOnlyCollection<string>? Options);

public sealed record TemplateResponse(
    Guid Id,
    string Name,
    string Category,
    string? Description,
    IReadOnlyCollection<TemplateChecklistItemResponse> Checklist,
    bool IsActive);

public sealed record TemplateChecklistItemResponse(
    Guid Id,
    string? SectionName,
    string Question,
    string Type,
    bool Required,
    int Order,
    IReadOnlyCollection<string> Options);
