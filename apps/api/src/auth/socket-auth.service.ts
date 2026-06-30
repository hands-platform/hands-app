import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Socket } from 'socket.io';
import { AuthenticatedUser } from './auth.types';
import { AuthTokenService } from './auth-token.service';

export type AuthenticatedSocket = Socket & {
  data: {
    user?: AuthenticatedUser;
  };
};

@Injectable()
export class SocketAuthService {
  constructor(private readonly authTokens: AuthTokenService) {}

  async authenticate(client: Socket): Promise<AuthenticatedUser> {
    const token = extractSocketToken(client);
    if (!token) {
      throw new UnauthorizedException('Socket bearer token is required');
    }

    const user = await this.authTokens.authenticateSocketToken(token);
    (client as AuthenticatedSocket).data.user = user;
    return user;
  }

  requireUser(client: Socket): AuthenticatedUser {
    const user = (client as AuthenticatedSocket).data.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated socket user is required');
    }
    return user;
  }
}

function extractSocketToken(client: Socket) {
  const authToken = client.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.length > 0) {
    return stripBearer(authToken);
  }

  const header = client.handshake.headers.authorization;
  if (typeof header === 'string') {
    return stripBearer(header);
  }

  return undefined;
}

function stripBearer(value: string) {
  const [scheme, token] = value.split(' ');
  return scheme === 'Bearer' ? token : value;
}
