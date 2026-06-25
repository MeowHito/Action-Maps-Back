import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EventDocument = HydratedDocument<EventEntity>;

@Schema({ collection: 'events', timestamps: true })
export class EventEntity {
  @Prop({ required: true, unique: true, index: true, trim: true })
  slug: string;

  /** User who created (owns) this event. Null for legacy events created before
   *  ownership existed — those are manageable only by the super-admin. */
  @Prop({ type: Types.ObjectId, ref: 'UserEntity', default: null, index: true })
  ownerId?: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '' })
  description?: string;

  @Prop({ default: null })
  startsAt?: Date;

  @Prop({ default: null })
  endsAt?: Date;

  @Prop({ default: null, select: false })
  adminCode?: string;

  @Prop({ default: null, select: false })
  uploadCode?: string;

  @Prop({ default: null, select: false })
  viewCode?: string;
}

export const EventSchema = SchemaFactory.createForClass(EventEntity);
