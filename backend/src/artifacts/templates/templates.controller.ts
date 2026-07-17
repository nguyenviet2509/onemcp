import { Controller, Get, NotFoundException, Param, UnauthorizedException } from '@nestjs/common';
import { CurrentUser } from '../../access/current-user.decorator';
import { RequestUser } from '../../common/user-request';
import { ARTIFACT_TYPES, ArtifactType } from '../artifact-type.enum';
import { getTemplate, listTemplates } from './template-registry';

@Controller('artifact-templates')
export class TemplatesController {
  @Get()
  list(@CurrentUser() user: RequestUser | undefined) {
    if (!user) throw new UnauthorizedException();
    return listTemplates();
  }

  @Get(':type')
  get(@CurrentUser() user: RequestUser | undefined, @Param('type') type: string) {
    if (!user) throw new UnauthorizedException();
    if (!ARTIFACT_TYPES.includes(type as ArtifactType)) {
      throw new NotFoundException(`Template for type "${type}" not found`);
    }
    return getTemplate(type as ArtifactType);
  }
}
