import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventDocument, EventEntity } from './schemas/event.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { encryptCode, decryptCode, isLegacyCode } from './event-code.crypto';
import type { SiteUser } from '../common/roles';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(EventEntity.name)
    private readonly eventModel: Model<EventDocument>,
  ) {}

  private buildCodeFields(dto: { adminCode?: string; uploadCode?: string; viewCode?: string }) {
    return {
      ...(dto.adminCode !== undefined ? { adminCode: dto.adminCode ? encryptCode(dto.adminCode) : null } : {}),
      ...(dto.uploadCode !== undefined ? { uploadCode: dto.uploadCode ? encryptCode(dto.uploadCode) : null } : {}),
      ...(dto.viewCode !== undefined ? { viewCode: dto.viewCode ? encryptCode(dto.viewCode) : null } : {}),
    };
  }

  async create(dto: CreateEventDto, ownerId?: string) {
    const exists = await this.eventModel.exists({ slug: dto.slug });
    if (exists) throw new ConflictException(`slug "${dto.slug}" already exists`);
    const doc = new this.eventModel({
      slug: dto.slug,
      name: dto.name,
      description: dto.description,
      ...(ownerId ? { ownerId } : {}),
      ...(dto.startsAt ? { startsAt: new Date(dto.startsAt) } : {}),
      ...(dto.endsAt ? { endsAt: new Date(dto.endsAt) } : {}),
      ...this.buildCodeFields(dto),
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

  /** Events the given site user may manage: super-admin sees all, a normal user
   *  sees only the events they own. */
  async listForUser(user: SiteUser, limit = 200, skip = 0) {
    const filter = user.role === 'super' ? {} : { ownerId: user.sub };
    return this.eventModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Math.min(limit, 500))
      .lean()
      .exec();
  }

  /** Throws unless `user` is the super-admin or the owner of `slug`. Returns the
   *  event (with code fields) so callers can avoid a second query. */
  async assertCanManage(slug: string, user: SiteUser) {
    const ev = await this.eventModel
      .findOne({ slug })
      .select('+adminCode +uploadCode +viewCode')
      .exec();
    if (!ev) throw new NotFoundException(`event "${slug}" not found`);
    const owns = ev.ownerId && String(ev.ownerId) === user.sub;
    if (user.role !== 'super' && !owns) {
      throw new ForbiddenException('You do not have access to this event');
    }
    return ev;
  }

  /** Decrypted access codes for management UIs. Legacy (hashed) codes cannot be
   *  shown, so they are flagged so the UI can prompt the owner to reset them. */
  async getCodesForManage(slug: string) {
    const ev = await this.eventModel
      .findOne({ slug })
      .select('+adminCode +uploadCode +viewCode')
      .lean()
      .exec();
    if (!ev) throw new NotFoundException(`event "${slug}" not found`);
    const field = (stored: string | null | undefined) => ({
      value: decryptCode(stored) ?? '',
      set: !!stored,
      legacy: isLegacyCode(stored),
    });
    return {
      adminCode: field(ev.adminCode),
      uploadCode: field(ev.uploadCode),
      viewCode: field(ev.viewCode),
    };
  }

  /** Update only the three access codes. Empty string clears a code. */
  async updateCodes(
    slug: string,
    codes: { adminCode?: string; uploadCode?: string; viewCode?: string },
  ) {
    const ev = await this.eventModel.findOneAndUpdate(
      { slug },
      this.buildCodeFields(codes),
      { new: true },
    );
    if (!ev) throw new NotFoundException(`event "${slug}" not found`);
    return { ok: true };
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
    const { adminCode, uploadCode, viewCode, ...rest } = dto;
    const ev = await this.eventModel.findOneAndUpdate(
      { slug },
      {
        ...rest,
        ...(rest.startsAt ? { startsAt: new Date(rest.startsAt) } : {}),
        ...(rest.endsAt ? { endsAt: new Date(rest.endsAt) } : {}),
        ...this.buildCodeFields({ adminCode, uploadCode, viewCode }),
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

  /** Fetch event including hashed code fields — for internal auth use only. */
  async getBySlugWithCodes(slug: string) {
    const ev = await this.eventModel
      .findOne({ slug })
      .select('+adminCode +uploadCode +viewCode')
      .lean()
      .exec();
    if (!ev) throw new NotFoundException(`event "${slug}" not found`);
    return ev;
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
