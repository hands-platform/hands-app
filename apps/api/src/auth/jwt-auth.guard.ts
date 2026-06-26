import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from './auth.types';
import { AuthTokenService } from './auth-token.service';

type RequestWithHeadersAndUser = {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authTokens: AuthTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithHeadersAndUser>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Bearer token is required');
    }

    request.user = await this.authTokens.authenticateBearerToken(token);
    return true;
  }
}

function extractBearerToken(header: string | string[] | undefined) {
  const value = Array.isArray(header) ? (header.length === 1 ? header[0] : undefined) : header;
  if (!value) {
    return undefined;
  }

  const parts = value.trim().split(/\s+/);
  if (parts.length !== 2) {
    return undefined;
  }

  const [scheme, token] = parts;
  return scheme === 'Bearer' ? token : undefined;
}
