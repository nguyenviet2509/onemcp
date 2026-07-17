import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { Readable } from 'stream';

// Wrapper mỏng quanh minio client. Bucket được ensure ở boot (idempotent).
@Injectable()
export class MinioService implements OnModuleInit {
  private readonly log = new Logger(MinioService.name);
  private client!: MinioClient;
  private bucket!: string;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const endpoint = new URL(this.config.get<string>('MINIO_ENDPOINT', 'http://minio:9000'));
    this.bucket = this.config.get<string>('MINIO_BUCKET', 'onemcp-artifacts');
    this.client = new MinioClient({
      endPoint: endpoint.hostname,
      port: Number(endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80)),
      useSSL: endpoint.protocol === 'https:',
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY', ''),
      secretKey: this.config.get<string>('MINIO_SECRET_KEY', ''),
    });

    const exists = await this.client.bucketExists(this.bucket).catch(() => false);
    if (!exists) {
      await this.client.makeBucket(this.bucket, 'us-east-1');
      this.log.log(`bucket "${this.bucket}" created`);
    } else {
      this.log.debug(`bucket "${this.bucket}" ready`);
    }
  }

  get bucketName(): string {
    return this.bucket;
  }

  async putObject(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': contentType,
    });
  }

  async getObjectStream(key: string): Promise<Readable> {
    return this.client.getObject(this.bucket, key);
  }

  async removeObject(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }
}
