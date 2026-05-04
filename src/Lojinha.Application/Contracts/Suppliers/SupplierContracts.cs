namespace Lojinha.Api.Contracts.Suppliers;

public sealed record SupplierRequest(
    string Name,
    string? ContactName,
    string? PhoneNumber,
    string? Notes);

public sealed record SupplierDto(
    Guid Id,
    string Name,
    string ContactName,
    string PhoneNumber,
    string Notes);