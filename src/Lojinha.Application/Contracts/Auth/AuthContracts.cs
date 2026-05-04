using Lojinha.Api.Entities;

namespace Lojinha.Api.Contracts.Auth;

public sealed record LoginRequest(string Email, string Password);

public sealed record AuthResponse(
    string Token,
    string Email,
    string FullName,
    UserRole Role,
    Guid? SupplierId,
    DateTime ExpiresAtUtc);

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);