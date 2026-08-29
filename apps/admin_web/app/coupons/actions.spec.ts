import { vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  adminDeleteOrThrow,
  adminGetResult,
  adminPostOrThrow,
} from '../../lib/admin-api';
import {
  activateCoupon,
  createCoupon,
  deleteCoupon,
  pauseCoupon,
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

  it('rejects create before the Admin API when the launch gate is off', async () => {
    vi.stubEnv('COUPON_LAUNCH_ENABLED', 'false');
    try {
      const state = await createCoupon(INITIAL_COUPON_CREATE_STATE, new FormData());

      expect(state.message).toContain('not active for the current launch');
      expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
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

  it('rejects an equal ICT start and end before creating coupons', async () => {
    const formData = new FormData();
    formData.set('codes', 'WELCOME10');
    formData.set('percent', '10');
    formData.set('startsAt', '2026-06-27T09:30');
    formData.set('endsAt', '2026-06-27T09:30');

    await expect(createCoupon(INITIAL_COUPON_CREATE_STATE, formData)).resolves.toMatchObject({
      message: expect.stringContaining('must be before'),
      status: 'error',
    });
    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
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

  it('blocks expired activation before sending a state request', async () => {
    const formData = new FormData();
    formData.set('couponId', 'coupon-1');
    formData.set('reason', 'Approved campaign relaunch');
    formData.set('returnTo', '/coupons?view=records&couponPage=2');
    mockedAdminGetResult.mockResolvedValue({
      data: { active: false, code: 'OLD10', discount: { type: 'percent', value: 10 }, endsAt: '2020-01-01T00:00:00.000Z', id: 'coupon-1' },
      ok: true,
      status: 200,
    });

    await activateCoupon(formData);

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/coupons?couponPage=2&view=records&couponNotice=activate-expired',
    );
  });

  it('uses explicit activate and pause endpoints with trimmed reasons', async () => {
    mockedAdminGetResult.mockResolvedValue({
      data: { active: false, code: 'BACK20', discount: { type: 'percent', value: 20 }, id: 'coupon-1' },
      ok: true,
      status: 200,
    });
    mockedAdminPostOrThrow.mockResolvedValue({ active: true, id: 'coupon-1' });
    const activateData = new FormData();
    activateData.set('couponId', 'coupon-1');
    activateData.set('reason', '  Campaign owner approved  ');
    activateData.set('returnTo', '/coupons?couponPage=2&q=BACK');

    await activateCoupon(activateData);
    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith('/admin/coupons/coupon-1/activate', {
      reason: 'Campaign owner approved',
    });
    expect(mockedRedirect).toHaveBeenCalledWith('/coupons?couponPage=2&q=BACK&couponNotice=toggled');

    vi.clearAllMocks();
    mockedAdminPostOrThrow.mockResolvedValue({ active: false, id: 'coupon-1' });
    const pauseData = new FormData();
    pauseData.set('couponId', 'coupon-1');
    pauseData.set('reason', 'Campaign ended');
    await pauseCoupon(pauseData);
    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith('/admin/coupons/coupon-1/pause', {
      reason: 'Campaign ended',
    });
  });

  it('does not send a coupon state request without a non-blank reason', async () => {
    const formData = new FormData();
    formData.set('couponId', 'coupon-1');
    formData.set('reason', '   ');

    await pauseCoupon(formData);

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith('/coupons?couponNotice=state-reason-required');
  });

  it('explains that used coupons must be paused when deletion is blocked', async () => {
    const formData = new FormData();
    formData.set('couponId', 'coupon-1');
    mockedAdminDeleteOrThrow.mockRejectedValue({ status: 400 });

    await deleteCoupon(formData);

    expect(mockedRedirect).toHaveBeenCalledWith('/coupons?couponNotice=delete-used');
  });
});
