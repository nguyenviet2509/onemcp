import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import { Readable } from 'stream';
import { Repository } from 'typeorm';
import { Artifact } from '../artifacts/entities/artifact.entity';
import { RequestUser } from '../common/user-request';
import { MinioService } from '../storage/minio.service';
import { Attachment } from './entities/attachment.entity';

// Content-Type whitelist theo spec P3.
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'text/markdown',
  'text/plain',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const REVIEWER_ROLES = ['maintainer', 'dept-admin', 'super-admin'];

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment) private readonly attachments: Repository<Attachment>,
    @InjectRepository(Artifact) private readonly artifacts: Repository<Artifact>,
    private readonly minio: MinioService,
  ) {}

  private isReviewer(user: RequestUser): boolean {
    return user.roles.some((r) => REVIEWER_ROLES.includes(r));
  }

  private async assertCanAccess(user: RequestUser, artifactId: string, requireWrite: boolean): Promise<Artifact> {
    const artifact = await this.artifacts.findOne({
      where: { id: artifactId, departmentId: user.departmentId },
    });
    if (!artifact) throw new NotFoundException('Artifact không tồn tại');
    const isOwner = artifact.ownerId === user.id;
    if (requireWrite) {
      // Owner + reviewer mới upload/delete được.
      if (!isOwner && !this.isReviewer(user)) throw new ForbiddenException('Không có quyền upload attachment');
    } else {
      // Read: viewer thấy published; owner/reviewer thấy mọi status.
      if (artifact.status !== 'published' && !isOwner && !this.isReviewer(user)) {
        throw new ForbiddenException('Không có quyền xem artifact này');
      }
    }
    return artifact;
  }

  async upload(
    user: RequestUser,
    artifactId: string,
    file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
  ): Promise<Attachment> {
    await this.assertCanAccess(user, artifactId, true);
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`Content-Type "${file.mimetype}" not allowed`);
    }
    // Multer size limit enforce ở module config, đây là fallback.
    if (file.size <= 0) throw new BadRequestException('Empty file');

    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
    const storageKey = `artifacts/${artifactId}/${randomUUID()}-${safeName}`;

    await this.minio.putObject(storageKey, file.buffer, file.mimetype);

    return this.attachments.save(
      this.attachments.create({
        artifactId,
        filename: file.originalname.slice(0, 255),
        contentType: file.mimetype,
        sizeBytes: String(file.size),
        checksumSha256: checksum,
        storageKey,
        uploadedBy: user.id,
      }),
    );
  }

  async listByArtifact(user: RequestUser, artifactId: string): Promise<Attachment[]> {
    await this.assertCanAccess(user, artifactId, false);
    return this.attachments.find({ where: { artifactId }, order: { uploadedAt: 'DESC' } });
  }

  async openStream(user: RequestUser, id: string): Promise<{ meta: Attachment; stream: Readable }> {
    const meta = await this.attachments.findOne({ where: { id } });
    if (!meta) throw new NotFoundException('Attachment không tồn tại');
    await this.assertCanAccess(user, meta.artifactId, false);
    const stream = await this.minio.getObjectStream(meta.storageKey);
    return { meta, stream };
  }

  async remove(user: RequestUser, id: string): Promise<void> {
    const meta = await this.attachments.findOne({ where: { id } });
    if (!meta) throw new NotFoundException('Attachment không tồn tại');
    await this.assertCanAccess(user, meta.artifactId, true);
    await this.minio.removeObject(meta.storageKey);
    await this.attachments.delete({ id });
  }
}
