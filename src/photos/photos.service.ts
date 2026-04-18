import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import sharp from 'sharp';
import { PhotoDocument, PhotoEntity } from './schemas/photo.schema';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { StorageService } from '../common/storage/storage.service';
import { EventsService } from '../events/events.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const MAX_DIM = 1600;
const JPEG_QUALITY = 82;

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

    try {
      const pipeline = sharp(file.buffer, { failOn: 'none' }).rotate();
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
