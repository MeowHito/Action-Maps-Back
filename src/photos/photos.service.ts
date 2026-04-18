import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import sharp from 'sharp';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { PhotoDocument, PhotoEntity } from './schemas/photo.schema';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { StorageService } from '../common/storage/storage.service';
import { EventsService } from '../events/events.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const MAX_DIM = 1600;
const JPEG_QUALITY = 82;

// Candidate CLI decoders for HEIC. First one that exists and succeeds wins.
// libheif 1.19+ on Ubuntu 24.04 installs heif-dec; the older apt package ships
// heif-convert. Both dynamically link to libheif.so.1 which, via ldconfig, will
// pick up /usr/local/lib/libheif.so.1 (the 1.19 build) that can handle iPhone
// HEIC with many auxiliary images.
const HEIC_DECODERS: string[] = (() => {
  const envPath = process.env.HEIC_DECODER_PATH;
  if (envPath) return [envPath];
  return [
    '/usr/local/bin/heif-dec',
    '/usr/bin/heif-dec',
    '/usr/local/bin/heif-convert',
    '/usr/bin/heif-convert',
  ];
})();

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);

  constructor(
    @InjectModel(PhotoEntity.name)
    private readonly photoModel: Model<PhotoDocument>,
    private readonly storage: StorageService,
    private readonly events: EventsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async listByEvent(slug: string, limit = 500, skip = 0) {
    const ev = await this.events.getBySlugLean(slug);
    return this.photoModel
      .find({ eventId: ev._id })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(Math.min(limit, 2000))
      .lean()
      .exec();
  }

  async createFromUpload(
    slug: string,
    file: Express.Multer.File,
    dto: CreatePhotoDto,
  ) {
    if (!file) throw new BadRequestException('photo file is required');
    const mt = (file.mimetype || '').toLowerCase();
    const nameLower = (file.originalname || '').toLowerCase();
    const looksLikeImage =
      mt.startsWith('image/') ||
      mt === 'application/octet-stream' ||
      /\.(jpe?g|png|webp|gif|hei[cf])$/i.test(nameLower);
    if (!looksLikeImage) {
      throw new BadRequestException('only image files are allowed');
    }
    const ev = await this.events.getBySlug(slug);

    const isHeic =
      /\.hei[cf]$/i.test(nameLower) ||
      mt === 'image/heic' ||
      mt === 'image/heif';

    // Server-side normalise: decode (HEIC included), auto-rotate, resize, JPEG
    let outBuffer = file.buffer;
    let outName = file.originalname;
    let outMime = file.mimetype || 'image/jpeg';
    let outWidth = dto.width ?? 0;
    let outHeight = dto.height ?? 0;

    // Sharp's bundled libheif cannot decode modern iPhone HEIC (HEVC with many
    // auxiliary images). Offload HEIC decode to the system `heif-convert` /
    // `heif-dec` CLI, which links to libheif 1.19+ (via /usr/local/lib/libheif.so.1).
    let sharpInput: Buffer = file.buffer;
    if (isHeic) {
      try {
        sharpInput = await this.decodeHeicBufferToJpeg(file.buffer);
      } catch (err) {
        throw new BadRequestException(
          `Cannot decode HEIC file "${file.originalname}". ` +
            `Make sure libheif 1.19+ and heif-convert are installed on the server. ` +
            `Error: ${(err as Error).message}`,
        );
      }
    }

    try {
      const pipeline = sharp(sharpInput, { failOn: 'none' }).rotate();
      const meta = await pipeline.metadata();
      const srcW = meta.width ?? 0;
      const srcH = meta.height ?? 0;
      const maxSide = Math.max(srcW, srcH);

      const processed = await pipeline
        .resize({
          width: maxSide > MAX_DIM ? (srcW >= srcH ? MAX_DIM : undefined) : undefined,
          height: maxSide > MAX_DIM ? (srcH > srcW ? MAX_DIM : undefined) : undefined,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });

      outBuffer = processed.data;
      outMime = 'image/jpeg';
      outName = file.originalname.replace(/\.(hei[cf]|png|webp|gif)$/i, '.jpg');
      if (!outName.toLowerCase().endsWith('.jpg')) outName += '.jpg';
      outWidth = processed.info.width;
      outHeight = processed.info.height;
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.warn(
        `sharp processing failed for ${file.originalname} (${mt}): ${msg}`,
      );
      // HEIC that sharp cannot decode is unusable (browsers can't render it).
      // Fail loudly instead of saving bytes that would show as empty frames.
      if (isHeic) {
        throw new BadRequestException(
          `Cannot decode HEIC file "${file.originalname}". ` +
            `Ensure sharp is installed with libheif support on the server. Error: ${msg}`,
        );
      }
      // Non-HEIC: keep original bytes (browser can still render JPEG/PNG/etc.).
    }

    const stored = await this.storage.save(
      outBuffer,
      outName,
      outMime,
      `events/${ev._id.toString()}/photos`,
    );

    const doc = await new this.photoModel({
      eventId: ev._id,
      lat: dto.lat,
      lng: dto.lng,
      width: outWidth,
      height: outHeight,
      ...(dto.takenAt ? { takenAt: new Date(dto.takenAt) } : {}),
      ...(dto.uploader ? { uploader: dto.uploader } : {}),
      storageKey: stored.key,
      url: stored.url,
      size: stored.size,
    }).save();

    const payload = doc.toObject();
    this.realtime.emitToEvent(slug, 'photo:created', payload);
    return payload;
  }

  /**
   * Decode a HEIC buffer to a JPEG buffer using the system heif-convert /
   * heif-dec CLI. The CLI dynamically links to libheif.so.1 which, via
   * ldconfig, resolves to /usr/local/lib/libheif.so.1 (built from 1.19+).
   */
  private async decodeHeicBufferToJpeg(heic: Buffer): Promise<Buffer> {
    const decoder = await this.findHeicDecoder();
    if (!decoder) {
      throw new Error(
        'No HEIC decoder found. Install libheif-examples or build libheif 1.19+ ' +
          '(expected one of: ' +
          HEIC_DECODERS.join(', ') +
          '). You can also set HEIC_DECODER_PATH.',
      );
    }
    const id = randomUUID();
    const inPath = join(tmpdir(), `${id}.heic`);
    const outPath = join(tmpdir(), `${id}.jpg`);
    try {
      await fs.writeFile(inPath, heic);
      await this.runHeicDecoder(decoder, inPath, outPath);
      return await fs.readFile(outPath);
    } finally {
      await fs.unlink(inPath).catch(() => undefined);
      await fs.unlink(outPath).catch(() => undefined);
    }
  }

  private async findHeicDecoder(): Promise<string | null> {
    for (const path of HEIC_DECODERS) {
      try {
        await fs.access(path, fs.constants.X_OK);
        return path;
      } catch {
        // try next
      }
    }
    return null;
  }

  private runHeicDecoder(
    decoder: string,
    inPath: string,
    outPath: string,
  ): Promise<void> {
    // Both heif-convert (libheif 1.x) and heif-dec (libheif 1.19+) share the
    // same positional args: <input> <output>. `-q 90` sets JPEG quality.
    const args = ['-q', '90', inPath, outPath];
    return new Promise((resolve, reject) => {
      const proc = spawn(decoder, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      proc.stderr.on('data', (d: Buffer) => {
        stderr += d.toString('utf8');
      });
      proc.on('error', (err) => {
        reject(new Error(`spawn ${decoder} failed: ${err.message}`));
      });
      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `${decoder} exited with code ${code}: ${stderr.trim().slice(0, 400)}`,
            ),
          );
        }
      });
    });
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('invalid id');
    const doc = await this.photoModel.findByIdAndDelete(id);
    if (!doc) throw new NotFoundException('photo not found');
    await this.storage.delete(doc.storageKey);

    const slug = await this.events.findSlugById(doc.eventId);
    if (slug) {
      this.realtime.emitToEvent(slug, 'photo:deleted', { id: doc._id });
    }
    return { ok: true, id: doc._id };
  }
}
