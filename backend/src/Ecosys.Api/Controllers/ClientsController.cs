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
[Route("api/clients")]
public sealed class ClientsController(
    AppDbContext dbContext,
    ITenantContext tenantContext,
    IAuditLogService auditLogService) : TenantAwareControllerBase(tenantContext)
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<ClientResponse>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        var normalizedStatus = NormalizeStatusFilter(status);
        var normalizedSearch = NormalizeSearch(search);

        var query = dbContext.Clients
            .Include(x => x.SlaDefinition)
            .Where(x => x.TenantId == TenantId);

        if (normalizedStatus == "active")
        {
            query = query.Where(x => x.IsActive);
        }
        else if (normalizedStatus == "inactive")
        {
            query = query.Where(x => !x.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(normalizedSearch))
        {
            var searchLower = normalizedSearch.ToLower();
            query = query.Where(x =>
                x.ClientName.ToLower().Contains(searchLower) ||
                (x.ContactPerson != null && x.ContactPerson.ToLower().Contains(searchLower)) ||
                (x.Email != null && x.Email.ToLower().Contains(searchLower)) ||
                (x.Phone != null && x.Phone.ToLower().Contains(searchLower)) ||
                (x.ContactPhone != null && x.ContactPhone.ToLower().Contains(searchLower)) ||
                (x.Location != null && x.Location.ToLower().Contains(searchLower)));
        }

        var clients = await query
            .OrderBy(x => x.ClientName)
            .ToListAsync(cancellationToken);

        return Ok(clients.Select(Map).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ClientResponse>> Get(Guid id, CancellationToken cancellationToken)
    {
        var client = await dbContext.Clients
            .Include(x => x.SlaDefinition)
            .SingleOrDefaultAsync(x => x.TenantId == TenantId && x.Id == id, cancellationToken)
            ?? throw new NotFoundException("Client was not found.");

        return Ok(Map(client));
    }

    [HttpPost]
    public async Task<ActionResult<ClientResponse>> Create([FromBody] UpsertClientRequest request, CancellationToken cancellationToken)
    {
        Validate(request);
        await EnsureUniqueNameAsync(request.ClientName, null, cancellationToken);

        var client = new Client
        {
            TenantId = TenantId,
            ClientName = request.ClientName.Trim(),
            ClientType = request.ClientType?.Trim(),
            Email = request.Email?.Trim(),
            Phone = request.Phone?.Trim(),
            Location = request.Location?.Trim(),
            ContactPerson = request.ContactPerson?.Trim(),
            ContactPhone = request.ContactPhone?.Trim(),
            SlaDefinitionId = request.SlaDefinitionId,
            Notes = request.Notes?.Trim(),
            IsActive = true
        };

        await EnsureSlaDefinitionExistsAsync(client.SlaDefinitionId, cancellationToken);

        dbContext.Clients.Add(client);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(
            TenantId,
            UserId,
            "Client created",
            nameof(Client),
            client.Id.ToString(),
            $"Created client '{client.ClientName}'.",
            cancellationToken);

        return CreatedAtAction(nameof(Get), new { id = client.Id }, Map(client));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ClientResponse>> Update(Guid id, [FromBody] UpsertClientRequest request, CancellationToken cancellationToken)
    {
        Validate(request);
        var client = await dbContext.Clients.SingleOrDefaultAsync(x => x.TenantId == TenantId && x.Id == id, cancellationToken)
            ?? throw new NotFoundException("Client was not found.");

        await EnsureUniqueNameAsync(request.ClientName, client.Id, cancellationToken);

        client.ClientName = request.ClientName.Trim();
        client.ClientType = request.ClientType?.Trim();
        client.Email = request.Email?.Trim();
        client.Phone = request.Phone?.Trim();
        client.Location = request.Location?.Trim();
        client.ContactPerson = request.ContactPerson?.Trim();
        client.ContactPhone = request.ContactPhone?.Trim();
        client.SlaDefinitionId = request.SlaDefinitionId;
        client.Notes = request.Notes?.Trim();

        await EnsureSlaDefinitionExistsAsync(client.SlaDefinitionId, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(
            TenantId,
            UserId,
            "Client updated",
            nameof(Client),
            client.Id.ToString(),
            $"Updated client '{client.ClientName}'.",
            cancellationToken);

        return Ok(Map(client));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var client = await dbContext.Clients.SingleOrDefaultAsync(x => x.TenantId == TenantId && x.Id == id, cancellationToken)
            ?? throw new NotFoundException("Client was not found.");

        await DeactivateClientAsync(client, cancellationToken);
        return NoContent();
    }

    [HttpPatch("{id:guid}/activate")]
    public async Task<ActionResult<ClientResponse>> Activate(Guid id, CancellationToken cancellationToken)
    {
        var client = await dbContext.Clients.SingleOrDefaultAsync(x => x.TenantId == TenantId && x.Id == id, cancellationToken)
            ?? throw new NotFoundException("Client was not found.");

        if (client.IsActive)
        {
            return Ok(Map(client));
        }

        client.IsActive = true;
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(
            TenantId,
            UserId,
            "ClientActivated",
            nameof(Client),
            client.Id.ToString(),
            $"Client '{client.ClientName}' was activated.",
            cancellationToken);

        return Ok(Map(client));
    }

    [HttpPatch("{id:guid}/deactivate")]
    public async Task<ActionResult<ClientResponse>> Deactivate(Guid id, CancellationToken cancellationToken)
    {
        var client = await dbContext.Clients.SingleOrDefaultAsync(x => x.TenantId == TenantId && x.Id == id, cancellationToken)
            ?? throw new NotFoundException("Client was not found.");

        if (!client.IsActive)
        {
            return Ok(Map(client));
        }

        await DeactivateClientAsync(client, cancellationToken);
        return Ok(Map(client));
    }

    private async Task DeactivateClientAsync(Client client, CancellationToken cancellationToken)
    {
        client.IsActive = false;

        var linkedAssets = await dbContext.Assets
            .Where(x => x.TenantId == TenantId && x.ClientId == client.Id && x.Status != "Inactive")
            .ToListAsync(cancellationToken);

        foreach (var asset in linkedAssets)
        {
            asset.Status = "Inactive";
            asset.AutoSchedulePm = false;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(
            TenantId,
            UserId,
            "ClientDeactivated",
            nameof(Client),
            client.Id.ToString(),
            $"Client '{client.ClientName}' was deactivated.",
            cancellationToken);

        await auditLogService.LogAsync(
            TenantId,
            UserId,
            "LinkedAssetsDeactivated",
            nameof(Client),
            client.Id.ToString(),
            $"Deactivated {linkedAssets.Count} linked asset(s) for client '{client.ClientName}'.",
            cancellationToken);
    }

    private static void Validate(UpsertClientRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ClientName))
        {
            throw new BusinessRuleException("Client name is required.");
        }
    }

    private async Task EnsureUniqueNameAsync(string clientName, Guid? currentId, CancellationToken cancellationToken)
    {
        var normalizedName = clientName.Trim().ToLowerInvariant();
        var exists = await dbContext.Clients.AnyAsync(
            x => x.TenantId == TenantId
                && x.IsActive
                && x.Id != currentId
                && x.ClientName.ToLower() == normalizedName,
            cancellationToken);

        if (exists)
        {
            throw new BusinessRuleException("Client name already exists for this tenant.");
        }
    }

    private async Task EnsureSlaDefinitionExistsAsync(Guid? slaDefinitionId, CancellationToken cancellationToken)
    {
        if (!slaDefinitionId.HasValue)
        {
            return;
        }

        var exists = await dbContext.SlaDefinitions.AnyAsync(
            x => x.TenantId == TenantId && x.IsActive && x.Id == slaDefinitionId.Value,
            cancellationToken);

        if (!exists)
        {
            throw new BusinessRuleException("SLA definition was not found for this tenant.");
        }
    }

    private static ClientResponse Map(Client client) =>
        new(
            client.Id,
            client.ClientName,
            client.ClientType,
            client.Email,
            client.Phone,
            client.Location,
            client.ContactPerson,
            client.ContactPhone,
            client.SlaDefinitionId,
            client.SlaDefinition?.PlanName,
            client.Notes,
            client.IsActive,
            client.CreatedAt);

    private static string NormalizeStatusFilter(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return "active";
        }

        return status.Trim().ToLowerInvariant() switch
        {
            "active" => "active",
            "inactive" => "inactive",
            "all" => "all",
            _ => throw new BusinessRuleException("Status must be active, inactive, or all.")
        };
    }

    private static string? NormalizeSearch(string? search) =>
        string.IsNullOrWhiteSpace(search) ? null : search.Trim();
}

public sealed record UpsertClientRequest(
    string ClientName,
    string? ClientType,
    string? Email,
    string? Phone,
    string? Location,
    string? ContactPerson,
    string? ContactPhone,
    Guid? SlaDefinitionId,
    string? Notes);

public sealed record ClientResponse(
    Guid Id,
    string ClientName,
    string? ClientType,
    string? Email,
    string? Phone,
    string? Location,
    string? ContactPerson,
    string? ContactPhone,
    Guid? SlaDefinitionId,
    string? SlaDefinitionName,
    string? Notes,
    bool IsActive,
    DateTime CreatedAt);
