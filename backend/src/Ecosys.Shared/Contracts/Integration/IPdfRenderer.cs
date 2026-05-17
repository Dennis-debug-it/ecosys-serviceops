namespace Ecosys.Shared.Contracts.Integration;

public interface IPdfRenderer
{
    byte[] RenderWorkOrderReportPdf(string title, IReadOnlyCollection<string> sections);
    byte[] RenderWorkOrderReportPdf(WorkOrderReportPdfModel report);
}

public sealed record WorkOrderReportPdfModel(
    string CompanyName,
    string? LogoUrl,
    string PrimaryColor,
    string SecondaryColor,
    bool ShowPoweredByEcosys,
    string WorkOrderNumber,
    string Title,
    string? ClientName,
    string? SiteLabel,
    string? AssetName,
    string? AssetDetails,
    string? TechnicianTeam,
    string? ReportedProblem,
    string? Findings,
    string? WorkDone,
    string GeneratedAtLabel,
    IReadOnlyCollection<WorkOrderReportPdfTimestamp> Timestamps,
    IReadOnlyCollection<WorkOrderReportPdfMaterial> Materials,
    IReadOnlyCollection<WorkOrderReportPdfPhotoGroup> PhotoGroups,
    IReadOnlyCollection<WorkOrderReportPdfSignature> Signatures);

public sealed record WorkOrderReportPdfTimestamp(string Label, string? Value);
public sealed record WorkOrderReportPdfMaterial(string Name, decimal QuantityUsed, string UnitOfMeasure, decimal? UnitCost, bool Chargeable, string? Notes);
public sealed record WorkOrderReportPdfPhotoGroup(string Category, IReadOnlyCollection<WorkOrderReportPdfPhoto> Photos);
public sealed record WorkOrderReportPdfPhoto(string Caption, string? PublicUrl, byte[]? ImageBytes);
public sealed record WorkOrderReportPdfSignature(string SignatureType, string SignerName, string? SignerRole, string? Comment, string CapturedAtLabel, byte[]? ImageBytes);
