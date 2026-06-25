import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventsService } from '../events/events.service';
import { decryptCode, sha256 } from '../events/event-code.crypto';

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

  /** Matches a submitted code against a stored value, supporting both the new
   *  reversible-encrypted format and legacy SHA-256 hashes. */
  private codeMatches(input: string, stored: string | null | undefined): boolean {
    if (!stored) return false;
    const decrypted = decryptCode(stored);
    if (decrypted !== null) return decrypted === input;
    return sha256(input) === stored; // legacy hashed code
  }

  async verifyEventCode(
    slug: string,
    code: string,
  ): Promise<{ token: string; role: EventRole }> {
    const event = await this.eventsService.getBySlugWithCodes(slug);

    const hasAnyCodes = event.adminCode || event.uploadCode || event.viewCode;

    let role: EventRole | null = null;
    if (!hasAnyCodes) {
      role = 'admin';
    } else if (this.codeMatches(code, event.adminCode)) {
      role = 'admin';
    } else if (this.codeMatches(code, event.uploadCode)) {
      role = 'upload';
    } else if (this.codeMatches(code, event.viewCode)) {
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
