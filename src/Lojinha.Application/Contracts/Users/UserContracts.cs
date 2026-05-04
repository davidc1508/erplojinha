using Lojinha.Api.Entities;

namespace Lojinha.Api.Contracts.Users;

public sealed record CreateUserRequest(
    string Email,
    string FullName,
    string Password,
    UserRole Role,
    Guid? SupplierId);

public sealed record UpdateUserRequest(
    string Email,
    string FullName,
    string? Password,
    UserRole Role,
    Guid? SupplierId);

public sealed record UserDto(
    Guid Id,
    string Email,
    string FullName,
    UserRole Role,
    Guid? SupplierId,
    string? SupplierName,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);