import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

export const EVENT_ROOM = (slug: string) => `event:${slug}`;

export type RealtimeEvent =
  | 'photo:created'
  | 'photo:deleted'
  | 'route:created'
  | 'route:deleted'
  | 'event:updated';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  handleConnection(client: Socket) {
    this.logger.debug(`Socket connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { slug: string } | string,
  ) {
    const slug = typeof payload === 'string' ? payload : payload?.slug;
    if (!slug) return { ok: false, error: 'slug required' };
    client.join(EVENT_ROOM(slug));
    return { ok: true, room: EVENT_ROOM(slug) };
  }

  @SubscribeMessage('leave')
  onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { slug: string } | string,
  ) {
    const slug = typeof payload === 'string' ? payload : payload?.slug;
    if (!slug) return { ok: false, error: 'slug required' };
    client.leave(EVENT_ROOM(slug));
    return { ok: true };
  }

  /** Broadcast to everyone in the event room. */
  emitToEvent(slug: string, event: RealtimeEvent, data: unknown) {
    if (!this.server) return;
    this.server.to(EVENT_ROOM(slug)).emit(event, data);
  }
}
