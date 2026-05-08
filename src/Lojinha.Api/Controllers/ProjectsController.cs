using Lojinha.Api.Contracts.Projects;
using Lojinha.Api.Contracts.Products;
using Lojinha.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lojinha.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public sealed class ProjectsController(IProjectService projectService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetProjects(CancellationToken cancellationToken)
    {
        var scopedSupplierId = User.FindFirst("supplier_id")?.Value;
        var supplierId = string.IsNullOrWhiteSpace(scopedSupplierId) ? (Guid?)null : Guid.Parse(scopedSupplierId);
        
        var projects = await projectService.GetProjectsAsync(supplierId, cancellationToken);
        return Ok(projects);
    }

    [HttpPost]
    public async Task<IActionResult> CreateProject(ProjectRequest request, CancellationToken cancellationToken)
    {
        var actor = User.FindFirst("sub")?.Value ?? "unknown";
        var scopedSupplierId = User.FindFirst("supplier_id")?.Value;
        var supplierId = string.IsNullOrWhiteSpace(scopedSupplierId) ? (Guid?)null : Guid.Parse(scopedSupplierId);
        
        var project = await projectService.CreateProjectAsync(request, actor, supplierId, cancellationToken);
        return CreatedAtAction(nameof(GetProjectById), new { id = project.Id }, project);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetProjectById(Guid id, CancellationToken cancellationToken)
    {
        var actor = User.FindFirst("sub")?.Value ?? "unknown";
        var scopedSupplierId = User.FindFirst("supplier_id")?.Value;
        var supplierId = string.IsNullOrWhiteSpace(scopedSupplierId) ? (Guid?)null : Guid.Parse(scopedSupplierId);
        
        var project = await projectService.GetProjectByIdAsync(id, actor, supplierId, cancellationToken);
        if (project is null)
            return NotFound();

        return Ok(project);
    }

    [HttpGet("{id}/product-draft")]
    public async Task<IActionResult> GetProductDraft(Guid id, CancellationToken cancellationToken)
    {
        var scopedSupplierId = User.FindFirst("supplier_id")?.Value;
        var supplierId = string.IsNullOrWhiteSpace(scopedSupplierId) ? (Guid?)null : Guid.Parse(scopedSupplierId);

        try
        {
            var draft = await projectService.GetProductDraftAsync(id, supplierId, cancellationToken);
            if (draft is null)
                return NotFound();

            return Ok(draft);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateProject(Guid id, ProjectRequest request, CancellationToken cancellationToken)
    {
        var actor = User.FindFirst("sub")?.Value ?? "unknown";
        var scopedSupplierId = User.FindFirst("supplier_id")?.Value;
        var supplierId = string.IsNullOrWhiteSpace(scopedSupplierId) ? (Guid?)null : Guid.Parse(scopedSupplierId);
        
        var project = await projectService.UpdateProjectAsync(id, request, actor, supplierId, cancellationToken);
        if (project is null)
            return NotFound();

        return Ok(project);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProject(Guid id, CancellationToken cancellationToken)
    {
        var actor = User.FindFirst("sub")?.Value ?? "unknown";
        var scopedSupplierId = User.FindFirst("supplier_id")?.Value;
        var supplierId = string.IsNullOrWhiteSpace(scopedSupplierId) ? (Guid?)null : Guid.Parse(scopedSupplierId);
        
        var deleted = await projectService.DeleteProjectAsync(id, actor, supplierId, cancellationToken);
        if (!deleted)
            return NotFound();

        return NoContent();
    }

    // Etapas (Mesas)
    [HttpPost("{projectId}/steps")]
    public async Task<IActionResult> AddStep(Guid projectId, ProjectStepRequest request, CancellationToken cancellationToken)
    {
        var actor = User.FindFirst("sub")?.Value ?? "unknown";
        var scopedSupplierId = User.FindFirst("supplier_id")?.Value;
        var supplierId = string.IsNullOrWhiteSpace(scopedSupplierId) ? (Guid?)null : Guid.Parse(scopedSupplierId);
        
        try
        {
            var step = await projectService.AddStepAsync(projectId, request, actor, supplierId, cancellationToken);
            return CreatedAtAction(nameof(GetProjectById), new { id = projectId }, step);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("{projectId}/steps/{stepId}")]
    public async Task<IActionResult> UpdateStep(Guid projectId, Guid stepId, ProjectStepRequest request, CancellationToken cancellationToken)
    {
        var actor = User.FindFirst("sub")?.Value ?? "unknown";
        var scopedSupplierId = User.FindFirst("supplier_id")?.Value;
        var supplierId = string.IsNullOrWhiteSpace(scopedSupplierId) ? (Guid?)null : Guid.Parse(scopedSupplierId);
        
        var step = await projectService.UpdateStepAsync(projectId, stepId, request, actor, supplierId, cancellationToken);
        if (step is null)
            return NotFound();

        return Ok(step);
    }

    [HttpDelete("{projectId}/steps/{stepId}")]
    public async Task<IActionResult> DeleteStep(Guid projectId, Guid stepId, CancellationToken cancellationToken)
    {
        var actor = User.FindFirst("sub")?.Value ?? "unknown";
        var scopedSupplierId = User.FindFirst("supplier_id")?.Value;
        var supplierId = string.IsNullOrWhiteSpace(scopedSupplierId) ? (Guid?)null : Guid.Parse(scopedSupplierId);
        
        var deleted = await projectService.DeleteStepAsync(projectId, stepId, actor, supplierId, cancellationToken);
        if (!deleted)
            return NotFound();

        return NoContent();
    }

    // Tentativas
    [HttpPost("{projectId}/steps/{stepId}/attempts")]
    public async Task<IActionResult> AddAttempt(Guid projectId, Guid stepId, ProjectStepAttemptRequest request, CancellationToken cancellationToken)
    {
        var actor = User.FindFirst("sub")?.Value ?? "unknown";
        var scopedSupplierId = User.FindFirst("supplier_id")?.Value;
        var supplierId = string.IsNullOrWhiteSpace(scopedSupplierId) ? (Guid?)null : Guid.Parse(scopedSupplierId);
        
        try
        {
            var attempt = await projectService.AddAttemptAsync(projectId, stepId, request, actor, supplierId, cancellationToken);
            return CreatedAtAction(nameof(GetProjectById), new { id = projectId }, attempt);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("{projectId}/steps/{stepId}/attempts/{attemptId}/complete")]
    public async Task<IActionResult> CompleteAttempt(Guid projectId, Guid stepId, Guid attemptId, ProjectStepAttemptCompleteRequest request, CancellationToken cancellationToken)
    {
        var actor = User.FindFirst("sub")?.Value ?? "unknown";
        var scopedSupplierId = User.FindFirst("supplier_id")?.Value;
        var supplierId = string.IsNullOrWhiteSpace(scopedSupplierId) ? (Guid?)null : Guid.Parse(scopedSupplierId);
        
        try
        {
            var attempt = await projectService.CompleteAttemptAsync(projectId, stepId, attemptId, request, actor, supplierId, cancellationToken);
            if (attempt is null)
                return NotFound();

            return Ok(attempt);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("{projectId}/steps/{stepId}/attempts/{attemptId}/fail")]
    public async Task<IActionResult> FailAttempt(Guid projectId, Guid stepId, Guid attemptId, ProjectStepAttemptFailRequest request, CancellationToken cancellationToken)
    {
        var actor = User.FindFirst("sub")?.Value ?? "unknown";
        var scopedSupplierId = User.FindFirst("supplier_id")?.Value;
        var supplierId = string.IsNullOrWhiteSpace(scopedSupplierId) ? (Guid?)null : Guid.Parse(scopedSupplierId);
        
        try
        {
            var attempt = await projectService.FailAttemptAsync(projectId, stepId, attemptId, request, actor, supplierId, cancellationToken);
            if (attempt is null)
                return NotFound();

            return Ok(attempt);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    // Conclusão de Projeto
    [HttpPut("{id}/conclude")]
    public async Task<IActionResult> ConcludeProject(Guid id, CancellationToken cancellationToken)
    {
        var actor = User.FindFirst("sub")?.Value ?? "unknown";
        var scopedSupplierId = User.FindFirst("supplier_id")?.Value;
        var supplierId = string.IsNullOrWhiteSpace(scopedSupplierId) ? (Guid?)null : Guid.Parse(scopedSupplierId);

        try
        {
            var project = await projectService.ConcludeProjectAsync(id, actor, supplierId, cancellationToken);
            if (project is null)
                return NotFound();

            return Ok(project);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("{id}/conclude-with-product")]
    public async Task<IActionResult> ConcludeWithProduct(Guid id, [FromBody] ProductRequest request, CancellationToken cancellationToken)
    {
        var actor = User.FindFirst("sub")?.Value ?? "unknown";
        var scopedSupplierId = User.FindFirst("supplier_id")?.Value;
        var supplierId = string.IsNullOrWhiteSpace(scopedSupplierId) ? (Guid?)null : Guid.Parse(scopedSupplierId);

        try
        {
            var project = await projectService.ConcludeProjectWithProductAsync(id, request, actor, supplierId, cancellationToken);
            if (project is null)
                return NotFound();

            return Ok(project);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("{id}/duplicate")]
    public async Task<IActionResult> DuplicateProject(Guid id, CancellationToken cancellationToken)
    {
        var actor = User.FindFirst("sub")?.Value ?? "unknown";
        var scopedSupplierId = User.FindFirst("supplier_id")?.Value;
        var supplierId = string.IsNullOrWhiteSpace(scopedSupplierId) ? (Guid?)null : Guid.Parse(scopedSupplierId);

        try
        {
            var project = await projectService.DuplicateProjectAsync(id, actor, supplierId, cancellationToken);
            if (project is null)
                return NotFound();

            return Ok(project);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("{id}/reopen")]
    public async Task<IActionResult> ReopenProject(Guid id, CancellationToken cancellationToken)
    {
        var actor = User.FindFirst("sub")?.Value ?? "unknown";
        var scopedSupplierId = User.FindFirst("supplier_id")?.Value;
        var supplierId = string.IsNullOrWhiteSpace(scopedSupplierId) ? (Guid?)null : Guid.Parse(scopedSupplierId);

        try
        {
            var project = await projectService.ReopenProjectAsync(id, actor, supplierId, cancellationToken);
            if (project is null)
                return NotFound();

            return Ok(project);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("{projectId}/steps/{stepId}/complete")]
    public async Task<IActionResult> CompleteStep(Guid projectId, Guid stepId, ProjectStepAttemptCompleteRequest request, CancellationToken cancellationToken)
    {
        var actor = User.FindFirst("sub")?.Value ?? "unknown";
        var scopedSupplierId = User.FindFirst("supplier_id")?.Value;
        var supplierId = string.IsNullOrWhiteSpace(scopedSupplierId) ? (Guid?)null : Guid.Parse(scopedSupplierId);

        try
        {
            var step = await projectService.CompleteStepAsync(projectId, stepId, request, actor, supplierId, cancellationToken);
            if (step is null)
                return NotFound();

            return Ok(step);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("{projectId}/steps/{stepId}/fail")]
    public async Task<IActionResult> FailStep(Guid projectId, Guid stepId, ProjectStepAttemptFailRequest request, CancellationToken cancellationToken)
    {
        var actor = User.FindFirst("sub")?.Value ?? "unknown";
        var scopedSupplierId = User.FindFirst("supplier_id")?.Value;
        var supplierId = string.IsNullOrWhiteSpace(scopedSupplierId) ? (Guid?)null : Guid.Parse(scopedSupplierId);

        try
        {
            var step = await projectService.FailStepAsync(projectId, stepId, request, actor, supplierId, cancellationToken);
            if (step is null)
                return NotFound();

            return Ok(step);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
