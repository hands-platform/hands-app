import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SocketAuthService } from '../auth/socket-auth.service';
import { SOCKET_ROOMS } from '../common/domain';
import { corsOriginFromEnv } from '../security/cors-origin';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: corsOriginFromEnv(), credentials: true } })
export class ChatGateway implements OnGatewayConnection {
  constructor(
    private readonly socketAuth: SocketAuthService,
    private readonly chat: ChatService,
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
  async joinChatRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: { chatRoomId: string }) {
    const user = this.socketAuth.requireUser(client);
    const allowed = await this.chat.canAccessChatRoom(payload.chatRoomId, user);
    if (!allowed) {
      return { ok: false, error: 'CHAT_ROOM_FORBIDDEN' };
    }

    void client.join(SOCKET_ROOMS.chat(payload.chatRoomId));
    return { ok: true };
  }

  @SubscribeMessage('chat.message.create')
  async createMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatRoomId: string; text: string },
  ) {
    const user = this.socketAuth.requireUser(client);
    try {
      const message = await this.chat.createMessage(payload.chatRoomId, user, { text: payload.text });
      this.emitMessageCreated(payload.chatRoomId, message);
      return { ok: true, message };
    } catch {
      return { ok: false, error: 'CHAT_MESSAGE_REJECTED' };
    }
  }

  emitMessageCreated(chatRoomId: string, message: unknown) {
    this.server.to(SOCKET_ROOMS.chat(chatRoomId)).emit('chat.message.created', message);
  }
}
