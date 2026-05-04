using System.Text.Json;
using System.Text.RegularExpressions;
using Lojinha.Api.Contracts.Users;
using Lojinha.Api.Entities;
using Lojinha.Api.Repositories;
using Microsoft.AspNetCore.Identity;

namespace Lojinha.Api.Services;

public interface IUserService
{
    Task<IReadOnlyList<UserDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<UserDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<UserDto> CreateAsync(CreateUserRequest request, string actor, CancellationToken cancellationToken = default);
    Task<UserDto?> UpdateAsync(Guid id, UpdateUserRequest request, string actor, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, string actor, CancellationToken cancellationToken = default);
    Task<bool> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword, string actor, CancellationToken cancellationToken = default);
}

public sealed class UserService(
    IRepository<User> userRepository,
    IRepository<Supplier> supplierRepository,
    IRepository<AuditLog> auditRepository) : IUserService
{
    private readonly PasswordHasher<User> _passwordHasher = new();

    public Task<IReadOnlyList<UserDto>> GetAllAsync(CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<UserDto>>(userRepository.Query()
            .Select(user => new
            {
                User = user,
                SupplierName = user.Supplier != null ? user.Supplier.Name : null
            })
            .OrderBy(x => x.User.FullName)
            .ThenBy(x => x.User.Email)
            .Select(x => Map(x.User, x.SupplierName))
            .ToList());

    public async Task<UserDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByIdAsync(id, cancellationToken);
        if (user is null)
        {
            return null;
        }

        var supplierName = user.SupplierId.HasValue
            ? supplierRepository.Query().Where(supplier => supplier.Id == user.SupplierId.Value).Select(supplier => supplier.Name).FirstOrDefault()
            : null;
        return Map(user, supplierName);
    }

    public async Task<UserDto> CreateAsync(CreateUserRequest request, string actor, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = NormalizeEmail(request.Email);
        EnsureEmailIsUnique(normalizedEmail);

        var user = new User
        {
            Email = normalizedEmail,
            FullName = request.FullName.Trim(),
            Role = request.Role,
            SupplierId = NormalizeSupplierId(request.Role, request.SupplierId)
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

        await userRepository.AddAsync(user, cancellationToken);
        await auditRepository.AddAsync(CreateAudit(user.Id, AuditAction.Created, actor, new { user.Email, user.FullName, user.Role }), cancellationToken);
        await userRepository.SaveChangesAsync(cancellationToken);
        return Map(user);
    }

    public async Task<UserDto?> UpdateAsync(Guid id, UpdateUserRequest request, string actor, CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByIdAsync(id, cancellationToken);
        if (user is null)
        {
            return null;
        }

        var normalizedEmail = NormalizeEmail(request.Email);
        EnsureEmailIsUnique(normalizedEmail, id);

        user.Email = normalizedEmail;
        user.FullName = request.FullName.Trim();
        user.Role = request.Role;
        user.SupplierId = NormalizeSupplierId(request.Role, request.SupplierId);

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        }

        userRepository.Update(user);
        await auditRepository.AddAsync(CreateAudit(user.Id, AuditAction.Updated, actor, new { user.Email, user.FullName, user.Role, PasswordChanged = !string.IsNullOrWhiteSpace(request.Password) }), cancellationToken);
        await userRepository.SaveChangesAsync(cancellationToken);
        return Map(user);
    }

    public async Task<bool> DeleteAsync(Guid id, string actor, CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByIdAsync(id, cancellationToken);
        if (user is null)
        {
            return false;
        }

        userRepository.Remove(user);
        await auditRepository.AddAsync(CreateAudit(user.Id, AuditAction.Deleted, actor, new { user.Email, user.FullName, user.Role }), cancellationToken);
        await userRepository.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword, string actor, CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByIdAsync(userId, cancellationToken);
        if (user is null)
        {
            return false;
        }

        var verification = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, currentPassword);
        if (verification == PasswordVerificationResult.Failed)
        {
            throw new InvalidOperationException("Senha atual incorreta.");
        }

        ValidatePasswordStrength(newPassword);

        user.PasswordHash = _passwordHasher.HashPassword(user, newPassword);
        userRepository.Update(user);
        await auditRepository.AddAsync(CreateAudit(user.Id, AuditAction.Updated, actor, new { event_ = "password_changed" }), cancellationToken);
        await userRepository.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static void ValidatePasswordStrength(string password)
    {
        if (password.Length < 8)
            throw new InvalidOperationException("A senha deve ter no mínimo 8 caracteres.");
        if (!Regex.IsMatch(password, "[A-Z]"))
            throw new InvalidOperationException("A senha deve conter pelo menos uma letra maiúscula.");
        if (!Regex.IsMatch(password, "[a-z]"))
            throw new InvalidOperationException("A senha deve conter pelo menos uma letra minúscula.");
        if (!Regex.IsMatch(password, "[0-9]"))
            throw new InvalidOperationException("A senha deve conter pelo menos um número.");
        if (!Regex.IsMatch(password, @"[^A-Za-z0-9]"))
            throw new InvalidOperationException("A senha deve conter pelo menos um caractere especial.");
    }

    private void EnsureEmailIsUnique(string email, Guid? currentUserId = null)
    {
        var exists = userRepository.Query().Any(user => user.Email.ToLower() == email.ToLower() && (!currentUserId.HasValue || user.Id != currentUserId.Value));
        if (exists)
        {
            throw new InvalidOperationException("Ja existe um usuario cadastrado com este e-mail.");
        }
    }

    private static string NormalizeEmail(string email)
        => email.Trim().ToLowerInvariant();

    private Guid? NormalizeSupplierId(UserRole role, Guid? supplierId)
    {
        if (role != UserRole.Supplier)
        {
            return null;
        }

        if (!supplierId.HasValue)
        {
            throw new InvalidOperationException("Selecione um fornecedor para o usuario com perfil de fornecedor.");
        }

        var exists = supplierRepository.Query().Any(supplier => supplier.Id == supplierId.Value);
        if (!exists)
        {
            throw new InvalidOperationException("Fornecedor informado para o usuario nao foi encontrado.");
        }

        return supplierId.Value;
    }

    private static UserDto Map(User user, string? supplierName = null)
        => new(user.Id, user.Email, user.FullName, user.Role, user.SupplierId, supplierName, user.CreatedAtUtc, user.UpdatedAtUtc);

    private static AuditLog CreateAudit(Guid userId, AuditAction action, string actor, object payload)
        => new()
        {
            EntityName = nameof(User),
            EntityId = userId.ToString(),
            Action = action,
            ChangedBy = actor,
            PayloadJson = JsonSerializer.Serialize(payload)
        };
}