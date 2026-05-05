using System.Security.Claims;

namespace Lojinha.Api.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static Guid? GetUserId(this ClaimsPrincipal user)
        => Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ? userId : null;

    public static string GetEmail(this ClaimsPrincipal user)
        => user.FindFirstValue(ClaimTypes.Email) ?? "system";

    public static Guid? GetSupplierId(this ClaimsPrincipal user)
        => Guid.TryParse(user.FindFirstValue("supplier_id"), out var supplierId) ? supplierId : null;
}