using Lojinha.Api.Contracts.Personalized;
using Lojinha.Api.Entities;
using Lojinha.Api.Extensions;
using Lojinha.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lojinha.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Supplier")]
[Route("api/[controller]")]
public sealed class PersonalizadosController(IPersonalizedService personalizedService) : ControllerBase
{
    private Guid? ScopedSupplierId => User.IsInRole(UserRole.Supplier.ToString()) ? User.GetSupplierId() : null;

    [HttpGet("pricing")]
    public async Task<ActionResult<IReadOnlyList<PersonalizedPricingTierDto>>> GetPricing(CancellationToken cancellationToken)
        => Ok(await personalizedService.GetPricingAsync(cancellationToken));

    [HttpPut("pricing")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<IReadOnlyList<PersonalizedPricingTierDto>>> SavePricing([FromBody] IReadOnlyList<PersonalizedPricingTierRequest> request, CancellationToken cancellationToken)
        => Ok(await personalizedService.SavePricingAsync(request, User.GetEmail(), cancellationToken));

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PersonalizedProjectDto>>> GetProjects(CancellationToken cancellationToken)
        => Ok(await personalizedService.GetProjectsAsync(ScopedSupplierId, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<PersonalizedProjectDto>> CreateProject([FromBody] CreatePersonalizedProjectRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var created = await personalizedService.CreateProjectAsync(request, User.GetEmail(), ScopedSupplierId, cancellationToken);
            return CreatedAtAction(nameof(GetProjects), new { id = created.Project.Id }, created);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPut("{projectId:guid}/orcamento")]
    public async Task<ActionResult<PersonalizedProjectDto>> UpdateBudget(Guid projectId, [FromBody] UpdatePersonalizedBudgetRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var updated = await personalizedService.UpdateBudgetAsync(projectId, request, User.GetEmail(), ScopedSupplierId, cancellationToken);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost("{projectId:guid}/orcamento/avancar")]
    public async Task<ActionResult<PersonalizedProjectDto>> AdvanceBudget(Guid projectId, CancellationToken cancellationToken)
        => await Handle(() => personalizedService.AdvanceBudgetAsync(projectId, User.GetEmail(), ScopedSupplierId, cancellationToken));

    [HttpPost("{projectId:guid}/orcamento/rejeitar")]
    public async Task<ActionResult<PersonalizedProjectDto>> RejectBudget(Guid projectId, [FromBody] RejectPersonalizedBudgetRequest request, CancellationToken cancellationToken)
        => await Handle(() => personalizedService.RejectBudgetAsync(projectId, request, User.GetEmail(), ScopedSupplierId, cancellationToken));

    [HttpPost("{projectId:guid}/elaboracao/avancar")]
    public async Task<ActionResult<PersonalizedProjectDto>> AdvanceModeling(Guid projectId, CancellationToken cancellationToken)
        => await Handle(() => personalizedService.AdvanceModelingAsync(projectId, User.GetEmail(), ScopedSupplierId, cancellationToken));

    [HttpPost("{projectId:guid}/aprovacao/aprovar")]
    public async Task<ActionResult<PersonalizedProjectDto>> ApproveProject(Guid projectId, CancellationToken cancellationToken)
        => await Handle(() => personalizedService.ApproveProjectAsync(projectId, User.GetEmail(), ScopedSupplierId, cancellationToken));

    [HttpPut("{projectId:guid}/impressao/produto")]
    public async Task<ActionResult<PersonalizedProjectDto>> ConfigurePrintProduct(Guid projectId, [FromBody] PersonalizedPrintProductRequest request, CancellationToken cancellationToken)
        => await Handle(() => personalizedService.ConfigurePrintProductAsync(projectId, request, User.GetEmail(), ScopedSupplierId, cancellationToken));

    [HttpPost("{projectId:guid}/impressao/finalizar")]
    public async Task<ActionResult<PersonalizedProjectDto>> CompletePrinting(Guid projectId, [FromBody] CompletePersonalizedPrintingRequest request, CancellationToken cancellationToken)
        => await Handle(() => personalizedService.CompletePrintingAsync(projectId, request, User.GetEmail(), ScopedSupplierId, cancellationToken));

    [HttpPost("{projectId:guid}/acabamento/finalizar")]
    public async Task<ActionResult<PersonalizedProjectDto>> CompleteFinishing(Guid projectId, [FromBody] CompletePersonalizedFinishingRequest request, CancellationToken cancellationToken)
        => await Handle(() => personalizedService.CompleteFinishingAsync(projectId, request, User.GetEmail(), ScopedSupplierId, cancellationToken));

    [HttpPost("{projectId:guid}/finalizar")]
    public async Task<ActionResult<PersonalizedProjectDto>> Finalize(Guid projectId, [FromBody] FinalizePersonalizedProjectRequest request, CancellationToken cancellationToken)
        => await Handle(() => personalizedService.FinalizeProjectAsync(projectId, request, User.GetEmail(), ScopedSupplierId, cancellationToken));

    private async Task<ActionResult<PersonalizedProjectDto>> Handle(Func<Task<PersonalizedProjectDto?>> action)
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
}
