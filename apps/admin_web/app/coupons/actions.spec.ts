import { vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPostOrThrow } from '../../lib/admin-api';
import { createCoupon } from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('../../lib/admin-api', () => ({
  adminPostOrThrow: vi.fn(),
  isAdminApiAuthError: (error: unknown) =>
    error instanceof Error && error.message.startsWith('Admin Web session'),
}));

const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedRedirect = vi.mocked(redirect);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('coupon server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPostOrThrow.mockImplementation(async (_path, body) => ({
      id: `coupon-${String((body as { code?: string }).code ?? '').toLowerCase()}`,
    }));
  });

  it('splits bulk coupon codes and sends API-safe date strings', async () => {
    const formData = new FormData();
    formData.set('codes', ' welcome10 summer15,friend20\nvip30 ');
    formData.set('percent', '15');
    formData.set('startsAt', '2026-06-27T09:30');
    formData.set('endsAt', '2026-07-01T18:00');
    const startsAt = new Date('2026-06-27T09:30').toISOString();
    const endsAt = new Date('2026-07-01T18:00').toISOString();

    await createCoupon(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledTimes(4);
    expect(mockedAdminPostOrThrow.mock.calls.map(([, body]) => body)).toEqual([
      expect.objectContaining({ code: 'WELCOME10' }),
      expect.objectContaining({ code: 'SUMMER15' }),
      expect.objectContaining({ code: 'FRIEND20' }),
      expect.objectContaining({ code: 'VIP30' }),
    ]);
    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/coupons',
      expect.objectContaining({
        startsAt,
        endsAt,
      }),
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/coupons');
    expect(mockedRedirect).toHaveBeenCalledWith('/coupons?couponNotice=created&created=4&failed=0');
  });

  it('redirects to the admin auth notice when the admin token is expired', async () => {
    const formData = new FormData();
    formData.set('codes', 'WELCOME10');
    formData.set('percent', '10');
    mockedAdminPostOrThrow.mockRejectedValue(new Error('Admin Web session is required for Admin API access'));

    await createCoupon(formData);

    expect(mockedRevalidatePath).toHaveBeenCalledWith('/coupons');
    expect(mockedRedirect).toHaveBeenCalledWith('/coupons?couponNotice=admin-auth');
  });
});
