import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateChatMessageDto } from './chat.dto';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER, Role.PROVIDER, Role.ADMIN)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly gateway: ChatGateway,
  ) {}

  @Get('rooms/:id/messages')
  listMessages(@CurrentUser() user: AuthenticatedUser, @Param('id') chatRoomId: string) {
    return this.chat.listMessages(chatRoomId, user);
  }

  @Post('rooms/:id/messages')
  async createMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') chatRoomId: string,
    @Body() body: CreateChatMessageDto,
  ) {
    const message = await this.chat.createMessage(chatRoomId, user, body);
    await this.gateway.emitMessageCreated(chatRoomId, message);
    return message;
  }
}

