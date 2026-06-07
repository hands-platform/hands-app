import { Transform } from 'class-transformer';
import { Allow, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { MAX_CHAT_MESSAGE_BODY_LENGTH } from './chat.policy';

export class CreateChatMessageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CHAT_MESSAGE_BODY_LENGTH)
  body!: string;

  @IsOptional()
  @Allow()
  attachments?: unknown;
}
