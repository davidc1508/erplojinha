using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Lojinha.Api.Contracts.Auth;
using Lojinha.Api.Entities;
using Lojinha.Api.Options;
using Lojinha.Api.Repositories;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Lojinha.Api.Services;

public interface IAuthService
{
    Task<AuthResponse?> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
    Task<AuthResponse?> ImpersonateAsync(Guid adminUserId, Guid targetUserId, CancellationToken cancellationToken = default);
}

public sealed class AuthService(
    IRepository<User> userRepository,
    IRepository<AuditLog> auditRepository,
    IOptions<JwtOptions> jwtOptions) : IAuthService
{
    private readonly PasswordHasher<User> _passwordHasher = new();

    public async Task<AuthResponse?> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var user = userRepository.Query().FirstOrDefault(x => x.Email.ToLower() == request.Email.ToLower());
        if (user is null)
        {
            return null;
        }

        var verification = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verification == PasswordVerificationResult.Failed)
        {
            return null;
        }

        if (verification == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
            userRepository.Update(user);
            await userRepository.SaveChangesAsync(cancellationToken);
        }

        var authResponse = BuildAuthResponse(user, null);

        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(User),
            EntityId = user.Id.ToString(),
            Action = AuditAction.LoggedIn,
            ChangedBy = user.Email,
            PayloadJson = "{\"event\":\"login\"}"
        }, cancellationToken);

        await auditRepository.SaveChangesAsync(cancellationToken);

        return authResponse;
    }

    public async Task<AuthResponse?> ImpersonateAsync(Guid adminUserId, Guid targetUserId, CancellationToken cancellationToken = default)
    {
        var adminUser = await userRepository.GetByIdAsync(adminUserId, cancellationToken);
        if (adminUser is null || adminUser.Role != UserRole.Admin)
        {
            return null;
        }

        var targetUser = await userRepository.GetByIdAsync(targetUserId, cancellationToken);
        if (targetUser is null)
        {
            return null;
        }

        var authResponse = BuildAuthResponse(targetUser, adminUser);

        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(User),
            EntityId = targetUser.Id.ToString(),
            Action = AuditAction.LoggedIn,
            ChangedBy = adminUser.Email,
            PayloadJson = $"{{\"event\":\"impersonation_started\",\"admin_user_id\":\"{adminUser.Id}\",\"target_user_id\":\"{targetUser.Id}\"}}"
        }, cancellationToken);

        await auditRepository.SaveChangesAsync(cancellationToken);

        return authResponse;
    }

    private AuthResponse BuildAuthResponse(User effectiveUser, User? impersonator)
    {
        var options = jwtOptions.Value;
        var expiresAt = DateTime.UtcNow.AddMinutes(options.ExpirationMinutes);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, effectiveUser.Id.ToString()),
            new(ClaimTypes.Name, effectiveUser.FullName),
            new(ClaimTypes.Email, effectiveUser.Email),
            new(ClaimTypes.Role, effectiveUser.Role.ToString())
        };

        if (effectiveUser.SupplierId.HasValue)
        {
            claims.Add(new Claim("supplier_id", effectiveUser.SupplierId.Value.ToString()));
        }

        if (impersonator is not null)
        {
            claims.Add(new Claim("impersonator_user_id", impersonator.Id.ToString()));
            claims.Add(new Claim("impersonator_email", impersonator.Email));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.Key));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: options.Issuer,
            audience: options.Audience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials);

        return new AuthResponse(
            new JwtSecurityTokenHandler().WriteToken(token),
            effectiveUser.Email,
            effectiveUser.FullName,
            effectiveUser.Role,
            effectiveUser.SupplierId,
            impersonator is not null,
            impersonator?.Id,
            impersonator?.Email,
            expiresAt);
    }
}