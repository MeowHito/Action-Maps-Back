import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { EventsService } from '../events/events.service';
import { SiteAdminGuard } from './guards/site-admin.guard';
import type { SiteAuthedRequest } from './guards/site-admin.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly eventsService: EventsService,
  ) {}

  /** Logged-in owner/super-admin gets an admin event token without the code,
   *  so they can open and manage their own event's map. */
  @Post('event/:slug/owner-token')
  @UseGuards(SiteAdminGuard)
  async ownerToken(
    @Param('slug') slug: string,
    @Req() req: SiteAuthedRequest,
  ) {
    await this.eventsService.assertCanManage(slug, req.siteUser);
    return this.authService.issueEventToken(slug, 'admin');
  }

  @Post('event/:slug/token')
  verifyCode(
    @Param('slug') slug: string,
    @Body('code') code: string,
  ) {
    return this.authService.verifyEventCode(slug, code);
  }

  @Post('event/:slug/site-admin-token')
  siteAdminToken(
    @Param('slug') slug: string,
    @Body('secret') secret: string,
  ) {
    const expected = process.env.SITE_ADMIN_SECRET ?? '';
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid site admin secret');
    }
    return this.authService.issueEventToken(slug, 'admin');
  }
}
