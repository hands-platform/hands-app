import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FileVisibility, Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FilesService } from './files.service';

@Controller('files')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER, Role.PROVIDER, Role.ADMIN)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('presign')
  createPresignedUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      contentType: string;
      visibility: FileVisibility;
      purpose: 'provider-verification' | 'provider-gallery' | 'chat-attachment' | 'profile-image';
      providerVerificationId?: string;
    },
  ) {
    return this.files.createPresignedUpload(user, body);
  }

  @Post(':id/complete')
  completeUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') fileId: string,
    @Body() body: { sizeBytes?: number },
  ) {
    return this.files.completeUpload(user, fileId, body ?? {});
  }

  @Get(':id/read-url')
  createReadUrl(@CurrentUser() user: AuthenticatedUser, @Param('id') fileId: string) {
    return this.files.createReadUrl(user, fileId);
  }
}
