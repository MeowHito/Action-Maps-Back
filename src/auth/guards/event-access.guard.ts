import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, EventRole } from '../auth.service';
import type { Request } from 'express';

export interface EventAccessConfig {
  roles: EventRole[];
  matchSlug: boolean;
}

export const EventAccess = (config: EventAccessConfig) =>
  SetMetadata('eventAccess', config);

@Injectable()
export class EventAccessGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const config = this.reflector.get<EventAccessConfig>(
      'eventAccess',
      context.getHandler(),
    );
    if (!config) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Access token required');
    }

    const token = authHeader.slice(7);
    const payload = this.authService.verifyToken(token);

    if (!config.roles.includes(payload.role)) {
      throw new ForbiddenException('Insufficient permission for this action');
    }

    if (config.matchSlug) {
      const urlSlug = (req.params as Record<string, string>).slug;
      if (payload.slug !== urlSlug) {
        throw new ForbiddenException('Token is not valid for this event');
      }
    }

    (req as Request & { eventToken: typeof payload }).eventToken = payload;
    return true;
  }
}
