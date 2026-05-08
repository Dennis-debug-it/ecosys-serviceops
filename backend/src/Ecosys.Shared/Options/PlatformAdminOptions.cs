namespace Ecosys.Shared.Options;

public sealed class PlatformAdminOptions
{
    public const string SectionName = "PlatformAdmin";

    public string Email { get; set; } = "superadmin@ecosys.local";
    public string Password { get; set; } = "SuperAdmin123!";
    public string FullName { get; set; } = "Platform SuperAdmin";
}
