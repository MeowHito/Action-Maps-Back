import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventDocument, EventEntity } from './schemas/event.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(EventEntity.name)
    private readonly eventModel: Model<EventDocument>,
  ) {}

  async create(dto: CreateEventDto) {
    const exists = await this.eventModel.exists({ slug: dto.slug });
    if (exists) throw new ConflictException(`slug "${dto.slug}" already exists`);
    const doc = new this.eventModel({
      slug: dto.slug,
      name: dto.name,
      description: dto.description,
      ...(dto.startsAt ? { startsAt: new Date(dto.startsAt) } : {}),
      ...(dto.endsAt ? { endsAt: new Date(dto.endsAt) } : {}),
    });
    return doc.save();
  }

  async list(limit = 50, skip = 0) {
    return this.eventModel
      .find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Math.min(limit, 200))
      .lean()
      .exec();
  }

  async getBySlug(slug: string): Promise<EventDocument> {
    const ev = await this.eventModel.findOne({ slug }).exec();
    if (!ev) throw new NotFoundException(`event "${slug}" not found`);
    return ev;
  }

  async getBySlugLean(slug: string) {
    const ev = await this.eventModel.findOne({ slug }).lean().exec();
    if (!ev) throw new NotFoundException(`event "${slug}" not found`);
    return ev;
  }

  async update(slug: string, dto: UpdateEventDto) {
    const ev = await this.eventModel.findOneAndUpdate(
      { slug },
      {
        ...dto,
        ...(dto.startsAt ? { startsAt: new Date(dto.startsAt) } : {}),
        ...(dto.endsAt ? { endsAt: new Date(dto.endsAt) } : {}),
      },
      { new: true },
    );
    if (!ev) throw new NotFoundException(`event "${slug}" not found`);
    return ev;
  }

  async remove(slug: string) {
    const ev = await this.eventModel.findOneAndDelete({ slug });
    if (!ev) throw new NotFoundException(`event "${slug}" not found`);
    return { ok: true, id: ev._id };
  }

  /** Look up slug by _id (used when emitting realtime events after delete). */
  async findSlugById(id: unknown): Promise<string | null> {
    const ev = await this.eventModel
      .findById(id as any)
      .select({ slug: 1 })
      .lean()
      .exec();
    return ev?.slug ?? null;
  }
}
