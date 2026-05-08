namespace Ecosys.Shared.Contracts.Integration;

public interface IPdfRenderer
{
    byte[] RenderWorkOrderReportPdf(string title, IReadOnlyCollection<string> sections);
}
