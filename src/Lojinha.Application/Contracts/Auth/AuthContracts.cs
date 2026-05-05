using Lojinha.Api.Entities;

namespace Lojinha.Api.Contracts.Auth;

public sealed record LoginRequest(string Email, string Password);

public sealed record ImpersonateRequest(Guid UserId);

public sealed record AuthResponse(
    string Token,
    string Email,
    string FullName,
    UserRole Role,
    Guid? SupplierId,
    bool IsImpersonating,
    Guid? ImpersonatorUserId,
    string? ImpersonatorEmail,
    DateTime ExpiresAtUtc);

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);