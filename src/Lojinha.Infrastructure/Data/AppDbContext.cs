using Lojinha.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lojinha.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<ProductCategory> Categories => Set<ProductCategory>();
    public DbSet<Supply> Supplies => Set<Supply>();
    public DbSet<PrinterProfile> PrinterProfiles => Set<PrinterProfile>();
    public DbSet<FilamentProfile> FilamentProfiles => Set<FilamentProfile>();
    public DbSet<MarketplaceFee> MarketplaceFees => Set<MarketplaceFee>();
    public DbSet<CardFeeSettings> CardFeeSettings => Set<CardFeeSettings>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductRecipe> ProductRecipes => Set<ProductRecipe>();
    public DbSet<ProductRecipeItem> ProductRecipeItems => Set<ProductRecipeItem>();
    public DbSet<InventoryMovement> InventoryMovements => Set<InventoryMovement>();
    public DbSet<Fair> Fairs => Set<Fair>();
    public DbSet<FairSupplier> FairSuppliers => Set<FairSupplier>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<FinancialEntry> FinancialEntries => Set<FinancialEntry>();
    public DbSet<OperationalRestockItem> OperationalRestockItems => Set<OperationalRestockItem>();
    public DbSet<OperationalTodoItem> OperationalTodoItems => Set<OperationalTodoItem>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectStep> ProjectSteps => Set<ProjectStep>();
    public DbSet<ProjectStepAttempt> ProjectStepAttempts => Set<ProjectStepAttempt>();
    public DbSet<PersonalizedPricingTier> PersonalizedPricingTiers => Set<PersonalizedPricingTier>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<ProductFilament> ProductFilaments => Set<ProductFilament>();
    public DbSet<ProjectStepFilament> ProjectStepFilaments => Set<ProjectStepFilament>();
    public DbSet<ProjectStepAttemptFilament> ProjectStepAttemptFilaments => Set<ProjectStepAttemptFilament>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("public");

        modelBuilder.Entity<User>().HasIndex(x => x.Email).IsUnique();
        modelBuilder.Entity<ProductCategory>().HasIndex(x => x.Name).IsUnique();
        modelBuilder.Entity<ProductCategory>().HasIndex(x => x.NumericIdentifier).IsUnique();
        modelBuilder.Entity<Supplier>().HasIndex(x => x.Name).IsUnique();
        modelBuilder.Entity<Supply>().HasIndex(x => x.Name).IsUnique();
        modelBuilder.Entity<PrinterProfile>().HasIndex(x => x.Name).IsUnique();
        modelBuilder.Entity<FilamentProfile>().HasIndex(x => x.Name).IsUnique();
        modelBuilder.Entity<MarketplaceFee>().HasIndex(x => x.Name).IsUnique();
        modelBuilder.Entity<Product>().HasIndex(x => x.Sku).IsUnique();
        modelBuilder.Entity<Product>().HasIndex(x => x.NumericIdentifier).IsUnique();
        modelBuilder.Entity<Fair>().HasIndex(x => new { x.Name, x.EventDateUtc, x.EndDateUtc });
        modelBuilder.Entity<PersonalizedPricingTier>().HasIndex(x => x.Order).IsUnique();

        modelBuilder.Entity<Product>()
            .Property(x => x.Sku)
            .HasMaxLength(80)
            .IsRequired(false);

        modelBuilder.Entity<ProductCategory>()
            .Property(x => x.NumericIdentifier)
            .IsRequired();

        modelBuilder.Entity<Product>()
            .Property(x => x.NumericIdentifier)
            .IsRequired();

        modelBuilder.Entity<User>().Property(x => x.Role).HasConversion<string>();
        modelBuilder.Entity<Fair>().Property(x => x.Status).HasConversion<string>();
        modelBuilder.Entity<InventoryMovement>().Property(x => x.ItemType).HasConversion<string>();
        modelBuilder.Entity<InventoryMovement>().Property(x => x.Type).HasConversion<string>();
        modelBuilder.Entity<Sale>().Property(x => x.PaymentMethod).HasConversion<string>();
        modelBuilder.Entity<Sale>().Property(x => x.Status).HasConversion<string>();
        modelBuilder.Entity<Product>().Property(x => x.LifecycleStatus).HasConversion<string>();
        modelBuilder.Entity<FinancialEntry>().Property(x => x.Type).HasConversion<string>();
        modelBuilder.Entity<FinancialEntry>().Property(x => x.Classification).HasConversion<string>();
        modelBuilder.Entity<OperationalRestockItem>().Property(x => x.Priority).HasConversion<string>();
        modelBuilder.Entity<OperationalRestockItem>().Property(x => x.Status).HasConversion<string>();
        modelBuilder.Entity<OperationalTodoItem>().Property(x => x.Priority).HasConversion<string>();
        modelBuilder.Entity<Project>().Property(x => x.Status).HasConversion<string>();
        modelBuilder.Entity<ProjectStep>().Property(x => x.Status).HasConversion<string>();
        modelBuilder.Entity<ProjectStepAttempt>().Property(x => x.Status).HasConversion<string>();
        modelBuilder.Entity<AuditLog>().Property(x => x.Action).HasConversion<string>();

        modelBuilder.Entity<Product>()
            .HasOne(x => x.Recipe)
            .WithOne(x => x.Product)
            .HasForeignKey<ProductRecipe>(x => x.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ProductFilament>()
                .HasOne(x => x.Product)
                .WithMany(x => x.Filaments)
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ProductFilament>()
                .HasOne(x => x.FilamentProfile)
                .WithMany(x => x.ProductFilaments)
                .HasForeignKey(x => x.FilamentProfileId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ProjectStepFilament>()
                .HasOne(x => x.Step)
                .WithMany(x => x.FilamentsPlanned)
                .HasForeignKey(x => x.StepId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ProjectStepFilament>()
                .HasOne(x => x.FilamentProfile)
                .WithMany()
                .HasForeignKey(x => x.FilamentProfileId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ProjectStepAttemptFilament>()
                .HasOne(x => x.Attempt)
                .WithMany(x => x.FilamentsUsed)
                .HasForeignKey(x => x.AttemptId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ProjectStepAttemptFilament>()
                .HasOne(x => x.FilamentProfile)
                .WithMany()
                .HasForeignKey(x => x.FilamentProfileId)
                .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<User>()
            .HasOne(x => x.Supplier)
            .WithMany(x => x.Users)
            .HasForeignKey(x => x.SupplierId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<FinancialEntry>()
            .HasOne(x => x.Supplier)
            .WithMany(x => x.FinancialEntries)
            .HasForeignKey(x => x.SupplierId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<OperationalRestockItem>()
            .HasOne(x => x.OwnerSupplier)
            .WithMany(x => x.RestockItems)
            .HasForeignKey(x => x.OwnerSupplierId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<OperationalRestockItem>()
            .HasOne(x => x.Product)
            .WithMany()
            .HasForeignKey(x => x.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<OperationalTodoItem>()
            .HasOne(x => x.OwnerSupplier)
            .WithMany(x => x.TodoItems)
            .HasForeignKey(x => x.OwnerSupplierId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<OperationalRestockItem>()
            .HasIndex(x => new { x.OwnerSupplierId, x.Status, x.Priority });

        modelBuilder.Entity<OperationalTodoItem>()
            .HasIndex(x => new { x.OwnerSupplierId, x.Priority });

        modelBuilder.Entity<Product>()
            .HasOne(x => x.Supplier)
            .WithMany(x => x.Products)
            .HasForeignKey(x => x.SupplierId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<ProductRecipeItem>()
            .HasOne(x => x.Supply)
            .WithMany(x => x.RecipeItems)
            .HasForeignKey(x => x.SupplyId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SaleItem>()
            .HasOne(x => x.Product)
            .WithMany(x => x.SaleItems)
            .HasForeignKey(x => x.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SaleItem>()
            .HasOne(x => x.Supplier)
            .WithMany()
            .HasForeignKey(x => x.SupplierId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SaleItem>()
            .HasOne(x => x.CommissionSellerSupplier)
            .WithMany()
            .HasForeignKey(x => x.CommissionSellerSupplierId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Sale>()
            .HasOne(x => x.Fair)
            .WithMany(x => x.Sales)
            .HasForeignKey(x => x.FairId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<FairSupplier>()
            .HasIndex(x => new { x.FairId, x.SupplierId })
            .IsUnique();

        modelBuilder.Entity<FairSupplier>()
            .HasOne(x => x.Fair)
            .WithMany(x => x.Suppliers)
            .HasForeignKey(x => x.FairId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<FairSupplier>()
            .HasOne(x => x.Supplier)
            .WithMany(x => x.FairLinks)
            .HasForeignKey(x => x.SupplierId)
            .OnDelete(DeleteBehavior.Cascade);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties().Where(p => p.ClrType == typeof(decimal)))
            {
                property.SetPrecision(18);
                property.SetScale(2);
            }
        }
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var tracked = ChangeTracker.Entries<AuditableEntity>();
        var now = DateTime.UtcNow;

        foreach (var entry in tracked)
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAtUtc = now;
            }

            if (entry.State is EntityState.Added or EntityState.Modified)
            {
                entry.Entity.UpdatedAtUtc = now;
            }
        }

        return await base.SaveChangesAsync(cancellationToken);
    }
}