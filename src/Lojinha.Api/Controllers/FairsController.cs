using System.Text;
using Lojinha.Api.Application.Abstractions;
using Lojinha.Api.Application.Features.Fairs;
using Lojinha.Api.Contracts.Fairs;
using Lojinha.Api.Contracts.Sales;
using Lojinha.Api.Entities;
using Lojinha.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lojinha.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Supplier")]
[Route("api/[controller]")]
public sealed class FairsController(
    IQueryHandler<GetFairsQuery, IReadOnlyList<FairDto>> getFairsHandler,
    IQueryHandler<GetFairByIdQuery, FairDto?> getFairByIdHandler,
    IQueryHandler<GetFairReportQuery, FairReportDto?> getFairReportHandler,
    ICommandHandler<CreateFairCommand, FairDto> createFairHandler,
    ICommandHandler<UpdateFairCommand, FairDto?> updateFairHandler,
    ICommandHandler<StartFairCommand, FairDto?> startFairHandler,
    ICommandHandler<FinalizeFairCommand, FairDto?> finalizeFairHandler,
    ICommandHandler<ReopenFairCommand, FairDto?> reopenFairHandler,
    ICommandHandler<CancelFairCommand, FairDto?> cancelFairHandler,
    ICommandHandler<DeleteFairCommand, bool> deleteFairHandler,
    ICommandHandler<RegisterFairSaleCommand, SaleDto> registerFairSaleHandler) : ControllerBase
{
    private Guid? ScopedSupplierId => User.IsInRole(UserRole.Supplier.ToString()) ? User.GetSupplierId() : null;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<FairDto>>> GetAll(CancellationToken cancellationToken)
        => Ok(await getFairsHandler.HandleAsync(new GetFairsQuery(ScopedSupplierId), cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<FairDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var fair = await getFairByIdHandler.HandleAsync(new GetFairByIdQuery(id), cancellationToken);
        return fair is null ? NotFound() : Ok(fair);
    }

    [HttpGet("{id:guid}/report")]
    public async Task<ActionResult<FairReportDto>> GetReport(Guid id, CancellationToken cancellationToken)
    {
        var report = await getFairReportHandler.HandleAsync(new GetFairReportQuery(id), cancellationToken);
        if (report is null)
        {
            return NotFound();
        }

        return Ok(report with
        {
            Sales = report.Sales
                .Select(sale => sale with { CanDelete = true })
                .ToList()
        });
    }

    [HttpGet("{id:guid}/report/export")]
    public async Task<IActionResult> ExportReport(Guid id, CancellationToken cancellationToken)
    {
        var report = await getFairReportHandler.HandleAsync(new GetFairReportQuery(id), cancellationToken);
        if (report is null)
        {
            return NotFound();
        }

        var builder = new StringBuilder();
        builder.AppendLine("Feira;Data;Local;Status;Receita Bruta;Receita Liquida;Caixinha;Taxa Total;Dividido Por;Percentual Loja;Taxa Loja;Taxa Fornecedores;Resultado");
        builder.AppendLine($"{report.FairName};{report.EventDateUtc:dd/MM/yyyy};{report.Location};{report.Status};{report.GrossRevenue};{report.NetRevenue};{report.PiggyBankAmount};{report.RegistrationFee};{report.RegistrationFeeSplitCount};{report.StoreFeePercentage};{report.StoreRegistrationFee};{report.SupplierRegistrationFee};{report.Result}");
        builder.AppendLine();
        builder.AppendLine("Produto;Quantidade;Preco Unitario;Total");
        foreach (var sale in report.Sales)
        {
            foreach (var item in sale.Items)
            {
                builder.AppendLine($"{item.ProductName};{item.Quantity};{item.UnitPrice};{item.TotalPrice}");
            }
        }

        return File(Encoding.UTF8.GetBytes(builder.ToString()), "text/csv", $"feira-{report.FairName.ToLowerInvariant().Replace(' ', '-')}.csv");
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<FairDto>> Create([FromBody] FairRequest request, CancellationToken cancellationToken)
    {
        var fair = await createFairHandler.HandleAsync(new CreateFairCommand(request, User.GetEmail()), cancellationToken);
        return CreatedAtAction(nameof(GetReport), new { id = fair.Id }, fair);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<FairDto>> Update(Guid id, [FromBody] FairRequest request, CancellationToken cancellationToken)
    {
        var fair = await updateFairHandler.HandleAsync(new UpdateFairCommand(id, request, User.GetEmail()), cancellationToken);
        return fair is null ? NotFound() : Ok(fair);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await deleteFairHandler.HandleAsync(new DeleteFairCommand(id, User.GetEmail()), cancellationToken);
        return deleted ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/finalize")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<FairDto>> Finalize(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var fair = await finalizeFairHandler.HandleAsync(new FinalizeFairCommand(id, User.GetEmail()), cancellationToken);
            return fair is null ? NotFound() : Ok(fair);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost("{id:guid}/start")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<FairDto>> Start(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var fair = await startFairHandler.HandleAsync(new StartFairCommand(id, User.GetEmail()), cancellationToken);
            return fair is null ? NotFound() : Ok(fair);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost("{id:guid}/reopen")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<FairDto>> Reopen(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var fair = await reopenFairHandler.HandleAsync(new ReopenFairCommand(id, User.GetEmail()), cancellationToken);
            return fair is null ? NotFound() : Ok(fair);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<FairDto>> Cancel(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var fair = await cancelFairHandler.HandleAsync(new CancelFairCommand(id, User.GetEmail()), cancellationToken);
            return fair is null ? NotFound() : Ok(fair);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPost("{id:guid}/sales")]
    public async Task<ActionResult<SaleDto>> RegisterSale(Guid id, [FromBody] CreateSaleRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var sale = await registerFairSaleHandler.HandleAsync(new RegisterFairSaleCommand(id, request, User.GetEmail()), cancellationToken);
            return Ok(sale);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }
}