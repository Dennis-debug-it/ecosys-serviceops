using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Ecosys.Infrastructure;
using Ecosys.Infrastructure.Data;
using Ecosys.Infrastructure.Security;
using Ecosys.Infrastructure.Services;
using Ecosys.Shared.Auth;
using Ecosys.Shared.Errors;
using Ecosys.Shared.Options;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);
const string EcosysCorsPolicyName = "EcosysCors";

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection(SmtpOptions.SectionName));
builder.Services.Configure<PlatformAdminOptions>(builder.Configuration.GetSection(PlatformAdminOptions.SectionName));
builder.Services.AddInfrastructure(builder.Configuration);

var allowedCorsOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>()
    ?.Where(origin => !string.IsNullOrWhiteSpace(origin))
    .Select(origin => origin.Trim())
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray() ?? [];

builder.Services.AddCors(options =>
{
    options.AddPolicy(EcosysCorsPolicyName, policy =>
    {
        if (allowedCorsOrigins.Length > 0)
        {
            policy.WithOrigins(allowedCorsOrigins)
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
            return;
        }

        policy.SetIsOriginAllowed(_ => false);
    });
});

var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = signingKey,
            ClockSkew = TimeSpan.FromMinutes(2)
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("PlatformAccess", policy => policy.RequireRole(AppRoles.PlatformRoles));
    options.AddPolicy("PlatformOwnerOnly", policy => policy.RequireRole(AppRoles.SuperAdmin, AppRoles.PlatformOwner));
    options.AddPolicy("PlatformAdminAccess", policy => policy.RequireRole(AppRoles.SuperAdmin, AppRoles.PlatformOwner, AppRoles.PlatformSuperAdmin, AppRoles.PlatformAdmin, AppRoles.PlatformAdminRole));
    options.AddPolicy("PlatformReadOnlyAccess", policy => policy.RequireRole(AppRoles.SuperAdmin, AppRoles.PlatformOwner, AppRoles.PlatformSuperAdmin, AppRoles.PlatformAdmin, AppRoles.PlatformAdminRole, AppRoles.Auditor, AppRoles.ReadOnlyAuditor, AppRoles.Support, AppRoles.SupportAdmin, AppRoles.Finance, AppRoles.FinanceAdmin));
    options.AddPolicy("PlatformFinanceAccess", policy => policy.RequireRole(AppRoles.SuperAdmin, AppRoles.PlatformOwner, AppRoles.PlatformSuperAdmin, AppRoles.PlatformAdmin, AppRoles.PlatformAdminRole, AppRoles.Finance, AppRoles.FinanceAdmin));
    options.AddPolicy("PlatformSettingsAccess", policy => policy.RequireRole(AppRoles.SuperAdmin, AppRoles.PlatformSuperAdmin, AppRoles.PlatformAdmin));
});
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var errors = GetValidationErrors(context.ModelState);
        return new BadRequestObjectResult(new
        {
            message = errors.FirstOrDefault() ?? "The request payload is invalid.",
            errorCode = "VALIDATION_ERROR",
            errors
        });
    };
});
builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Ecosys ServiceOps API",
        Version = "v1"
    });

    var bearerScheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Description = "Paste a JWT bearer token here.",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    };

    options.AddSecurityDefinition("Bearer", bearerScheme);
});

var app = builder.Build();

app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (Exception exception) when (!context.Response.HasStarted)
    {
        var logger = context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("GlobalExceptionHandler");

        if (exception is BusinessRuleException businessRuleException)
        {
            logger.LogWarning(businessRuleException, "Business rule violation while processing request.");
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await Results.Json(new
            {
                message = businessRuleException.Message,
                errorCode = "BUSINESS_RULE_VIOLATION"
            }).ExecuteAsync(context);
            return;
        }

        if (exception is JsonException or BadHttpRequestException)
        {
            logger.LogWarning(exception, "Invalid request payload.");
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await Results.Json(new
            {
                message = "The request payload is invalid.",
                errorCode = "VALIDATION_ERROR"
            }).ExecuteAsync(context);
            return;
        }

        if (exception is AppException appException)
        {
            logger.LogWarning(appException, "Request failed with handled application exception.");
            context.Response.StatusCode = appException.StatusCode;
            var extensions = new Dictionary<string, object?>
            {
                ["traceId"] = context.TraceIdentifier
            };

            if (appException is ILocalizedErrorCode codedException)
            {
                extensions["errorCode"] = codedException.ErrorCode;
            }

            await Results.Problem(
                statusCode: appException.StatusCode,
                title: appException.Message,
                extensions: extensions).ExecuteAsync(context);
            return;
        }

        if (exception is DbUpdateException dbUpdateException)
        {
            logger.LogError(dbUpdateException, "Database update failed while processing request.");
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await Results.Problem(
                statusCode: StatusCodes.Status500InternalServerError,
                title: "A database error occurred while saving changes.",
                extensions: new Dictionary<string, object?>
                {
                    ["traceId"] = context.TraceIdentifier
                }).ExecuteAsync(context);
            return;
        }

        if (exception is not null)
        {
            logger.LogError(exception, "Unhandled exception while processing request.");
        }

        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await Results.Problem(
            statusCode: StatusCodes.Status500InternalServerError,
            title: "An unexpected error occurred.",
            extensions: new Dictionary<string, object?>
            {
                ["traceId"] = context.TraceIdentifier
            }).ExecuteAsync(context);
    }
});

app.UseSwagger();
app.UseSwaggerUI(options => options.RoutePrefix = "swagger");

using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");

    try
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await dbContext.Database.MigrateAsync();
        var platformBootstrapService = scope.ServiceProvider.GetRequiredService<IPlatformBootstrapService>();
        await platformBootstrapService.EnsurePlatformAdminAsync();
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Database initialization was skipped because the database was unavailable.");
    }
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseCors(EcosysCorsPolicyName);
app.UseAuthentication();
app.UseMiddleware<UserSessionHeartbeatMiddleware>();
app.UseMiddleware<TenantLicenseEnforcementMiddleware>();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");

app.Run();

static string[] GetValidationErrors(ModelStateDictionary modelState)
{
    return modelState.Values
        .SelectMany(entry => entry.Errors)
        .Select(error => string.IsNullOrWhiteSpace(error.ErrorMessage) ? "The request payload is invalid." : error.ErrorMessage)
        .Distinct(StringComparer.Ordinal)
        .ToArray();
}
