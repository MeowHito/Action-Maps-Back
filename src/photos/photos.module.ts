import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PhotoEntity, PhotoSchema } from './schemas/photo.schema';
import { PhotosService } from './photos.service';
import { PhotosController } from './photos.controller';
import { EventsModule } from '../events/events.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PhotoEntity.name, schema: PhotoSchema },
    ]),
    EventsModule,
    AuthModule,
  ],
  controllers: [PhotosController],
  providers: [PhotosService],
})
export class PhotosModule {}
