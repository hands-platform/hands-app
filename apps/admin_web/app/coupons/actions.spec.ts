import { vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  adminDeleteOrThrow,
  adminGetResult,
  adminPatchOrThrow,
  adminPostOrThrow,
} from '../../lib/admin-api';
import {
  createCoupon,
  deleteCoupon,
  toggleCoupon,
} from './actions';
import { INITIAL_COUPON_CREATE_STATE } from './coupon-create-state';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../lib/admin-api', () => ({
  adminDeleteOrThrow: vi.fn(),
  adminGetResult: vi.fn(),
  adminPatchOrThrow: vi.fn(),
  adminPostOrThrow: vi.fn(),
  isAdminApiAuthError: (error: unknown) =>
    error instanceof Error && error.message.startsWith('Admin Web session'),
}));

const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedAdminDeleteOrThrow = vi.mocked(adminDeleteOrThrow);
const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedAdminPatchOrThrow = vi.mocked(adminPatchOrThrow);
const mockedRedirect = vi.mocked(redirect);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('coupon server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPostOrThrow.mockResolvedValue({
      createdCount: 4,
      failedCount: 0,
      results: ['WELCOME10', 'SUMMER15', 'FRIEND20', 'VIP30'].map((code) => ({ code, ok: true })),
    });
  });

  it('creates one bounded batch as paused with ICT-safe timestamps', async () => {
    const formData = new FormData();
    formData.set('codes', ' welcome10 summer15,friend20\nvip30 ');
    formData.set('description', 'Summer launch');
    formData.set('percent', '15');
    formData.set('startsAt', '2026-06-27T09:30');
    formData.set('endsAt', '2026-07-01T18:00');

    const state = await createCoupon(INITIAL_COUPON_CREATE_STATE, formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledTimes(1);
    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith('/admin/coupons/batch', {
      coupons: [
        expect.objectContaining({ code: 'WELCOME10' }),
        expect.objectContaining({ code: 'SUMMER15' }),
        expect.objectContaining({ code: 'FRIEND20' }),
        expect.objectContaining({ code: 'VIP30' }),
      ],
    });
    expect(mockedAdminPostOrThrow.mock.calls[0]?.[1]).toMatchObject({
      coupons: expect.arrayContaining([
        expect.objectContaining({
          active: false,
          description: 'Summer launch',
          endsAt: '2026-07-01T11:00:00.000Z',
          startsAt: '2026-06-27T02:30:00.000Z',
        }),
      ]),
    });
    expect(state).toMatchObject({ createdCount: 4, failedCount: 0, status: 'success' });
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/coupons');
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('returns field-safe errors without redirecting the drawer', async () => {
    const formData = new FormData();
    formData.set('codes', 'WELCOME10');
    formData.set('percent', '101');

    await expect(createCoupon(INITIAL_COUPON_CREATE_STATE, formData)).resolves.toMatchObject({
      status: 'error',
    });
    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('keeps an expired-session error inside the create drawer', async () => {
    const formData = new FormData();
    formData.set('codes', 'WELCOME10');
    formData.set('percent', '10');
    formData.set('noEndDate', 'on');
    mockedAdminPostOrThrow.mockRejectedValue(new Error('Admin Web session is required for Admin API access'));

    await expect(createCoupon(INITIAL_COUPON_CREATE_STATE, formData)).resolves.toMatchObject({
      message: expect.stringContaining('session expired'),
      status: 'error',
    });
  });

  it('blocks expired activation before sending a patch', async () => {
    const formData = new FormData();
    formData.set('couponId', 'coupon-1');
    formData.set('active', 'false');
    formData.set('returnTo', '/coupons?view=records&couponPage=2');
    mockedAdminGetResult.mockResolvedValue({
      data: { active: false, code: 'OLD10', discount: { type: 'percent', value: 10 }, endsAt: '2020-01-01T00:00:00.000Z', id: 'coupon-1' },
      ok: true,
      status: 200,
    });

    await toggleCoupon(formData);

    expect(mockedAdminPatchOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/coupons?couponPage=2&view=records&couponNotice=activate-expired',
    );
  });

  it('explains that used coupons must be paused when deletion is blocked', async () => {
    const formData = new FormData();
    formData.set('couponId', 'coupon-1');
    mockedAdminDeleteOrThrow.mockRejectedValue({ status: 400 });

    await deleteCoupon(formData);

    expect(mockedRedirect).toHaveBeenCalledWith('/coupons?couponNotice=delete-used');
  });
});
