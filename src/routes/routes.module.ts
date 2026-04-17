import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RouteEntity, RouteSchema } from './schemas/route.schema';
import { RoutesService } from './routes.service';
import { RoutesController } from './routes.controller';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RouteEntity.name, schema: RouteSchema },
    ]),
    EventsModule,
  ],
  controllers: [RoutesController],
  providers: [RoutesService],
})
export class RoutesModule {}
