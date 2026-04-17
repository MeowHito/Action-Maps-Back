import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

export interface StoredFile {
  key: string;
  url: string;
  size: number;
  mimeType: string;
}

/**
 * Pluggable storage: "local" (disk, dev) or "s3" (AWS/MinIO/R2, production).
 * Keeps the rest of the app independent of the concrete provider.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private driver: 'local' | 's3' = 'local';
  private s3?: S3Client;
  private bucket?: string;
  private s3PublicUrl?: string;
  private localDir!: string;
  private publicBaseUrl!: string;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.driver =
      ((this.config.get<string>('STORAGE_DRIVER') ?? 'local') as
        | 'local'
        | 's3') || 'local';
    this.localDir = this.config.get<string>('LOCAL_UPLOAD_DIR') ?? 'uploads';
    this.publicBaseUrl =
      this.config.get<string>('PUBLIC_BASE_URL') ?? 'http://localhost:3001';

    if (this.driver === 's3') {
      this.bucket = this.config.get<string>('S3_BUCKET');
      this.s3PublicUrl = this.config.get<string>('S3_PUBLIC_URL');
      this.s3 = new S3Client({
        region: this.config.get<string>('S3_REGION') ?? 'ap-southeast-1',
        endpoint: this.config.get<string>('S3_ENDPOINT') || undefined,
        forcePathStyle:
          (this.config.get<string>('S3_FORCE_PATH_STYLE') ?? 'false') ===
          'true',
        credentials: {
          accessKeyId: this.config.get<string>('S3_ACCESS_KEY') ?? '',
          secretAccessKey: this.config.get<string>('S3_SECRET_KEY') ?? '',
        },
      });
      this.logger.log(`Storage driver: s3 (bucket=${this.bucket})`);
    } else {
      await fs.mkdir(this.localDir, { recursive: true });
      this.logger.log(`Storage driver: local (dir=${this.localDir})`);
    }
  }

  async save(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder: string,
  ): Promise<StoredFile> {
    const ext = (extname(originalName) || '').toLowerCase();
    const key = `${folder}/${Date.now()}_${randomUUID()}${ext}`;
    const size = buffer.length;

    if (this.driver === 's3' && this.s3 && this.bucket) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          CacheControl: 'public, max-age=2592000',
        }),
      );
      const base =
        this.s3PublicUrl ||
        `https://${this.bucket}.s3.${this.config.get('S3_REGION')}.amazonaws.com`;
      return { key, url: `${base.replace(/\/$/, '')}/${key}`, size, mimeType };
    }

    const full = join(this.localDir, key);
    await fs.mkdir(join(this.localDir, folder), { recursive: true });
    await fs.writeFile(full, buffer);
    return {
      key,
      url: `${this.publicBaseUrl.replace(/\/$/, '')}/uploads/${key}`,
      size,
      mimeType,
    };
  }

  async delete(key: string): Promise<void> {
    if (!key) return;
    try {
      if (this.driver === 's3' && this.s3 && this.bucket) {
        await this.s3.send(
          new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
        );
      } else {
        await fs.unlink(join(this.localDir, key)).catch(() => undefined);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to delete ${key}: ${(err as Error).message}`,
      );
    }
  }
}
