import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { EventsService } from '../events/events.service';

export type EventRole = 'admin' | 'upload' | 'view';

export interface EventTokenPayload {
  slug: string;
  role: EventRole;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly eventsService: EventsService,
    private readonly jwtService: JwtService,
  ) {}

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  async verifyEventCode(
    slug: string,
    code: string,
  ): Promise<{ token: string; role: EventRole }> {
    const event = await this.eventsService.getBySlugWithCodes(slug);
    const hashed = this.hashCode(code);

    const hasAnyCodes = event.adminCode || event.uploadCode || event.viewCode;

    let role: EventRole | null = null;
    if (!hasAnyCodes) {
      role = 'admin';
    } else if (event.adminCode && hashed === event.adminCode) {
      role = 'admin';
    } else if (event.uploadCode && hashed === event.uploadCode) {
      role = 'upload';
    } else if (event.viewCode && hashed === event.viewCode) {
      role = 'view';
    }

    if (!role) throw new UnauthorizedException('Invalid access code');

    const token = this.jwtService.sign({ slug, role } satisfies EventTokenPayload);
    return { token, role };
  }

  issueEventToken(slug: string, role: EventRole): { token: string; role: EventRole } {
    const token = this.jwtService.sign({ slug, role } satisfies EventTokenPayload);
    return { token, role };
  }

  verifyToken(token: string): EventTokenPayload {
    try {
      return this.jwtService.verify<EventTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
