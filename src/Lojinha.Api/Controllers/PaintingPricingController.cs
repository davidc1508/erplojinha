using Lojinha.Api.Contracts.PaintingPricing;
using Lojinha.Api.Extensions;
using Lojinha.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lojinha.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Supplier")]
[Route("api/painting-pricing")]
public sealed class PaintingPricingController(IPaintingPricingService paintingPricingService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PaintingPricingOverviewDto>> GetOverview(CancellationToken cancellationToken)
        => Ok(await paintingPricingService.GetOverviewAsync(cancellationToken));

    [HttpPost("calculate")]
    public Task<ActionResult<PaintingPricingResultDto>> Calculate([FromBody] PaintingPricingCalculationRequest request, CancellationToken cancellationToken)
        => Execute(() => paintingPricingService.CalculateAsync(request, cancellationToken));

    [HttpPost("product-preview")]
    public Task<ActionResult<ProductPaintingCalculationDto?>> PreviewProductPainting([FromBody] ProductPaintingRequest request, CancellationToken cancellationToken)
        => Execute(() => paintingPricingService.CalculateForProductAsync(request, cancellationToken));

    [HttpGet("history")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<IReadOnlyList<PaintingHistoryEntryDto>>> GetHistory([FromQuery] int take = 100, CancellationToken cancellationToken = default)
        => Ok(await paintingPricingService.GetHistoryAsync(take, cancellationToken));

    [HttpPut("settings")]
    [Authorize(Roles = "Admin")]
    public Task<ActionResult<PaintingSettingsDto>> UpdateSettings([FromBody] UpdatePaintingSettingsRequest request, CancellationToken cancellationToken)
        => Execute(() => paintingPricingService.UpdateSettingsAsync(request, User.GetEmail(), cancellationToken));

    [HttpPost("levels")]
    [Authorize(Roles = "Admin")]
    public Task<ActionResult<PaintingLevelDto>> CreateLevel([FromBody] PaintingLevelRequest request, CancellationToken cancellationToken)
        => Execute(() => paintingPricingService.CreateLevelAsync(request, User.GetEmail(), cancellationToken));

    [HttpPut("levels/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<ActionResult<PaintingLevelDto>> UpdateLevel(Guid id, [FromBody] PaintingLevelRequest request, CancellationToken cancellationToken)
        => ExecuteOrNotFound(() => paintingPricingService.UpdateLevelAsync(id, request, User.GetEmail(), cancellationToken));

    [HttpDelete("levels/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> DeleteLevel(Guid id, CancellationToken cancellationToken)
        => ExecuteDelete(() => paintingPricingService.DeleteLevelAsync(id, User.GetEmail(), cancellationToken));

    [HttpPost("complexities")]
    [Authorize(Roles = "Admin")]
    public Task<ActionResult<PaintingComplexityDto>> CreateComplexity([FromBody] PaintingComplexityRequest request, CancellationToken cancellationToken)
        => Execute(() => paintingPricingService.CreateComplexityAsync(request, User.GetEmail(), cancellationToken));

    [HttpPut("complexities/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<ActionResult<PaintingComplexityDto>> UpdateComplexity(Guid id, [FromBody] PaintingComplexityRequest request, CancellationToken cancellationToken)
        => ExecuteOrNotFound(() => paintingPricingService.UpdateComplexityAsync(id, request, User.GetEmail(), cancellationToken));

    [HttpDelete("complexities/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> DeleteComplexity(Guid id, CancellationToken cancellationToken)
        => ExecuteDelete(() => paintingPricingService.DeleteComplexityAsync(id, User.GetEmail(), cancellationToken));

    [HttpPost("size-ranges")]
    [Authorize(Roles = "Admin")]
    public Task<ActionResult<PaintingSizeRangeDto>> CreateSizeRange([FromBody] PaintingSizeRangeRequest request, CancellationToken cancellationToken)
        => Execute(() => paintingPricingService.CreateSizeRangeAsync(request, User.GetEmail(), cancellationToken));

    [HttpPut("size-ranges/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<ActionResult<PaintingSizeRangeDto>> UpdateSizeRange(Guid id, [FromBody] PaintingSizeRangeRequest request, CancellationToken cancellationToken)
        => ExecuteOrNotFound(() => paintingPricingService.UpdateSizeRangeAsync(id, request, User.GetEmail(), cancellationToken));

    [HttpDelete("size-ranges/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> DeleteSizeRange(Guid id, CancellationToken cancellationToken)
        => ExecuteDelete(() => paintingPricingService.DeleteSizeRangeAsync(id, User.GetEmail(), cancellationToken));

    [HttpPost("preparation-services")]
    [Authorize(Roles = "Admin")]
    public Task<ActionResult<PaintingPreparationServiceDto>> CreatePreparationService([FromBody] PaintingPreparationServiceRequest request, CancellationToken cancellationToken)
        => Execute(() => paintingPricingService.CreatePreparationServiceAsync(request, User.GetEmail(), cancellationToken));

    [HttpPut("preparation-services/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<ActionResult<PaintingPreparationServiceDto>> UpdatePreparationService(Guid id, [FromBody] PaintingPreparationServiceRequest request, CancellationToken cancellationToken)
        => ExecuteOrNotFound(() => paintingPricingService.UpdatePreparationServiceAsync(id, request, User.GetEmail(), cancellationToken));

    [HttpDelete("preparation-services/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> DeletePreparationService(Guid id, CancellationToken cancellationToken)
        => ExecuteDelete(() => paintingPricingService.DeletePreparationServiceAsync(id, User.GetEmail(), cancellationToken));

    [HttpPost("materials")]
    [Authorize(Roles = "Admin")]
    public Task<ActionResult<PaintingMaterialDto>> CreateMaterial([FromBody] PaintingMaterialRequest request, CancellationToken cancellationToken)
        => Execute(() => paintingPricingService.CreateMaterialAsync(request, User.GetEmail(), cancellationToken));

    [HttpPut("materials/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<ActionResult<PaintingMaterialDto>> UpdateMaterial(Guid id, [FromBody] PaintingMaterialRequest request, CancellationToken cancellationToken)
        => ExecuteOrNotFound(() => paintingPricingService.UpdateMaterialAsync(id, request, User.GetEmail(), cancellationToken));

    [HttpDelete("materials/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> DeleteMaterial(Guid id, CancellationToken cancellationToken)
        => ExecuteDelete(() => paintingPricingService.DeleteMaterialAsync(id, User.GetEmail(), cancellationToken));

    [HttpPost("add-ons")]
    [Authorize(Roles = "Admin")]
    public Task<ActionResult<PaintingAddOnDto>> CreateAddOn([FromBody] PaintingAddOnRequest request, CancellationToken cancellationToken)
        => Execute(() => paintingPricingService.CreateAddOnAsync(request, User.GetEmail(), cancellationToken));

    [HttpPut("add-ons/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<ActionResult<PaintingAddOnDto>> UpdateAddOn(Guid id, [FromBody] PaintingAddOnRequest request, CancellationToken cancellationToken)
        => ExecuteOrNotFound(() => paintingPricingService.UpdateAddOnAsync(id, request, User.GetEmail(), cancellationToken));

    [HttpDelete("add-ons/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> DeleteAddOn(Guid id, CancellationToken cancellationToken)
        => ExecuteDelete(() => paintingPricingService.DeleteAddOnAsync(id, User.GetEmail(), cancellationToken));

    private async Task<ActionResult<T>> Execute<T>(Func<Task<T>> action)
    {
        try
        {
            return Ok(await action());
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    private async Task<ActionResult<T>> ExecuteOrNotFound<T>(Func<Task<T?>> action) where T : class
    {
        try
        {
            var result = await action();
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    private async Task<IActionResult> ExecuteDelete(Func<Task<bool>> action)
    {
        try
        {
            return await action() ? NoContent() : NotFound();
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(new { message = exception.Message });
        }
    }
}
