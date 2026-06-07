import { BadRequestException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_CHAT_MESSAGE_BODY_LENGTH } from './chat.policy';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async listMessages(chatRoomId: string, user: AuthenticatedUser) {
    await this.requireChatAccess(chatRoomId, user);
    return this.prisma.chatMessage.findMany({
      where: { chatRoomId },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: { sender: { select: { id: true, fullName: true, roles: true } } },
    });
  }

  async createMessage(
    chatRoomId: string,
    user: AuthenticatedUser,
    input: { body?: string; text?: string; attachments?: unknown },
  ) {
    await this.requireChatAccess(chatRoomId, user);
    const body = input.body ?? input.text;
    if (!body || body.trim().length === 0) {
      throw new BadRequestException('Message body is required');
    }
    const trimmedBody = body.trim();
    if (trimmedBody.length > MAX_CHAT_MESSAGE_BODY_LENGTH) {
      throw new BadRequestException(`Message body must be ${MAX_CHAT_MESSAGE_BODY_LENGTH} characters or fewer`);
    }

    return this.prisma.chatMessage.create({
      data: {
        chatRoomId,
        senderId: user.id,
        body: trimmedBody,
        attachments: input.attachments === undefined ? undefined : JSON.parse(JSON.stringify(input.attachments)),
      },
      include: { sender: { select: { id: true, fullName: true, roles: true } } },
    });
  }

  async canAccessChatRoom(chatRoomId: string, user: AuthenticatedUser) {
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { id: chatRoomId },
      select: {
        id: true,
        booking: {
          select: {
            customerProfileId: true,
            selectedProviderId: true,
          },
        },
      },
    });
    if (!chatRoom) {
      return false;
    }

    if (user.roles.includes(Role.ADMIN)) {
      return true;
    }

    if (user.roles.includes(Role.CUSTOMER)) {
      const customer = await this.prisma.customerProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (customer?.id === chatRoom.booking.customerProfileId) {
        return true;
      }
    }

    if (user.roles.includes(Role.PROVIDER)) {
      const provider = await this.prisma.providerProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (provider?.id === chatRoom.booking.selectedProviderId) {
        return true;
      }
    }

    return false;
  }

  private async requireChatAccess(chatRoomId: string, user: AuthenticatedUser) {
    const allowed = await this.canAccessChatRoom(chatRoomId, user);
    if (!allowed) {
      throw new BadRequestException('Chat room is not accessible for this user');
    }
  }
}

