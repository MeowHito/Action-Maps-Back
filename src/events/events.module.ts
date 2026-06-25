import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { EventEntity, EventSchema } from './schemas/event.schema';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { SiteAdminGuard } from '../auth/guards/site-admin.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EventEntity.name, schema: EventSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'gpx-action-secret-change-in-prod',
      signOptions: { expiresIn: '30d' },
    }),
  ],
  controllers: [EventsController],
  providers: [EventsService, SiteAdminGuard],
  exports: [EventsService, MongooseModule],
})
export class EventsModule {}
