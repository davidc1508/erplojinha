namespace Lojinha.Api.Options;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; init; } = "Lojinha.Api";
    public string Audience { get; init; } = "Lojinha.Web";
    public string Key { get; init; } = "LOJINHA_SUPER_SECRET_KEY_2026_CHANGE_ME_NOW";
    public int ExpirationMinutes { get; init; } = 480;
}