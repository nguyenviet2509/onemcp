// Handler for MCP `submit_artifact` tool.
// Validates payload via Zod schema, resolves template_key + space slug,
// then delegates creation to ArtifactsService.

import { Logger } from '@nestjs/common';
import { ArtifactsService } from '../../artifacts/artifacts.service';
import { submitArtifactSchema } from '../../artifacts/dto/submit-artifact.dto';
import { AuthedRequest } from '../../common/user-request';
import { SpacesService } from '../../spaces/spaces.service';
import { TemplatesService } from '../../templates/templates.service';
import { McpToolResult } from '../mcp-jsonrpc.types';

const log = new Logger('submit_artifact');

export async function handleSubmitArtifactTool(
  args: Record<string, unknown>,
  req: AuthedRequest,
  artifacts: ArtifactsService,
  spacesService: SpacesService,
  templatesService: TemplatesService,
): Promise<McpToolResult> {
  const parsed = submitArtifactSchema.safeParse(args);
  if (!parsed.success) {
    return errorResult(
      `invalid payload: ${parsed.error.errors.map((e) => `${e.path.join('.')}:${e.message}`).join(', ')}`,
    );
  }

  const dto = parsed.data;

  // Phase 1C: validate template_key exists + active if provided.
  if (dto.template_key) {
    try {
      const tpl = await templatesService.getByKey(dto.template_key);
      if (!tpl.active) {
        return errorResult(`template_key "${dto.template_key}" không còn active`);
      }
    } catch {
      return errorResult(`template_key "${dto.template_key}" không tồn tại`);
    }
  }

  // Phase 1C: validate space slug + resolve space_id if provided.
  let resolvedSpaceId: string | undefined;
  if (dto.space) {
    try {
      const space = await spacesService.findBySlug(dto.space);
      // Access check: user dept must match space.department_id OR space is cross_dept/global.
      const userDeptId = String(req.user!.departmentId);
      const spaceDeptId = space.departmentId ? String(space.departmentId) : null;
      const hasAccess =
        spaceDeptId === null ||             // global space
        space.visibility === 'cross_dept' || // open to all depts
        spaceDeptId === userDeptId;          // user's own dept
      if (!hasAccess) {
        return errorResult(`Không có quyền submit vào space "${dto.space}" — dept mismatch`);
      }
      resolvedSpaceId = space.id;
    } catch {
      return errorResult(`space "${dto.space}" không tồn tại`);
    }
  }

  try {
    const { artifact, version } = await artifacts.create(req.user!, {
      ...dto,
      space_id: resolvedSpaceId,
    });
    log.log(
      `submit_artifact: artifact #${artifact.id} template_key=${dto.template_key ?? '-'} space=${dto.space ?? '-'} user=${req.user!.username}`,
    );
    return {
      content: [
        {
          type: 'text',
          text: `Submitted artifact #${artifact.id} "${artifact.title}" (v${version.versionNo}, status=pending). Maintainer sẽ review.`,
        },
      ],
    };
  } catch (e) {
    return errorResult((e as Error).message);
  }
}

function errorResult(msg: string): McpToolResult {
  return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
}
