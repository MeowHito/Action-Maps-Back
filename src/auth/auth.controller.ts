import { Body, Controller, Param, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
