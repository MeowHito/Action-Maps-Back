import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { roleFor, SiteUser } from '../../common/roles';

interface SiteAdminJwt {
  sub: string;
  username: string;
  email: string;
  type: string;
  role?: string;
}

export type SiteAuthedRequest = Request & { siteUser: SiteUser };

/**
 * Protects management endpoints: requires a valid logged-in user token (issued
 * by UsersService.validateLogin) and attaches `req.siteUser`. Depends only on
 * JwtService to avoid a circular dependency with AuthService/EventsService.
 */
@Injectable()
export class SiteAdminGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Login required');
    }

    let payload: SiteAdminJwt;
    try {
      payload = this.jwtService.verify<SiteAdminJwt>(authHeader.slice(7));
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }

    if (payload.type !== 'site-admin') {
      throw new UnauthorizedException('Not a site session');
    }

    (req as SiteAuthedRequest).siteUser = {
      sub: payload.sub,
      username: payload.username,
      email: payload.email,
      // Trust the email for role (resilient to tokens signed before role existed).
      role: roleFor(payload.email),
    };
    return true;
  }
}
