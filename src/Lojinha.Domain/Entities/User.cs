namespace Lojinha.Api.Entities;

public sealed class User : AuditableEntity
{
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Admin;
    public Guid? SupplierId { get; set; }
    public Supplier? Supplier { get; set; }
}