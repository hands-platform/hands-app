import { Transform } from 'class-transformer';
import { Allow, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateChatMessageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  @Allow()
  attachments?: unknown;
}
