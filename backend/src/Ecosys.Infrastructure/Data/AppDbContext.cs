using Ecosys.Domain.Common;
using Ecosys.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Ecosys.Infrastructure.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<User> Users => Set<User>();
    public DbSet<UserBranchAssignment> UserBranchAssignments => Set<UserBranchAssignment>();
    public DbSet<UserSession> UserSessions => Set<UserSession>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<Asset> Assets => Set<Asset>();
    public DbSet<Technician> Technicians => Set<Technician>();
    public DbSet<WorkOrder> WorkOrders => Set<WorkOrder>();
    public DbSet<MaterialItem> MaterialItems => Set<MaterialItem>();
    public DbSet<BranchMaterialStock> BranchMaterialStocks => Set<BranchMaterialStock>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<StockTransfer> StockTransfers => Set<StockTransfer>();
    public DbSet<MaterialRequest> MaterialRequests => Set<MaterialRequest>();
    public DbSet<MaterialRequestLine> MaterialRequestLines => Set<MaterialRequestLine>();
    public DbSet<UserPermission> UserPermissions => Set<UserPermission>();
    public DbSet<PreventiveMaintenancePlan> PreventiveMaintenancePlans => Set<PreventiveMaintenancePlan>();
    public DbSet<ImportBatch> ImportBatches => Set<ImportBatch>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<EmailSetting> EmailSettings => Set<EmailSetting>();
    public DbSet<EmailDeliveryLog> EmailDeliveryLogs => Set<EmailDeliveryLog>();
    public DbSet<EmailOutboxMessage> EmailOutboxMessages => Set<EmailOutboxMessage>();
    public DbSet<TenantNotificationSetting> TenantNotificationSettings => Set<TenantNotificationSetting>();
    public DbSet<TenantNotificationRecipient> TenantNotificationRecipients => Set<TenantNotificationRecipient>();
    public DbSet<EmailIntakeSetting> EmailIntakeSettings => Set<EmailIntakeSetting>();
    public DbSet<NumberingSetting> NumberingSettings => Set<NumberingSetting>();
    public DbSet<LicensePlan> LicensePlans => Set<LicensePlan>();
    public DbSet<TenantLicense> TenantLicenses => Set<TenantLicense>();
    public DbSet<AssignmentGroup> AssignmentGroups => Set<AssignmentGroup>();
    public DbSet<AssignmentGroupMember> AssignmentGroupMembers => Set<AssignmentGroupMember>();
    public DbSet<WorkOrderAssignment> WorkOrderAssignments => Set<WorkOrderAssignment>();
    public DbSet<WorkOrderTechnicianAssignment> WorkOrderTechnicianAssignments => Set<WorkOrderTechnicianAssignment>();
    public DbSet<WorkOrderAssignmentHistory> WorkOrderAssignmentHistories => Set<WorkOrderAssignmentHistory>();
    public DbSet<WorkOrderEvent> WorkOrderEvents => Set<WorkOrderEvent>();
    public DbSet<WorkOrderChecklistItem> WorkOrderChecklistItems => Set<WorkOrderChecklistItem>();
    public DbSet<PmTemplate> PmTemplates => Set<PmTemplate>();
    public DbSet<PmTemplateQuestion> PmTemplateQuestions => Set<PmTemplateQuestion>();
    public DbSet<PmReport> PmReports => Set<PmReport>();
    public DbSet<TenantSecurityPolicy> TenantSecurityPolicies => Set<TenantSecurityPolicy>();
    public DbSet<IntakeProtocol> IntakeProtocols => Set<IntakeProtocol>();
    public DbSet<MonitoringSetting> MonitoringSettings => Set<MonitoringSetting>();
    public DbSet<MonitoringWebhookIntegration> MonitoringWebhookIntegrations => Set<MonitoringWebhookIntegration>();
    public DbSet<NotificationSetting> NotificationSettings => Set<NotificationSetting>();
    public DbSet<PlatformQuotation> PlatformQuotations => Set<PlatformQuotation>();
    public DbSet<PlatformQuotationLine> PlatformQuotationLines => Set<PlatformQuotationLine>();
    public DbSet<PlatformInvoice> PlatformInvoices => Set<PlatformInvoice>();
    public DbSet<PlatformInvoiceLine> PlatformInvoiceLines => Set<PlatformInvoiceLine>();
    public DbSet<PlatformPayment> PlatformPayments => Set<PlatformPayment>();
    public DbSet<PlatformExpense> PlatformExpenses => Set<PlatformExpense>();
    public DbSet<PlatformDocumentTemplate> PlatformDocumentTemplates => Set<PlatformDocumentTemplate>();
    public DbSet<PlatformSetting> PlatformSettings => Set<PlatformSetting>();
    public DbSet<PlatformLead> PlatformLeads => Set<PlatformLead>();

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyAuditFields();
        NormalizeUtcFields();
        return base.SaveChangesAsync(cancellationToken);
    }

    public override int SaveChanges()
    {
        ApplyAuditFields();
        NormalizeUtcFields();
        return base.SaveChanges();
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Tenant>(entity =>
        {
            entity.ToTable("tenants");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Slug).HasMaxLength(160).IsRequired();
            entity.Property(x => x.CompanyName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(256).IsRequired();
            entity.Property(x => x.Phone).HasMaxLength(50);
            entity.Property(x => x.Country).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Industry).HasMaxLength(100);
            entity.Property(x => x.ContactName).HasMaxLength(200);
            entity.Property(x => x.ContactEmail).HasMaxLength(256);
            entity.Property(x => x.ContactPhone).HasMaxLength(50);
            entity.Property(x => x.County).HasMaxLength(100);
            entity.Property(x => x.City).HasMaxLength(100);
            entity.Property(x => x.Address).HasMaxLength(500);
            entity.Property(x => x.TaxPin).HasMaxLength(100);
            entity.Property(x => x.Status).HasMaxLength(50).IsRequired();
            entity.Property(x => x.PlanName).HasMaxLength(100);
            entity.Property(x => x.LicenseStatus).HasMaxLength(50);
            entity.Property(x => x.LogoUrl).HasMaxLength(500);
            entity.Property(x => x.PrimaryColor).HasMaxLength(20).IsRequired();
            entity.Property(x => x.SecondaryColor).HasMaxLength(20).IsRequired();
            entity.Property(x => x.SuspendedAt);
            entity.Property(x => x.DeactivatedAt);
            entity.Property(x => x.DeactivationReason).HasMaxLength(1000);
            entity.Property(x => x.SubscriptionStartsAt);
            entity.HasIndex(x => x.Slug).IsUnique();
        });

        modelBuilder.Entity<Branch>(entity =>
        {
            entity.ToTable("branches");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Code).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Location).HasMaxLength(250);
            entity.Property(x => x.Address).HasMaxLength(500);
            entity.Property(x => x.ContactPerson).HasMaxLength(200);
            entity.Property(x => x.Phone).HasMaxLength(50);
            entity.Property(x => x.Email).HasMaxLength(256);
            entity.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.ParentBranchId, x.Name }).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.Branches)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.ParentBranch)
                .WithMany(x => x.ChildBranches)
                .HasForeignKey(x => x.ParentBranchId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.FullName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(256).IsRequired();
            entity.Property(x => x.PasswordHash).HasMaxLength(2000).IsRequired();
            entity.Property(x => x.Role).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Phone).HasMaxLength(50);
            entity.Property(x => x.JobTitle).HasMaxLength(150);
            entity.Property(x => x.Department).HasMaxLength(150);
            entity.Property(x => x.InviteTokenHash).HasMaxLength(512);
            entity.HasIndex(x => x.Email).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.Users)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Permission)
                .WithOne(x => x.User)
                .HasForeignKey<UserPermission>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.DefaultBranch)
                .WithMany(x => x.DefaultUsers)
                .HasForeignKey(x => x.DefaultBranchId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.TechnicianProfile)
                .WithOne(x => x.User)
                .HasForeignKey<Technician>(x => x.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<UserBranchAssignment>(entity =>
        {
            entity.ToTable("user_branch_assignments");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.UserId, x.BranchId }).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.UserBranchAssignments)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.User)
                .WithMany(x => x.BranchAssignments)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Branch)
                .WithMany(x => x.UserAssignments)
                .HasForeignKey(x => x.BranchId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserSession>(entity =>
        {
            entity.ToTable("user_sessions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.JwtId).HasMaxLength(200);
            entity.Property(x => x.IpAddress).HasMaxLength(100);
            entity.Property(x => x.UserAgent).HasMaxLength(1000);
            entity.HasIndex(x => new { x.TenantId, x.UserId, x.LoginAt });
            entity.HasIndex(x => x.JwtId);
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.UserSessions)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.User)
                .WithMany(x => x.Sessions)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PasswordResetToken>(entity =>
        {
            entity.ToTable("password_reset_tokens");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.TokenHash).HasMaxLength(128).IsRequired();
            entity.Property(x => x.RequestedIp).HasMaxLength(100);
            entity.Property(x => x.UserAgent).HasMaxLength(1000);
            entity.HasIndex(x => x.TokenHash).IsUnique();
            entity.HasIndex(x => new { x.UserId, x.ExpiresAt });
            entity.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Client>(entity =>
        {
            entity.ToTable("clients");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ClientName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.ClientType).HasMaxLength(100);
            entity.Property(x => x.Email).HasMaxLength(256);
            entity.Property(x => x.Phone).HasMaxLength(50);
            entity.Property(x => x.Location).HasMaxLength(250);
            entity.Property(x => x.ContactPerson).HasMaxLength(200);
            entity.Property(x => x.ContactPhone).HasMaxLength(50);
            entity.Property(x => x.SlaPlan).HasMaxLength(100);
            entity.Property(x => x.Notes).HasMaxLength(4000);
            entity.HasIndex(x => new { x.TenantId, x.ClientName }).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.Clients)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Asset>(entity =>
        {
            entity.ToTable("assets");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.AssetName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.AssetCode).HasMaxLength(100).IsRequired();
            entity.Property(x => x.AssetType).HasMaxLength(100);
            entity.Property(x => x.Location).HasMaxLength(250);
            entity.Property(x => x.SerialNumber).HasMaxLength(150);
            entity.Property(x => x.Manufacturer).HasMaxLength(150);
            entity.Property(x => x.Model).HasMaxLength(150);
            entity.Property(x => x.RecommendedPmFrequency).HasMaxLength(100);
            entity.Property(x => x.Notes).HasMaxLength(4000);
            entity.Property(x => x.Status).HasMaxLength(50).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.AssetCode }).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.Assets)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Branch)
                .WithMany(x => x.Assets)
                .HasForeignKey(x => x.BranchId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Client)
                .WithMany(x => x.Assets)
                .HasForeignKey(x => x.ClientId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Technician>(entity =>
        {
            entity.ToTable("technicians");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.FullName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(256).IsRequired();
            entity.Property(x => x.Phone).HasMaxLength(50);
            entity.Property(x => x.SkillCategory).HasMaxLength(100);
            entity.Property(x => x.AssignmentGroup).HasMaxLength(100);
            entity.Property(x => x.LastKnownLatitude).HasPrecision(9, 6);
            entity.Property(x => x.LastKnownLongitude).HasPrecision(9, 6);
            entity.HasIndex(x => new { x.TenantId, x.Email }).IsUnique();
            entity.HasIndex(x => x.UserId).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.Technicians)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.User)
                .WithOne(x => x.TechnicianProfile)
                .HasForeignKey<Technician>(x => x.UserId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Branch)
                .WithMany(x => x.Technicians)
                .HasForeignKey(x => x.BranchId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.ActiveWorkOrder)
                .WithMany()
                .HasForeignKey(x => x.ActiveWorkOrderId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<WorkOrder>(entity =>
        {
            entity.ToTable("work_orders");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.AssignmentType).HasMaxLength(40).IsRequired();
            entity.Property(x => x.AssignedTechnicianIdsJson).HasMaxLength(4000);
            entity.Property(x => x.WorkOrderNumber).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Title).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(4000);
            entity.Property(x => x.Priority).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(50).IsRequired();
            entity.Property(x => x.WorkDoneNotes).HasMaxLength(4000);
            entity.Property(x => x.AcknowledgedByName).HasMaxLength(200);
            entity.Property(x => x.AcknowledgementComments).HasMaxLength(4000);
            entity.HasIndex(x => new { x.TenantId, x.WorkOrderNumber }).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.WorkOrders)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Branch)
                .WithMany(x => x.WorkOrders)
                .HasForeignKey(x => x.BranchId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Client)
                .WithMany(x => x.WorkOrders)
                .HasForeignKey(x => x.ClientId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Asset)
                .WithMany(x => x.WorkOrders)
                .HasForeignKey(x => x.AssetId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.AssignedTechnician)
                .WithMany(x => x.WorkOrders)
                .HasForeignKey(x => x.AssignedTechnicianId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.LeadTechnician)
                .WithMany()
                .HasForeignKey(x => x.LeadTechnicianId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.AssignmentGroup)
                .WithMany(x => x.WorkOrders)
                .HasForeignKey(x => x.AssignmentGroupId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.PreventiveMaintenancePlan)
                .WithMany(x => x.WorkOrders)
                .HasForeignKey(x => x.PreventiveMaintenancePlanId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.PmTemplate)
                .WithMany(x => x.WorkOrders)
                .HasForeignKey(x => x.PmTemplateId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasMany(x => x.Assignments)
                .WithOne(x => x.WorkOrder)
                .HasForeignKey(x => x.WorkOrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(x => x.TechnicianAssignments)
                .WithOne(x => x.WorkOrder)
                .HasForeignKey(x => x.WorkOrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(x => x.AssignmentHistory)
                .WithOne(x => x.WorkOrder)
                .HasForeignKey(x => x.WorkOrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(x => x.ChecklistItems)
                .WithOne(x => x.WorkOrder)
                .HasForeignKey(x => x.WorkOrderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<MaterialItem>(entity =>
        {
            entity.ToTable("material_items");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ItemCode).HasMaxLength(100).IsRequired();
            entity.Property(x => x.ItemName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Category).HasMaxLength(100);
            entity.Property(x => x.UnitOfMeasure).HasMaxLength(50).IsRequired();
            entity.Property(x => x.QuantityOnHand).HasPrecision(18, 2);
            entity.Property(x => x.ReorderLevel).HasPrecision(18, 2);
            entity.Property(x => x.UnitCost).HasPrecision(18, 2);
            entity.HasIndex(x => new { x.TenantId, x.ItemCode }).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.MaterialItems)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BranchMaterialStock>(entity =>
        {
            entity.ToTable("branch_material_stocks");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.QuantityOnHand).HasPrecision(18, 2);
            entity.Property(x => x.ReorderLevel).HasPrecision(18, 2);
            entity.Property(x => x.UnitCost).HasPrecision(18, 2);
            entity.HasIndex(x => new { x.TenantId, x.BranchId, x.MaterialId }).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.BranchMaterialStocks)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Branch)
                .WithMany(x => x.MaterialStocks)
                .HasForeignKey(x => x.BranchId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Material)
                .WithMany(x => x.BranchStocks)
                .HasForeignKey(x => x.MaterialId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<StockMovement>(entity =>
        {
            entity.ToTable("stock_movements");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.MovementType).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Quantity).HasPrecision(18, 2);
            entity.Property(x => x.BalanceAfter).HasPrecision(18, 2);
            entity.Property(x => x.Reason).HasMaxLength(500);
            entity.Property(x => x.ReferenceNumber).HasMaxLength(100);
            entity.HasIndex(x => new { x.TenantId, x.MaterialId, x.CreatedAt });
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.StockMovements)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Branch)
                .WithMany(x => x.StockMovements)
                .HasForeignKey(x => x.BranchId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Material)
                .WithMany(x => x.StockMovements)
                .HasForeignKey(x => x.MaterialId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.WorkOrder)
                .WithMany()
                .HasForeignKey(x => x.WorkOrderId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.MaterialRequest)
                .WithMany()
                .HasForeignKey(x => x.MaterialRequestId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.CreatedByUser)
                .WithMany()
                .HasForeignKey(x => x.CreatedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<StockTransfer>(entity =>
        {
            entity.ToTable("stock_transfers");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Quantity).HasPrecision(18, 2);
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Reason).HasMaxLength(500);
            entity.Property(x => x.ReferenceNumber).HasMaxLength(100);
            entity.HasIndex(x => new { x.TenantId, x.ReferenceNumber }).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.StockTransfers)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.FromBranch)
                .WithMany(x => x.OutgoingTransfers)
                .HasForeignKey(x => x.FromBranchId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.ToBranch)
                .WithMany(x => x.IncomingTransfers)
                .HasForeignKey(x => x.ToBranchId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Material)
                .WithMany(x => x.StockTransfers)
                .HasForeignKey(x => x.MaterialId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.RequestedByUser)
                .WithMany()
                .HasForeignKey(x => x.RequestedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.ApprovedByUser)
                .WithMany()
                .HasForeignKey(x => x.ApprovedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.CompletedByUser)
                .WithMany()
                .HasForeignKey(x => x.CompletedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<MaterialRequest>(entity =>
        {
            entity.ToTable("material_requests");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.RequestNumber).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(50).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.RequestNumber }).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.MaterialRequests)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Branch)
                .WithMany(x => x.MaterialRequests)
                .HasForeignKey(x => x.BranchId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.WorkOrder)
                .WithMany(x => x.MaterialRequests)
                .HasForeignKey(x => x.WorkOrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.RequestedByUser)
                .WithMany()
                .HasForeignKey(x => x.RequestedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<MaterialRequestLine>(entity =>
        {
            entity.ToTable("material_request_lines");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.QuantityRequested).HasPrecision(18, 2);
            entity.Property(x => x.QuantityIssued).HasPrecision(18, 2);
            entity.Property(x => x.QuantityUsed).HasPrecision(18, 2);
            entity.Property(x => x.QuantityReturned).HasPrecision(18, 2);
            entity.HasOne(x => x.MaterialRequest)
                .WithMany(x => x.Lines)
                .HasForeignKey(x => x.MaterialRequestId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.MaterialItem)
                .WithMany(x => x.MaterialRequestLines)
                .HasForeignKey(x => x.MaterialItemId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<UserPermission>(entity =>
        {
            entity.ToTable("user_permissions");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.UserId).IsUnique();
        });

        modelBuilder.Entity<PreventiveMaintenancePlan>(entity =>
        {
            entity.ToTable("preventive_maintenance_plans");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Frequency).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(50).IsRequired();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.PreventiveMaintenancePlans)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Branch)
                .WithMany(x => x.PreventiveMaintenancePlans)
                .HasForeignKey(x => x.BranchId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Asset)
                .WithMany(x => x.PreventiveMaintenancePlans)
                .HasForeignKey(x => x.AssetId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.PmTemplate)
                .WithMany(x => x.Plans)
                .HasForeignKey(x => x.PmTemplateId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ImportBatch>(entity =>
        {
            entity.ToTable("import_batches");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ImportType).HasMaxLength(50).IsRequired();
            entity.Property(x => x.FileName).HasMaxLength(260).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(50).IsRequired();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.ImportBatches)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("audit_logs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ActorName).HasMaxLength(200);
            entity.Property(x => x.Action).HasMaxLength(100).IsRequired();
            entity.Property(x => x.EntityName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.EntityId).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Details).HasMaxLength(4000);
            entity.Property(x => x.IpAddress).HasMaxLength(100);
            entity.Property(x => x.UserAgent).HasMaxLength(1000);
            entity.Property(x => x.Severity).HasMaxLength(50).IsRequired();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.AuditLogs)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<EmailSetting>(entity =>
        {
            entity.ToTable("email_settings");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.UsePlatformDefaults).HasDefaultValue(true);
            entity.Property(x => x.Provider).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Host).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Username).HasMaxLength(200);
            entity.Property(x => x.ReplyToEmail).HasMaxLength(256);
            entity.Property(x => x.Password).HasMaxLength(500);
            entity.Property(x => x.EncryptedSecret).HasMaxLength(4000);
            entity.Property(x => x.SenderName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.SenderAddress).HasMaxLength(256).IsRequired();
            entity.Property(x => x.LastError).HasMaxLength(2000);
            entity.HasIndex(x => x.TenantId).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.EmailSettings)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TenantNotificationSetting>(entity =>
        {
            entity.ToTable("tenant_notification_settings");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.NotificationKey).HasMaxLength(120).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.NotificationKey }).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.TenantNotificationSettings)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TenantNotificationRecipient>(entity =>
        {
            entity.ToTable("tenant_notification_recipients");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.RecipientGroup).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(256).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.RecipientGroup, x.Email }).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.TenantNotificationRecipients)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<EmailIntakeSetting>(entity =>
        {
            entity.ToTable("email_intake_settings");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.IntakeEmailAddress).HasMaxLength(256);
            entity.Property(x => x.MailboxProvider).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Host).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Username).HasMaxLength(200);
            entity.Property(x => x.EncryptedPassword).HasMaxLength(4000);
            entity.Property(x => x.DefaultPriority).HasMaxLength(50).IsRequired();
            entity.Property(x => x.SubjectParsingRules).HasMaxLength(4000);
            entity.Property(x => x.AllowedSenderDomains).HasMaxLength(2000);
            entity.Property(x => x.LastError).HasMaxLength(2000);
            entity.HasIndex(x => x.TenantId).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.EmailIntakeSettings)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.DefaultClient)
                .WithMany()
                .HasForeignKey(x => x.DefaultClientId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.DefaultBranch)
                .WithMany()
                .HasForeignKey(x => x.DefaultBranchId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.DefaultAssignmentGroup)
                .WithMany()
                .HasForeignKey(x => x.DefaultAssignmentGroupId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<NumberingSetting>(entity =>
        {
            entity.ToTable("numbering_settings");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.DocumentType).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Prefix).HasMaxLength(20).IsRequired();
            entity.Property(x => x.ResetFrequency).HasMaxLength(20).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.DocumentType })
                .HasFilter("\"BranchId\" IS NULL")
                .IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.BranchId, x.DocumentType })
                .HasFilter("\"BranchId\" IS NOT NULL")
                .IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany()
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Branch)
                .WithMany(x => x.NumberingSettings)
                .HasForeignKey(x => x.BranchId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LicensePlan>(entity =>
        {
            entity.ToTable("license_plans");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.PlanCode).HasMaxLength(50).IsRequired();
            entity.Property(x => x.DisplayName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.MonthlyPrice).HasPrecision(18, 2);
            entity.Property(x => x.AnnualPrice).HasPrecision(18, 2);
            entity.Property(x => x.ModulesIncluded).HasMaxLength(1000);
            entity.HasIndex(x => x.PlanCode).IsUnique();
            entity.HasData(
                new LicensePlan
                {
                    Id = Guid.Parse("d220965a-38b4-45d0-9870-a8e45627e21a"),
                    PlanCode = "Trial",
                    DisplayName = "Trial",
                    MonthlyPrice = 0,
                    AnnualPrice = 0,
                    MaxUsers = 5,
                    MaxBranches = 1,
                    MaxAssets = 25,
                    MonthlyWorkOrders = 50,
                    ModulesIncluded = "Core",
                    EmailIngestion = false,
                    MonitoringIntegration = false,
                    AdvancedReports = false,
                    ClientPortal = false,
                    IsActive = true,
                    CreatedAt = new DateTime(2026, 4, 30, 0, 0, 0, DateTimeKind.Utc)
                },
                new LicensePlan
                {
                    Id = Guid.Parse("7e2bc113-bc77-4206-8c53-4696402f69c0"),
                    PlanCode = "Starter",
                    DisplayName = "Starter",
                    MonthlyPrice = 14900,
                    AnnualPrice = 149000,
                    MaxUsers = 15,
                    MaxBranches = 3,
                    MaxAssets = 250,
                    MonthlyWorkOrders = 500,
                    ModulesIncluded = "Core,EmailIngestion",
                    EmailIngestion = true,
                    MonitoringIntegration = false,
                    AdvancedReports = false,
                    ClientPortal = false,
                    IsActive = true,
                    CreatedAt = new DateTime(2026, 4, 30, 0, 0, 0, DateTimeKind.Utc)
                },
                new LicensePlan
                {
                    Id = Guid.Parse("4df8af7d-8514-45e7-ad42-f5d7b745fe71"),
                    PlanCode = "Professional",
                    DisplayName = "Professional",
                    MonthlyPrice = 39900,
                    AnnualPrice = 399000,
                    MaxUsers = 50,
                    MaxBranches = 10,
                    MaxAssets = 2500,
                    MonthlyWorkOrders = 5000,
                    ModulesIncluded = "Core,EmailIngestion,MonitoringIntegration,AdvancedReports",
                    EmailIngestion = true,
                    MonitoringIntegration = true,
                    AdvancedReports = true,
                    ClientPortal = false,
                    IsActive = true,
                    CreatedAt = new DateTime(2026, 4, 30, 0, 0, 0, DateTimeKind.Utc)
                },
                new LicensePlan
                {
                    Id = Guid.Parse("33fe16d8-5b55-45aa-89e2-1af0f2e7367d"),
                    PlanCode = "Enterprise",
                    DisplayName = "Enterprise",
                    MonthlyPrice = 99900,
                    AnnualPrice = 999000,
                    MaxUsers = null,
                    MaxBranches = null,
                    MaxAssets = null,
                    MonthlyWorkOrders = null,
                    ModulesIncluded = "Core,EmailIngestion,MonitoringIntegration,AdvancedReports,ClientPortal",
                    EmailIngestion = true,
                    MonitoringIntegration = true,
                    AdvancedReports = true,
                    ClientPortal = true,
                    IsActive = true,
                    CreatedAt = new DateTime(2026, 4, 30, 0, 0, 0, DateTimeKind.Utc)
                });
        });

        modelBuilder.Entity<TenantLicense>(entity =>
        {
            entity.ToTable("tenant_licenses");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Status).HasMaxLength(50).IsRequired();
            entity.Property(x => x.BillingCycle).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.HasIndex(x => x.TenantId).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.TenantLicenses)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.LicensePlan)
                .WithMany(x => x.TenantLicenses)
                .HasForeignKey(x => x.LicensePlanId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AssignmentGroup>(entity =>
        {
            entity.ToTable("assignment_groups");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.Property(x => x.SkillArea).HasMaxLength(150);
            entity.HasIndex(x => new { x.TenantId, x.BranchId, x.Name }).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.AssignmentGroups)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Branch)
                .WithMany(x => x.AssignmentGroups)
                .HasForeignKey(x => x.BranchId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<AssignmentGroupMember>(entity =>
        {
            entity.ToTable("assignment_group_members");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.AddedAt).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.AssignmentGroupId, x.TechnicianId }).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany()
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.AssignmentGroup)
                .WithMany(x => x.Members)
                .HasForeignKey(x => x.AssignmentGroupId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Technician)
                .WithMany(x => x.AssignmentGroups)
                .HasForeignKey(x => x.TechnicianId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WorkOrderAssignment>(entity =>
        {
            entity.ToTable("work_order_assignments");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.AssignmentStatus).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Notes).HasMaxLength(4000);
            entity.HasIndex(x => x.WorkOrderId).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.AssignmentGroupId, x.AssignmentStatus });
            entity.HasOne(x => x.Tenant)
                .WithMany()
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.AssignmentGroup)
                .WithMany(x => x.WorkOrderAssignments)
                .HasForeignKey(x => x.AssignmentGroupId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.AssignedByUser)
                .WithMany()
                .HasForeignKey(x => x.AssignedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<WorkOrderTechnicianAssignment>(entity =>
        {
            entity.ToTable("work_order_technician_assignments");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Status).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Notes).HasMaxLength(4000);
            entity.HasIndex(x => new { x.WorkOrderId, x.TechnicianId }).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.TechnicianId, x.Status });
            entity.HasOne(x => x.Tenant)
                .WithMany()
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Technician)
                .WithMany(x => x.WorkOrderAssignments)
                .HasForeignKey(x => x.TechnicianId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.AssignedByUser)
                .WithMany()
                .HasForeignKey(x => x.AssignedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<WorkOrderAssignmentHistory>(entity =>
        {
            entity.ToTable("work_order_assignment_history");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Action).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Notes).HasMaxLength(4000);
            entity.HasIndex(x => new { x.TenantId, x.WorkOrderId, x.PerformedAt });
            entity.HasOne(x => x.Tenant)
                .WithMany()
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.FromGroup)
                .WithMany(x => x.AssignmentHistoryFromGroups)
                .HasForeignKey(x => x.FromGroupId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.ToGroup)
                .WithMany(x => x.AssignmentHistoryToGroups)
                .HasForeignKey(x => x.ToGroupId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.FromTechnician)
                .WithMany(x => x.AssignmentHistoryFromTechnicians)
                .HasForeignKey(x => x.FromTechnicianId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.ToTechnician)
                .WithMany(x => x.AssignmentHistoryToTechnicians)
                .HasForeignKey(x => x.ToTechnicianId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.PerformedByUser)
                .WithMany()
                .HasForeignKey(x => x.PerformedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<WorkOrderEvent>(entity =>
        {
            entity.ToTable("work_order_events");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.EventType).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(50);
            entity.Property(x => x.Message).HasMaxLength(2000).IsRequired();
            entity.Property(x => x.Latitude).HasPrecision(9, 6);
            entity.Property(x => x.Longitude).HasPrecision(9, 6);
            entity.HasIndex(x => new { x.TenantId, x.WorkOrderId, x.OccurredAt });
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.WorkOrderEvents)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.WorkOrder)
                .WithMany(x => x.Events)
                .HasForeignKey(x => x.WorkOrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.ActorUser)
                .WithMany()
                .HasForeignKey(x => x.ActorUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<PmTemplate>(entity =>
        {
            entity.ToTable("pm_templates");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Category).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.HasIndex(x => new { x.TenantId, x.Category, x.Name }).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.PmTemplates)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PmTemplateQuestion>(entity =>
        {
            entity.ToTable("pm_template_questions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.SectionName).HasMaxLength(150);
            entity.Property(x => x.Prompt).HasMaxLength(500).IsRequired();
            entity.Property(x => x.ResponseType).HasMaxLength(50).IsRequired();
            entity.Property(x => x.OptionsJson).HasMaxLength(4000);
            entity.HasOne(x => x.PmTemplate)
                .WithMany(x => x.Questions)
                .HasForeignKey(x => x.PmTemplateId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WorkOrderChecklistItem>(entity =>
        {
            entity.ToTable("work_order_checklist_items");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.SectionName).HasMaxLength(150);
            entity.Property(x => x.QuestionText).HasMaxLength(500).IsRequired();
            entity.Property(x => x.InputType).HasMaxLength(50).IsRequired();
            entity.Property(x => x.ResponseValue).HasMaxLength(4000);
            entity.Property(x => x.Remarks).HasMaxLength(4000);
            entity.Property(x => x.OptionsJson).HasMaxLength(4000);
            entity.HasIndex(x => new { x.TenantId, x.WorkOrderId, x.SortOrder });
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.WorkOrderChecklistItems)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.WorkOrder)
                .WithMany(x => x.ChecklistItems)
                .HasForeignKey(x => x.WorkOrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.PmTemplateQuestion)
                .WithMany()
                .HasForeignKey(x => x.PmTemplateQuestionId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.CompletedByUser)
                .WithMany()
                .HasForeignKey(x => x.CompletedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<PmReport>(entity =>
        {
            entity.ToTable("pm_reports");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Summary).HasMaxLength(4000).IsRequired();
            entity.Property(x => x.AnswersJson).HasMaxLength(16000).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.WorkOrderId, x.GeneratedAt });
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.PmReports)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.WorkOrder)
                .WithMany(x => x.PmReports)
                .HasForeignKey(x => x.WorkOrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.PmTemplate)
                .WithMany(x => x.Reports)
                .HasForeignKey(x => x.PmTemplateId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<TenantSecurityPolicy>(entity =>
        {
            entity.ToTable("tenant_security_policies");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.TenantId).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.TenantSecurityPolicies)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<IntakeProtocol>(entity =>
        {
            entity.ToTable("intake_protocols");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(180).IsRequired();
            entity.Property(x => x.SourceType).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.Property(x => x.CriteriaJson).HasMaxLength(32000).IsRequired();
            entity.Property(x => x.ActionsJson).HasMaxLength(32000).IsRequired();
            entity.Property(x => x.SourceConfigJson).HasMaxLength(32000).IsRequired();
            entity.Property(x => x.LastTriggerStatus).HasMaxLength(120);
            entity.Property(x => x.LastError).HasMaxLength(4000);
            entity.HasIndex(x => new { x.TenantId, x.Name }).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.IntakeProtocols)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<MonitoringSetting>(entity =>
        {
            entity.ToTable("monitoring_settings");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ProviderName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.EndpointLabel).HasMaxLength(200);
            entity.Property(x => x.WebhookSecret).HasMaxLength(500);
            entity.Property(x => x.DefaultPriority).HasMaxLength(50).IsRequired();
            entity.HasIndex(x => x.TenantId).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.MonitoringSettings)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.DefaultBranch)
                .WithMany(x => x.MonitoringSettings)
                .HasForeignKey(x => x.DefaultBranchId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<MonitoringWebhookIntegration>(entity =>
        {
            entity.ToTable("monitoring_webhook_integrations");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(150).IsRequired();
            entity.Property(x => x.ToolType).HasMaxLength(50).IsRequired();
            entity.Property(x => x.EndpointSlug).HasMaxLength(100).IsRequired();
            entity.Property(x => x.SecretHash).HasMaxLength(512).IsRequired();
            entity.Property(x => x.DefaultPriority).HasMaxLength(50).IsRequired();
            entity.Property(x => x.PayloadMappingJson).HasMaxLength(16000);
            entity.Property(x => x.LastStatus).HasMaxLength(100);
            entity.Property(x => x.LastError).HasMaxLength(2000);
            entity.HasIndex(x => new { x.TenantId, x.Name }).IsUnique();
            entity.HasIndex(x => x.EndpointSlug).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.MonitoringWebhookIntegrations)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.DefaultClient)
                .WithMany()
                .HasForeignKey(x => x.DefaultClientId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.DefaultAsset)
                .WithMany()
                .HasForeignKey(x => x.DefaultAssetId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.DefaultBranch)
                .WithMany()
                .HasForeignKey(x => x.DefaultBranchId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.DefaultAssignmentGroup)
                .WithMany()
                .HasForeignKey(x => x.DefaultAssignmentGroupId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<NotificationSetting>(entity =>
        {
            entity.ToTable("notification_settings");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.TenantId).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.NotificationSettings)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<EmailDeliveryLog>(entity =>
        {
            entity.ToTable("email_delivery_logs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.EventKey).HasMaxLength(120).IsRequired();
            entity.Property(x => x.TemplateKey).HasMaxLength(120).IsRequired();
            entity.Property(x => x.RecipientEmail).HasMaxLength(256).IsRequired();
            entity.Property(x => x.Subject).HasMaxLength(300).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.ErrorCategory).HasMaxLength(120);
            entity.Property(x => x.ErrorMessage).HasMaxLength(4000);
            entity.Property(x => x.ProviderMessageId).HasMaxLength(200);
            entity.HasIndex(x => x.CreatedAt);
            entity.HasIndex(x => x.Status);
            entity.HasIndex(x => x.EventKey);
            entity.HasIndex(x => x.TemplateKey);
            entity.HasIndex(x => x.OutboxMessageId).IsUnique(false);
            entity.HasOne(x => x.Tenant)
                .WithMany()
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.OutboxMessage)
                .WithMany()
                .HasForeignKey(x => x.OutboxMessageId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<EmailOutboxMessage>(entity =>
        {
            entity.ToTable("email_outbox_messages");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.EventKey).HasMaxLength(120).IsRequired();
            entity.Property(x => x.TemplateKey).HasMaxLength(120).IsRequired();
            entity.Property(x => x.RecipientEmail).HasMaxLength(256).IsRequired();
            entity.Property(x => x.RecipientName).HasMaxLength(200);
            entity.Property(x => x.SenderName).HasMaxLength(200);
            entity.Property(x => x.SenderEmail).HasMaxLength(256);
            entity.Property(x => x.ReplyToEmail).HasMaxLength(256);
            entity.Property(x => x.Subject).HasMaxLength(300).IsRequired();
            entity.Property(x => x.HtmlBody).HasMaxLength(64000);
            entity.Property(x => x.TextBody).HasMaxLength(32000);
            entity.Property(x => x.Status).HasMaxLength(40).IsRequired();
            entity.Property(x => x.ErrorCategory).HasMaxLength(120);
            entity.Property(x => x.ErrorMessage).HasMaxLength(4000);
            entity.HasIndex(x => new { x.Status, x.NextAttemptAt });
            entity.HasIndex(x => x.CreatedAt);
            entity.HasOne(x => x.Tenant)
                .WithMany()
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<PlatformQuotation>(entity =>
        {
            entity.ToTable("platform_quotations");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.QuotationNumber).HasMaxLength(60).IsRequired();
            entity.Property(x => x.CustomerName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.CustomerEmail).HasMaxLength(256);
            entity.Property(x => x.Currency).HasMaxLength(12).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Notes).HasMaxLength(4000);
            entity.Property(x => x.Subtotal).HasPrecision(18, 2);
            entity.Property(x => x.DiscountRate).HasPrecision(9, 4);
            entity.Property(x => x.DiscountAmount).HasPrecision(18, 2);
            entity.Property(x => x.TaxRate).HasPrecision(9, 4);
            entity.Property(x => x.TaxAmount).HasPrecision(18, 2);
            entity.Property(x => x.Total).HasPrecision(18, 2);
            entity.HasIndex(x => x.QuotationNumber).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.PlatformQuotations)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasMany(x => x.Lines)
                .WithOne(x => x.Quotation)
                .HasForeignKey(x => x.QuotationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PlatformQuotationLine>(entity =>
        {
            entity.ToTable("platform_quotation_lines");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Description).HasMaxLength(500).IsRequired();
            entity.Property(x => x.Quantity).HasPrecision(18, 2);
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
            entity.Property(x => x.LineTotal).HasPrecision(18, 2);
        });

        modelBuilder.Entity<PlatformInvoice>(entity =>
        {
            entity.ToTable("platform_invoices");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.InvoiceNumber).HasMaxLength(60).IsRequired();
            entity.Property(x => x.CustomerName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.CustomerEmail).HasMaxLength(256);
            entity.Property(x => x.Currency).HasMaxLength(12).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Notes).HasMaxLength(4000);
            entity.Property(x => x.Subtotal).HasPrecision(18, 2);
            entity.Property(x => x.DiscountRate).HasPrecision(9, 4);
            entity.Property(x => x.DiscountAmount).HasPrecision(18, 2);
            entity.Property(x => x.TaxRate).HasPrecision(9, 4);
            entity.Property(x => x.TaxAmount).HasPrecision(18, 2);
            entity.Property(x => x.Total).HasPrecision(18, 2);
            entity.Property(x => x.AmountPaid).HasPrecision(18, 2);
            entity.Property(x => x.Balance).HasPrecision(18, 2);
            entity.HasIndex(x => x.InvoiceNumber).IsUnique();
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.PlatformInvoices)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Quotation)
                .WithMany()
                .HasForeignKey(x => x.QuotationId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasMany(x => x.Lines)
                .WithOne(x => x.Invoice)
                .HasForeignKey(x => x.InvoiceId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PlatformInvoiceLine>(entity =>
        {
            entity.ToTable("platform_invoice_lines");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Description).HasMaxLength(500).IsRequired();
            entity.Property(x => x.Quantity).HasPrecision(18, 2);
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
            entity.Property(x => x.LineTotal).HasPrecision(18, 2);
        });

        modelBuilder.Entity<PlatformPayment>(entity =>
        {
            entity.ToTable("platform_payments");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.PaymentNumber).HasMaxLength(60).IsRequired();
            entity.Property(x => x.Currency).HasMaxLength(12).IsRequired();
            entity.Property(x => x.Method).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Reference).HasMaxLength(200);
            entity.Property(x => x.Notes).HasMaxLength(4000);
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.HasIndex(x => x.PaymentNumber).IsUnique();
            entity.HasOne(x => x.Invoice)
                .WithMany(x => x.Payments)
                .HasForeignKey(x => x.InvoiceId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.PlatformPayments)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<PlatformExpense>(entity =>
        {
            entity.ToTable("platform_expenses");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Category).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Vendor).HasMaxLength(200);
            entity.Property(x => x.Description).HasMaxLength(1000).IsRequired();
            entity.Property(x => x.Currency).HasMaxLength(12).IsRequired();
            entity.Property(x => x.PaymentMethod).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(50).IsRequired();
            entity.Property(x => x.AttachmentUrl).HasMaxLength(1000);
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.Property(x => x.TaxAmount).HasPrecision(18, 2);
            entity.Property(x => x.TotalAmount).HasPrecision(18, 2);
            entity.HasOne(x => x.Tenant)
                .WithMany(x => x.PlatformExpenses)
                .HasForeignKey(x => x.TenantId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<PlatformDocumentTemplate>(entity =>
        {
            entity.ToTable("platform_document_templates");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Type).HasMaxLength(80).IsRequired();
            entity.Property(x => x.PreviewText).HasMaxLength(1000).IsRequired();
            entity.Property(x => x.Subject).HasMaxLength(300);
            entity.Property(x => x.HeaderHtml).HasMaxLength(12000);
            entity.Property(x => x.BodyHtml).HasMaxLength(64000);
            entity.Property(x => x.FooterHtml).HasMaxLength(12000);
            entity.Property(x => x.TermsHtml).HasMaxLength(24000);
            entity.Property(x => x.SignatureHtml).HasMaxLength(8000);
            entity.Property(x => x.PageSize).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Orientation).HasMaxLength(20).IsRequired();
            entity.HasIndex(x => new { x.Type, x.IsDefault });
        });

        modelBuilder.Entity<PlatformSetting>(entity =>
        {
            entity.ToTable("platform_settings");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Category).HasMaxLength(100).IsRequired();
            entity.Property(x => x.JsonValue).HasMaxLength(64000).IsRequired();
            entity.HasIndex(x => x.Category).IsUnique();
        });

        modelBuilder.Entity<PlatformLead>(entity =>
        {
            entity.ToTable("platform_leads");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.CompanyName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.ContactPersonName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(256).IsRequired();
            entity.Property(x => x.Phone).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Country).HasMaxLength(120);
            entity.Property(x => x.Industry).HasMaxLength(120);
            entity.Property(x => x.CompanySize).HasMaxLength(120);
            entity.Property(x => x.Message).HasMaxLength(4000);
            entity.Property(x => x.PreferredContactMethod).HasMaxLength(40);
            entity.Property(x => x.Status).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Notes).HasMaxLength(4000);
            entity.HasIndex(x => x.CreatedAt);
            entity.HasIndex(x => x.Status);
            entity.HasIndex(x => x.ConvertedTenantId);
            entity.HasOne(x => x.ConvertedTenant)
                .WithMany(x => x.ConvertedLeads)
                .HasForeignKey(x => x.ConvertedTenantId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }

    private void ApplyAuditFields()
    {
        var utcNow = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<AuditableEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = utcNow;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = utcNow;
            }
        }
    }

    private void NormalizeUtcFields()
    {
        foreach (var entry in ChangeTracker.Entries<Tenant>())
        {
            if (entry.State is not EntityState.Added and not EntityState.Modified)
            {
                continue;
            }

            entry.Entity.CreatedAt = EnsureUtc(entry.Entity.CreatedAt);
            entry.Entity.UpdatedAt = EnsureUtc(entry.Entity.UpdatedAt);
            entry.Entity.TrialEndsAt = EnsureUtc(entry.Entity.TrialEndsAt);
            entry.Entity.SubscriptionStartsAt = EnsureUtc(entry.Entity.SubscriptionStartsAt);
            entry.Entity.SubscriptionEndsAt = EnsureUtc(entry.Entity.SubscriptionEndsAt);
            entry.Entity.SuspendedAt = EnsureUtc(entry.Entity.SuspendedAt);
            entry.Entity.DeactivatedAt = EnsureUtc(entry.Entity.DeactivatedAt);
        }

        foreach (var entry in ChangeTracker.Entries<TenantLicense>())
        {
            if (entry.State is not EntityState.Added and not EntityState.Modified)
            {
                continue;
            }

            entry.Entity.CreatedAt = EnsureUtc(entry.Entity.CreatedAt);
            entry.Entity.UpdatedAt = EnsureUtc(entry.Entity.UpdatedAt);
            entry.Entity.StartsAt = EnsureUtc(entry.Entity.StartsAt);
            entry.Entity.TrialEndsAt = EnsureUtc(entry.Entity.TrialEndsAt);
            entry.Entity.ExpiresAt = EnsureUtc(entry.Entity.ExpiresAt);
            entry.Entity.NextBillingDate = EnsureUtc(entry.Entity.NextBillingDate);
            entry.Entity.SuspendedAt = EnsureUtc(entry.Entity.SuspendedAt);
            entry.Entity.CancelledAt = EnsureUtc(entry.Entity.CancelledAt);
        }

        foreach (var entry in ChangeTracker.Entries<PlatformQuotation>())
        {
            if (entry.State is not EntityState.Added and not EntityState.Modified)
            {
                continue;
            }

            entry.Entity.CreatedAt = EnsureUtc(entry.Entity.CreatedAt);
            entry.Entity.UpdatedAt = EnsureUtc(entry.Entity.UpdatedAt);
            entry.Entity.ValidUntil = EnsureUtc(entry.Entity.ValidUntil);
        }

        foreach (var entry in ChangeTracker.Entries<PlatformInvoice>())
        {
            if (entry.State is not EntityState.Added and not EntityState.Modified)
            {
                continue;
            }

            entry.Entity.CreatedAt = EnsureUtc(entry.Entity.CreatedAt);
            entry.Entity.UpdatedAt = EnsureUtc(entry.Entity.UpdatedAt);
            entry.Entity.IssueDate = EnsureUtc(entry.Entity.IssueDate);
            entry.Entity.DueDate = EnsureUtc(entry.Entity.DueDate);
        }

        foreach (var entry in ChangeTracker.Entries<PlatformPayment>())
        {
            if (entry.State is not EntityState.Added and not EntityState.Modified)
            {
                continue;
            }

            entry.Entity.CreatedAt = EnsureUtc(entry.Entity.CreatedAt);
            entry.Entity.UpdatedAt = EnsureUtc(entry.Entity.UpdatedAt);
            entry.Entity.PaidAt = EnsureUtc(entry.Entity.PaidAt);
        }

        foreach (var entry in ChangeTracker.Entries<PlatformExpense>())
        {
            if (entry.State is not EntityState.Added and not EntityState.Modified)
            {
                continue;
            }

            entry.Entity.CreatedAt = EnsureUtc(entry.Entity.CreatedAt);
            entry.Entity.UpdatedAt = EnsureUtc(entry.Entity.UpdatedAt);
            entry.Entity.ExpenseDate = EnsureUtc(entry.Entity.ExpenseDate);
            entry.Entity.ApprovedAt = EnsureUtc(entry.Entity.ApprovedAt);
        }

        foreach (var entry in ChangeTracker.Entries<PlatformLead>())
        {
            if (entry.State is not EntityState.Added and not EntityState.Modified)
            {
                continue;
            }

            entry.Entity.CreatedAt = EnsureUtc(entry.Entity.CreatedAt);
            entry.Entity.UpdatedAt = EnsureUtc(entry.Entity.UpdatedAt);
            entry.Entity.ContactedAt = EnsureUtc(entry.Entity.ContactedAt);
        }

        foreach (var entry in ChangeTracker.Entries<PasswordResetToken>())
        {
            if (entry.State is not EntityState.Added and not EntityState.Modified)
            {
                continue;
            }

            entry.Entity.CreatedAt = EnsureUtc(entry.Entity.CreatedAt);
            entry.Entity.UpdatedAt = EnsureUtc(entry.Entity.UpdatedAt);
            entry.Entity.ExpiresAt = EnsureUtc(entry.Entity.ExpiresAt);
            entry.Entity.UsedAt = EnsureUtc(entry.Entity.UsedAt);
        }

        foreach (var entry in ChangeTracker.Entries<EmailDeliveryLog>())
        {
            if (entry.State is not EntityState.Added and not EntityState.Modified)
            {
                continue;
            }

            entry.Entity.CreatedAt = EnsureUtc(entry.Entity.CreatedAt);
            entry.Entity.UpdatedAt = EnsureUtc(entry.Entity.UpdatedAt);
            entry.Entity.LastAttemptAt = EnsureUtc(entry.Entity.LastAttemptAt);
            entry.Entity.NextAttemptAt = EnsureUtc(entry.Entity.NextAttemptAt);
            entry.Entity.SentAt = EnsureUtc(entry.Entity.SentAt);
        }

        foreach (var entry in ChangeTracker.Entries<EmailOutboxMessage>())
        {
            if (entry.State is not EntityState.Added and not EntityState.Modified)
            {
                continue;
            }

            entry.Entity.CreatedAt = EnsureUtc(entry.Entity.CreatedAt);
            entry.Entity.UpdatedAt = EnsureUtc(entry.Entity.UpdatedAt);
            entry.Entity.NextAttemptAt = EnsureUtc(entry.Entity.NextAttemptAt);
            entry.Entity.LastAttemptAt = EnsureUtc(entry.Entity.LastAttemptAt);
            entry.Entity.SentAt = EnsureUtc(entry.Entity.SentAt);
        }
    }

    private static DateTime EnsureUtc(DateTime value)
    {
        if (value.Kind == DateTimeKind.Utc)
        {
            return value;
        }

        if (value.Kind == DateTimeKind.Unspecified)
        {
            return DateTime.SpecifyKind(value, DateTimeKind.Utc);
        }

        return value.ToUniversalTime();
    }

    private static DateTime? EnsureUtc(DateTime? value) =>
        value.HasValue ? EnsureUtc(value.Value) : null;
}
