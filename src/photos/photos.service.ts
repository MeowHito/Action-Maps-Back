import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PhotoDocument, PhotoEntity } from './schemas/photo.schema';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { StorageService } from '../common/storage/storage.service';
import { EventsService } from '../events/events.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class PhotosService {
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
    if (!(file.mimetype || '').startsWith('image/')) {
      throw new BadRequestException('only image files are allowed');
    }
    const ev = await this.events.getBySlug(slug);

    const stored = await this.storage.save(
      file.buffer,
      file.originalname,
      file.mimetype || 'image/jpeg',
      `events/${ev._id.toString()}/photos`,
    );

    const doc = await new this.photoModel({
      eventId: ev._id,
      lat: dto.lat,
      lng: dto.lng,
      width: dto.width ?? 0,
      height: dto.height ?? 0,
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
