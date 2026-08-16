import type { AuthenticatedUser } from '../auth/auth.types';
import { EarningsController } from './earnings.controller';

type EarningsControllerWithWithdrawalRequests = EarningsController & {
  createWalletWithdrawalRequest: (
    user: AuthenticatedUser,
    body: {
      idempotencyKey: string;
      amount: number;
      bankAccountId?: string | null;
      requestNote?: string | null;
    },
  ) => Promise<unknown>;
  walletWithdrawalRequests: (user: AuthenticatedUser) => Promise<unknown>;
};

describe('EarningsController wallet withdrawal requests', () => {
  it('delegates partner wallet withdrawal creation to the earnings service', async () => {
    const earnings = {
      createProviderWalletWithdrawalRequestForProviderUser: vi.fn().mockResolvedValue({
        id: 'withdrawal-request-1',
      }),
    };
    const controller = new EarningsController(
      earnings as never,
    ) as EarningsControllerWithWithdrawalRequests;
    const user = { id: 'partner-user-1' } as AuthenticatedUser;

    await expect(
      controller.createWalletWithdrawalRequest(user, {
        idempotencyKey: 'withdrawal-request-1',
        amount: 500000,
        bankAccountId: 'bank-account-1',
        requestNote: 'manual payout',
      }),
    ).resolves.toEqual({ id: 'withdrawal-request-1' });

    expect(earnings.createProviderWalletWithdrawalRequestForProviderUser).toHaveBeenCalledWith(
      'partner-user-1',
      {
        idempotencyKey: 'withdrawal-request-1',
        amount: 500000,
        bankAccountId: 'bank-account-1',
        requestNote: 'manual payout',
      },
    );
  });

  it('delegates partner wallet withdrawal request history to the earnings service', async () => {
    const earnings = {
      listProviderWalletWithdrawalRequestsForProviderUser: vi.fn().mockResolvedValue([
        { id: 'withdrawal-request-1' },
      ]),
    };
    const controller = new EarningsController(
      earnings as never,
    ) as EarningsControllerWithWithdrawalRequests;
    const user = { id: 'partner-user-1' } as AuthenticatedUser;

    await expect(controller.walletWithdrawalRequests(user)).resolves.toEqual([
      { id: 'withdrawal-request-1' },
    ]);

    expect(earnings.listProviderWalletWithdrawalRequestsForProviderUser).toHaveBeenCalledWith(
      'partner-user-1',
    );
  });
});
