using Lojinha.Api.Contracts.CardFees;
using Lojinha.Api.Extensions;
using Lojinha.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lojinha.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/card-fee-settings")]
public sealed class CardFeeSettingsController(ICardFeeSettingsService cardFeeSettingsService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<CardFeeSettingsDto>> Get(CancellationToken cancellationToken)
        => Ok(await cardFeeSettingsService.GetAsync(cancellationToken));

    [HttpPut]
    public async Task<ActionResult<CardFeeSettingsDto>> Update([FromBody] UpdateCardFeeSettingsRequest request, CancellationToken cancellationToken)
        => Ok(await cardFeeSettingsService.UpdateAsync(request, User.GetEmail(), cancellationToken));

    [HttpPost("reprocess-sales")]
    public async Task<ActionResult<CardFeeReprocessResultDto>> ReprocessSales(CancellationToken cancellationToken)
        => Ok(await cardFeeSettingsService.ReprocessCardSalesAsync(User.GetEmail(), cancellationToken));
}
