import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsModule } from '../events/events.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { EventAccessGuard } from './guards/event-access.guard';
import { SiteAdminGuard } from './guards/site-admin.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'gpx-action-secret-change-in-prod',
      signOptions: { expiresIn: '30d' },
    }),
    EventsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, EventAccessGuard, SiteAdminGuard],
  exports: [AuthService, EventAccessGuard, SiteAdminGuard, JwtModule],
})
export class AuthModule {}
