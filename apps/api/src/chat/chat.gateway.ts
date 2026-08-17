import { Optional } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Role } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { SocketAuthService } from '../auth/socket-auth.service';
import { SOCKET_ROOMS } from '../common/domain';
import { corsOriginFromEnv } from '../security/cors-origin';
import { RedisStateService } from '../redis/redis-state.service';
import { socketEventAllowed } from '../security/socket-rate-limit';
import { MAX_CHAT_MESSAGE_BODY_LENGTH } from './chat.policy';
import { ChatService } from './chat.service';

const MAX_SOCKET_RESOURCE_ID_LENGTH = 128;

@WebSocketGateway({ cors: { origin: corsOriginFromEnv(), credentials: true } })
export class ChatGateway implements OnGatewayConnection {
  constructor(
    private readonly socketAuth: SocketAuthService,
    private readonly chat: ChatService,
    @Optional() private readonly redisState?: RedisStateService,
  ) {}

  @WebSocketServer()
  server!: Server;

  async handleConnection(client: Socket) {
    try {
      const user = await this.socketAuth.authenticate(client);
      await client.join(SOCKET_ROOMS.user(user.id));
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('chat.join_room')
  async joinChatRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    const user = await this.socketAuth.requireCurrentUser(client);
    if (!(await socketEventAllowed(this.redisState, user.id, 'chat.join_room', 60))) {
      return { ok: false, error: 'CHAT_RATE_LIMITED' };
    }
    const chatRoomId = socketResourceId(payload, 'chatRoomId');
    if (!chatRoomId) {
      return { ok: false, error: 'CHAT_INVALID_PAYLOAD' };
    }
    const allowed = await this.chat.canAccessChatRoom(chatRoomId, user);
    if (!allowed) {
      if (user.roles.includes(Role.ADMIN)) {
        await this.socketAuth.recordAdminAuthorizationDenial(
          user,
          `chat_room:${chatRoomId}`,
          'CHAT_ROOM_FORBIDDEN',
        );
      }
      return { ok: false, error: 'CHAT_ROOM_FORBIDDEN' };
    }

    try {
      await client.join(SOCKET_ROOMS.chat(chatRoomId));
      return { ok: true };
    } catch {
      return { ok: false, error: 'CHAT_ROOM_JOIN_FAILED' };
    }
  }

  @SubscribeMessage('chat.message.create')
  async createMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ) {
    const user = await this.socketAuth.requireCurrentUser(client);
    if (!(await socketEventAllowed(this.redisState, user.id, 'chat.message.create', 30))) {
      return { ok: false, error: 'CHAT_RATE_LIMITED' };
    }
    const parsedPayload = chatMessagePayload(payload);
    if (!parsedPayload) {
      return { ok: false, error: 'CHAT_INVALID_PAYLOAD' };
    }
    try {
      const message = await this.chat.createMessage(parsedPayload.chatRoomId, user, {
        text: parsedPayload.text,
      });
      await this.emitMessageCreated(parsedPayload.chatRoomId, message);
      return { ok: true, message };
    } catch {
      return { ok: false, error: 'CHAT_MESSAGE_REJECTED' };
    }
  }

  async emitMessageCreated(chatRoomId: string, message: unknown) {
    const room = SOCKET_ROOMS.chat(chatRoomId);
    const clients = await this.server.in(room).fetchSockets();
    for (const client of clients) {
      const user = client.data.user;
      if (!user || !(await this.chat.canAccessChatRoom(chatRoomId, user))) {
        await client.leave(room);
      }
    }
    this.server.to(room).emit('chat.message.created', message);
  }
}

function socketResourceId(payload: unknown, key: string) {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as Record<string, unknown>)[key];
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= MAX_SOCKET_RESOURCE_ID_LENGTH
    ? normalized
    : null;
}

function chatMessagePayload(payload: unknown) {
  const chatRoomId = socketResourceId(payload, 'chatRoomId');
  if (!chatRoomId || !payload || typeof payload !== 'object') return null;
  const value = (payload as Record<string, unknown>).text;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text.length === 0 || text.length > MAX_CHAT_MESSAGE_BODY_LENGTH) return null;
  return { chatRoomId, text };
}
