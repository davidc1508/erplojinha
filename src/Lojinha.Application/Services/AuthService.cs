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

        var options = jwtOptions.Value;
        var expiresAt = DateTime.UtcNow.AddMinutes(options.ExpirationMinutes);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role.ToString())
        };

        if (user.SupplierId.HasValue)
        {
            claims.Add(new Claim("supplier_id", user.SupplierId.Value.ToString()));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.Key));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: options.Issuer,
            audience: options.Audience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials);

        await auditRepository.AddAsync(new AuditLog
        {
            EntityName = nameof(User),
            EntityId = user.Id.ToString(),
            Action = AuditAction.LoggedIn,
            ChangedBy = user.Email,
            PayloadJson = "{\"event\":\"login\"}"
        }, cancellationToken);

        await auditRepository.SaveChangesAsync(cancellationToken);

        return new AuthResponse(
            new JwtSecurityTokenHandler().WriteToken(token),
            user.Email,
            user.FullName,
            user.Role,
            user.SupplierId,
            expiresAt);
    }
}