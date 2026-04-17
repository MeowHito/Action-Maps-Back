import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RouteDocument, RouteEntity } from './schemas/route.schema';
import { CreateRouteDto } from './dto/create-route.dto';
import { StorageService } from '../common/storage/storage.service';
import { EventsService } from '../events/events.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class RoutesService {
  constructor(
    @InjectModel(RouteEntity.name)
    private readonly routeModel: Model<RouteDocument>,
    private readonly storage: StorageService,
    private readonly events: EventsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async listByEvent(slug: string) {
    const ev = await this.events.getBySlugLean(slug);
    return this.routeModel
      .find({ eventId: ev._id })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
  }

  async createFromUpload(
    slug: string,
    file: Express.Multer.File,
    dto: CreateRouteDto,
  ) {
    if (!file) throw new BadRequestException('gpx file is required');
    if (!file.originalname.toLowerCase().endsWith('.gpx')) {
      throw new BadRequestException('only .gpx files are allowed');
    }
    const ev = await this.events.getBySlug(slug);

    const stored = await this.storage.save(
      file.buffer,
      file.originalname,
      file.mimetype || 'application/gpx+xml',
      `events/${ev._id.toString()}/routes`,
    );

    const doc = await new this.routeModel({
      eventId: ev._id,
      name: dto.name || file.originalname,
      color: normalizeColor(dto.color) ?? '#3399ff',
      storageKey: stored.key,
      url: stored.url,
      size: stored.size,
    }).save();

    const payload = doc.toObject();
    this.realtime.emitToEvent(slug, 'route:created', payload);
    return payload;
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('invalid id');
    const doc = await this.routeModel.findByIdAndDelete(id);
    if (!doc) throw new NotFoundException('route not found');
    await this.storage.delete(doc.storageKey);

    const slug = await this.events.findSlugById(doc.eventId);
    if (slug) {
      this.realtime.emitToEvent(slug, 'route:deleted', { id: doc._id });
    }
    return { ok: true, id: doc._id };
  }
}

function normalizeColor(c?: string) {
  if (!c) return undefined;
  return c.startsWith('#') ? c : `#${c}`;
}
