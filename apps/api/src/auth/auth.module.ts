import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OtpDeliveryService } from './otp-delivery.service';
import { RolesGuard } from './roles.guard';
import { SocketAuthService } from './socket-auth.service';
import { SupabaseAdminService } from './supabase-admin.service';
import { jwtAccessSecretFromEnv } from './jwt-secrets';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: jwtAccessSecretFromEnv(),
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokenService,
    OtpDeliveryService,
    JwtAuthGuard,
    RolesGuard,
    SocketAuthService,
    SupabaseAdminService,
  ],
  exports: [
    AuthService,
    AuthTokenService,
    OtpDeliveryService,
    JwtModule,
    JwtAuthGuard,
    RolesGuard,
    SocketAuthService,
    SupabaseAdminService,
  ],
})
export class AuthModule {}
