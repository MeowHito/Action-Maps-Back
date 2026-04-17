import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EventDocument = HydratedDocument<EventEntity>;

@Schema({ collection: 'events', timestamps: true })
export class EventEntity {
  @Prop({ required: true, unique: true, index: true, trim: true })
  slug: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '' })
  description?: string;

  @Prop({ default: null })
  startsAt?: Date;

  @Prop({ default: null })
  endsAt?: Date;
}

export const EventSchema = SchemaFactory.createForClass(EventEntity);
