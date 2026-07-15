import { Body, Controller, Post } from '@nestjs/common';
import {
  AdminOperatorLoginDto,
  RefreshTokenDto,
  RequestOtpDto,
  SupabaseExchangeDto,
  VerifyOtpDto,
} from './auth.dto';
import { AuthService } from './auth.service';

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
  verifyAdminOperatorLogin(@Body() body: AdminOperatorLoginDto) {
    return this.auth.verifyAdminOperatorLogin(body);
  }

  @Post('supabase/exchange')
  exchangeSupabaseSession(@Body() body: SupabaseExchangeDto) {
    return this.auth.exchangeSupabaseSession(body);
  }
}
