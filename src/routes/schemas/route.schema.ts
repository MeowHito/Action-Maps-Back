import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RouteDocument = HydratedDocument<RouteEntity>;

@Schema({ collection: 'routes', timestamps: true })
export class RouteEntity {
  @Prop({
    type: Types.ObjectId,
    ref: 'EventEntity',
    required: true,
    index: true,
  })
  eventId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '#3399ff' })
  color: string;

  @Prop({ required: true })
  storageKey: string;

  @Prop({ required: true })
  url: string;

  @Prop({ default: 0 })
  size: number;
}

export const RouteSchema = SchemaFactory.createForClass(RouteEntity);
RouteSchema.index({ eventId: 1, createdAt: 1 });
