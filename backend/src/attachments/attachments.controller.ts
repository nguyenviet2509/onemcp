import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../access/current-user.decorator';
import { RequestUser } from '../common/user-request';
import { AttachmentsService } from './attachments.service';

// Multer memory storage — file buffer đi thẳng vào MinIO putObject.
// Limit áp dụng dynamically qua ConfigService trong FileInterceptor factory dưới.
@Controller()
export class AttachmentsController {
  constructor(
    private readonly attachments: AttachmentsService,
    private readonly config: ConfigService,
  ) {}

  private maxBytes(): number {
    return this.config.get<number>('ATTACHMENT_MAX_MB', 100) * 1024 * 1024;
  }

  @Get('artifacts/:artifactId/attachments')
  list(@CurrentUser() user: RequestUser | undefined, @Param('artifactId') artifactId: string) {
    if (!user) throw new UnauthorizedException();
    return this.attachments.listByArtifact(user, artifactId);
  }

  @Post('artifacts/:artifactId/attachments')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(201)
  async upload(
    @CurrentUser() user: RequestUser | undefined,
    @Param('artifactId') artifactId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!user) throw new UnauthorizedException();
    if (!file) throw new BadRequestException('Missing file field');
    if (file.size > this.maxBytes()) {
      throw new BadRequestException(`File > ${this.config.get('ATTACHMENT_MAX_MB')}MB`);
    }
    return this.attachments.upload(user, artifactId, {
      originalname: file.originalname,
      mimetype: file.mimetype,
      buffer: file.buffer,
      size: file.size,
    });
  }

  @Get('attachments/:id/download')
  async download(
    @CurrentUser() user: RequestUser | undefined,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    if (!user) throw new UnauthorizedException();
    const { meta, stream } = await this.attachments.openStream(user, id);
    res.setHeader('Content-Type', meta.contentType);
    res.setHeader('Content-Length', meta.sizeBytes);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(meta.filename)}"`,
    );
    stream.pipe(res);
  }

  @Delete('attachments/:id')
  @HttpCode(204)
  async remove(@CurrentUser() user: RequestUser | undefined, @Param('id') id: string) {
    if (!user) throw new UnauthorizedException();
    await this.attachments.remove(user, id);
  }
}
