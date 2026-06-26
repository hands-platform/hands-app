import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard bearer token parsing', () => {
  it('rejects malformed bearer headers with extra token segments', async () => {
    const authTokens = {
      authenticateBearerToken: jest.fn(),
    };
    const request = { headers: { authorization: 'Bearer token extra' } };
    const guard = new JwtAuthGuard(authTokens as never);

    await expect(guard.canActivate(executionContextFor(request))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authTokens.authenticateBearerToken).not.toHaveBeenCalled();
  });

  it('rejects duplicate authorization headers instead of trusting the first value', async () => {
    const authTokens = {
      authenticateBearerToken: jest.fn(),
    };
    const request = { headers: { authorization: ['Bearer token-1', 'Bearer token-2'] } };
    const guard = new JwtAuthGuard(authTokens as never);

    await expect(guard.canActivate(executionContextFor(request))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authTokens.authenticateBearerToken).not.toHaveBeenCalled();
  });

  it('authenticates a single bearer token and attaches the user', async () => {
    const authenticatedUser = { id: 'user-1', roles: [] };
    const authTokens = {
      authenticateBearerToken: jest.fn().mockResolvedValue(authenticatedUser),
    };
    const request = { headers: { authorization: 'Bearer token-1' }, user: undefined };
    const guard = new JwtAuthGuard(authTokens as never);

    await expect(guard.canActivate(executionContextFor(request))).resolves.toBe(true);
    expect(authTokens.authenticateBearerToken).toHaveBeenCalledWith('token-1');
    expect(request.user).toBe(authenticatedUser);
  });
});

function executionContextFor(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}
