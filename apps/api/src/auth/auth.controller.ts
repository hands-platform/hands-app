import { Body, Controller, Post, Req } from '@nestjs/common';
import {
  AcceptAdminOperatorInvitationDto,
  AdminOperatorLoginDto,
  RefreshTokenDto,
  RequestOtpDto,
  SupabaseExchangeDto,
  VerifyOtpDto,
} from './auth.dto';
import { AuthService } from './auth.service';

type AdminLoginHttpRequest = {
  get(name: string): string | undefined;
  ip?: string;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('request-otp')
  requestOtp(@Body() body: RequestOtpDto) {
    return this.auth.requestOtp(body);
  }

  @Post('verify-otp')
  verifyOtp(@Body() body: VerifyOtpDto) {
    return this.auth.verifyOtp(body);
  }

  @Post('refresh')
  refresh(@Body() body: RefreshTokenDto) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  logout(@Body() body: RefreshTokenDto) {
    return this.auth.logout(body.refreshToken);
  }

  @Post('admin-operator-login')
  verifyAdminOperatorLogin(@Body() body: AdminOperatorLoginDto, @Req() request: AdminLoginHttpRequest) {
    return this.auth.verifyAdminOperatorLogin(body, {
      sourceIp: request.ip,
      userAgent: request.get('user-agent') ?? undefined,
    });
  }

  @Post('admin-operator-invitations/accept')
  acceptAdminOperatorInvitation(@Body() body: AcceptAdminOperatorInvitationDto) {
    return this.auth.acceptAdminOperatorInvitation(body);
  }

  @Post('supabase/exchange')
  exchangeSupabaseSession(@Body() body: SupabaseExchangeDto) {
    return this.auth.exchangeSupabaseSession(body);
  }
}
