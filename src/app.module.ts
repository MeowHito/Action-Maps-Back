import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StorageModule } from './common/storage/storage.module';
import { EventsModule } from './events/events.module';
import { RoutesModule } from './routes/routes.module';
import { PhotosModule } from './photos/photos.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/route_tracker',
    ),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), process.env.LOCAL_UPLOAD_DIR ?? 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: { maxAge: '30d', index: false, fallthrough: true },
    }),
    StorageModule,
    RealtimeModule,
    EventsModule,
    RoutesModule,
    PhotosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
