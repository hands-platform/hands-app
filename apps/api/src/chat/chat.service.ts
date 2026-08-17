import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  AdminOperatorPermissionCategory,
  FilePurpose,
  FileUploadStatus,
  FileVisibility,
  Role,
} from '@prisma/client';
import { adminOperatorHasRequiredCategory } from '../admin/admin-operator-category.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { chatNotificationRoutingData } from '../notifications/notification-push-payload';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  MAX_CHAT_ATTACHMENT_COUNT,
  MAX_CHAT_ATTACHMENTS_JSON_LENGTH,
  MAX_CHAT_MESSAGE_BODY_LENGTH,
} from './chat.policy';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications?: NotificationsService,
  ) {}

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
      throw new BadRequestException(
        `Message body must be ${MAX_CHAT_MESSAGE_BODY_LENGTH} characters or fewer`,
      );
    }
    const attachments = await this.resolveChatAttachments(user.id, input.attachments);

    const message = await this.prisma.chatMessage.create({
      data: {
        chatRoomId,
        senderId: user.id,
        body: trimmedBody,
        attachments,
      },
      include: { sender: { select: { id: true, fullName: true, roles: true } } },
    });
    try {
      await this.notifyChatMessageRecipients(chatRoomId, user.id, message.id);
    } catch (error) {
      await this.recordNotificationFailure(message.id, chatRoomId, null, error);
    }
    return message;
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
      return adminOperatorHasRequiredCategory(
        user.adminPermissionCategories ?? [],
        AdminOperatorPermissionCategory.BOOKINGS_DETAIL,
      );
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

  private async notifyChatMessageRecipients(
    chatRoomId: string,
    senderUserId: string,
    chatMessageId: string,
  ) {
    if (!this.notifications) {
      return;
    }

    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { id: chatRoomId },
      select: {
        bookingId: true,
        booking: {
          select: {
            customerProfile: { select: { userId: true } },
            selectedProvider: { select: { userId: true } },
          },
        },
      },
    });
    if (!chatRoom) {
      return;
    }

    const recipients = [
      { userId: chatRoom.booking.customerProfile.userId, targetRole: Role.CUSTOMER },
      { userId: chatRoom.booking.selectedProvider?.userId, targetRole: Role.PROVIDER },
    ].filter(
      (recipient): recipient is { userId: string; targetRole: Extract<Role, 'CUSTOMER' | 'PROVIDER'> } =>
        Boolean(recipient.userId) && recipient.userId !== senderUserId,
    );

    for (const recipient of recipients) {
      let lastError: unknown;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          await this.notifications.create({
            userId: recipient.userId,
            sourceKey: `chat-message:${chatMessageId}:${recipient.userId}`,
            targetRole: recipient.targetRole,
            type: 'chat.message.created',
            title: 'New chat message',
            body: 'A new message is available in your booking chat.',
            data: chatNotificationRoutingData({
              bookingId: chatRoom.bookingId,
              chatRoomId,
            }),
          });
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (lastError) {
        await this.recordNotificationFailure(chatMessageId, chatRoomId, recipient.userId, lastError);
      }
    }
  }

  private async recordNotificationFailure(
    chatMessageId: string,
    chatRoomId: string,
    recipientUserId: string | null,
    error: unknown,
  ) {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `Chat message ${chatMessageId} committed, but notification delivery registration failed: ${message}`,
      error instanceof Error ? error.stack : undefined,
    );
    const recipientKey = recipientUserId ?? 'unknown';
    try {
      await this.prisma.adminAuditLog.upsert({
        where: { eventId: `chat-message-notification-failed:${chatMessageId}:${recipientKey}` },
        update: {},
        create: {
          eventId: `chat-message-notification-failed:${chatMessageId}:${recipientKey}`,
          actorId: null,
          actorKey: 'chat-message-notification',
          actorType: 'SYSTEM',
          action: 'chat.message.notification_failed',
          area: 'BOOKING',
          objectId: chatMessageId,
          objectType: 'ChatMessage',
          outcome: 'FAILED',
          severity: 'REVIEW',
          source: 'chat_service',
          target: `chat_message:${chatMessageId}`,
          metadata: {
            chatMessageId,
            chatRoomId,
            recipientUserId,
            error: message.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 500),
          },
        },
      });
    } catch (auditError) {
      this.logger.error(
        `Could not record chat notification failure for ${chatMessageId}: ${
          auditError instanceof Error ? auditError.message : String(auditError)
        }`,
        auditError instanceof Error ? auditError.stack : undefined,
      );
    }
  }

  private async resolveChatAttachments(ownerUserId: string, attachments: unknown) {
    const fileIds = parseChatAttachmentIds(attachments);
    if (fileIds === undefined) {
      return undefined;
    }
    if (fileIds.length === 0) {
      return [];
    }

    const ownedFiles = await this.prisma.fileAsset.findMany({
      where: {
        id: { in: fileIds },
        ownerUserId,
        purpose: FilePurpose.CHAT_ATTACHMENT,
        uploadStatus: FileUploadStatus.UPLOADED,
        visibility: FileVisibility.PRIVATE,
      },
      select: { id: true },
    });
    const ownedFileIds = new Set(ownedFiles.map((file) => file.id));
    if (fileIds.some((fileId) => !ownedFileIds.has(fileId))) {
      throw new BadRequestException('Chat attachments must be uploaded private files owned by the sender');
    }

    return fileIds.map((id) => ({ id }));
  }
}

function parseChatAttachmentIds(attachments: unknown) {
  if (attachments === undefined) {
    return undefined;
  }

  const serialized = JSON.stringify(attachments);
  if (serialized.length > MAX_CHAT_ATTACHMENTS_JSON_LENGTH) {
    throw new BadRequestException('Chat attachment metadata is too large');
  }

  if (!Array.isArray(attachments)) {
    throw new BadRequestException('Chat attachments must be a list of uploaded file references');
  }
  if (attachments.length > MAX_CHAT_ATTACHMENT_COUNT) {
    throw new BadRequestException(`Chat messages support at most ${MAX_CHAT_ATTACHMENT_COUNT} attachments`);
  }

  const fileIds = attachments.map((attachment) => {
    if (
      !attachment ||
      typeof attachment !== 'object' ||
      Array.isArray(attachment) ||
      Object.keys(attachment).some((key) => key !== 'id')
    ) {
      throw new BadRequestException('Chat attachments may contain only a file id');
    }
    const id = 'id' in attachment && typeof attachment.id === 'string' ? attachment.id.trim() : '';
    if (!id || id.length > 128) {
      throw new BadRequestException('Chat attachment file ids must be between 1 and 128 characters');
    }
    return id;
  });

  if (new Set(fileIds).size !== fileIds.length) {
    throw new BadRequestException('Chat attachment file ids must be unique');
  }
  return fileIds;
}
