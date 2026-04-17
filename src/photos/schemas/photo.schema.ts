import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PhotoDocument = HydratedDocument<PhotoEntity>;

@Schema({ collection: 'photos', timestamps: true })
export class PhotoEntity {
  @Prop({
    type: Types.ObjectId,
    ref: 'EventEntity',
    required: true,
    index: true,
  })
  eventId: Types.ObjectId;

  @Prop({ required: true })
  lat: number;

  @Prop({ required: true })
  lng: number;

  @Prop({ required: true })
  storageKey: string;

  @Prop({ required: true })
  url: string;

  @Prop({ default: 0 })
  width?: number;

  @Prop({ default: 0 })
  height?: number;

  @Prop({ default: 0 })
  size: number;

  @Prop({ default: null })
  takenAt?: Date;

  @Prop({ default: null })
  uploader?: string;
}

export const PhotoSchema = SchemaFactory.createForClass(PhotoEntity);
PhotoSchema.index({ eventId: 1, createdAt: -1 });
PhotoSchema.index({ eventId: 1, lat: 1, lng: 1 });
