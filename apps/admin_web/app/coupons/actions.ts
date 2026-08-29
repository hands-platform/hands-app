'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { AdminCoupon } from '../../lib/admin-api';
import {
  adminDeleteOrThrow,
  adminGetResult,
  adminPatchOrThrow,
  adminPostOrThrow,
  isAdminApiAuthError,
} from '../../lib/admin-api';
import { parseCouponCodeBatch } from './coupon-code-batch';
import type { CouponCreateActionState, CouponCreateResultItem } from './coupon-create-state';
import { couponIctWallTimeToIso } from './coupon-ict-time';
import { couponReturnWithNotice, sanitizeCouponReturnTo } from './coupon-return-context';
import { couponLaunchEnabled } from '../../lib/launch-features';

type CouponBatchResponse = {
  readonly createdCount: number;
  readonly failedCount: number;
  readonly results: readonly CouponCreateResultItem[];
};

export async function createCoupon(
  _previousState: CouponCreateActionState,
  formData: FormData,
): Promise<CouponCreateActionState> {
  if (!couponLaunchEnabled()) {
    return createActionError('Coupons are not active for the current launch.');
  }
  const parsedCodes = parseCouponCodeBatch(String(formData.get('codes') || ''));
  const codes = parsedCodes.accepted;
  const description = couponDescriptionFromForm(formData);
  const percent = Number(formData.get('percent') || 0);
  const startsAt = couponDateFromForm(formData, 'startsAt');
  const noEndDate = String(formData.get('noEndDate')) === 'on';
  const endsAt = noEndDate ? undefined : couponDateFromForm(formData, 'endsAt');

  if (
    codes.length === 0 ||
    parsedCodes.invalid.length > 0 ||
    parsedCodes.tooLong.length > 0 ||
    parsedCodes.overLimit.length > 0 ||
    !Number.isFinite(percent) ||
    percent < 1 ||
    percent > 100
  ) {
    return createActionError('Fix invalid codes and enter a discount percent from 1 to 100.');
  }

  if (startsAt === null || endsAt === null) {
    return createActionError('Choose valid ICT start and end values.');
  }

  if (!noEndDate && !endsAt) {
    return createActionError('Choose an ICT end time or select No end date.');
  }

  if (startsAt && endsAt && Date.parse(startsAt) >= Date.parse(endsAt)) {
    return createActionError('The ICT start time must be before the end time.');
  }

  try {
    const result = await adminPostOrThrow<CouponBatchResponse>('/admin/coupons/batch', {
      coupons: codes.map((code) => ({
          code,
          description: description || undefined,
          discount: { type: 'percent', value: percent },
          active: false,
          startsAt: startsAt || undefined,
          endsAt: endsAt || undefined,
      })),
    });
    revalidatePath('/coupons');
    return {
      createdCount: result.createdCount,
      failedCount: result.failedCount,
      message:
        result.failedCount > 0
          ? `${result.createdCount} created as Paused. ${result.failedCount} need attention.`
          : `${result.createdCount} ${result.createdCount === 1 ? 'coupon was' : 'coupons were'} created as Paused.`,
      results: result.results,
      status: result.failedCount > 0 ? 'warning' : 'success',
    };
  } catch (error) {
    return createActionError(
      isAdminApiAuthError(error)
        ? 'Your Admin session expired. Sign in again before creating coupons.'
        : 'Coupons could not be created. Retry after checking the connection.',
    );
  }
}

export async function updateCoupon(formData: FormData) {
  const couponId = String(formData.get('couponId') || '').trim();
  const description = couponDescriptionFromForm(formData);
  const percent = Number(formData.get('percent') || 0);
  const startsAt = couponDateFromForm(formData, 'startsAt', 'startsAtOriginal');
  const noEndDate = String(formData.get('noEndDate')) === 'on';
  const endsAt = noEndDate ? undefined : couponDateFromForm(formData, 'endsAt', 'endsAtOriginal');
  const returnTo = sanitizeCouponReturnTo(String(formData.get('returnTo') || ''));
  if (!couponLaunchEnabled()) {
    return redirect(couponReturnWithNotice(returnTo, 'launch-disabled'));
  }

  if (!couponId || !Number.isFinite(percent) || percent < 1 || percent > 100) {
    return redirect(couponReturnWithNotice(returnTo, 'update-missing'));
  }

  if (startsAt === null || endsAt === null) {
    return redirect(couponReturnWithNotice(returnTo, 'invalid-date'));
  }

  if (startsAt && endsAt && Date.parse(startsAt) >= Date.parse(endsAt)) {
    return redirect(couponReturnWithNotice(returnTo, 'date-order'));
  }

  let updatedCoupon: AdminCoupon | null = null;
  try {
    updatedCoupon = await adminPatchOrThrow<AdminCoupon>(`/admin/coupons/${couponId}`, {
      description: description || null,
      discount: { type: 'percent', value: percent },
      startsAt: startsAt || null,
      endsAt: noEndDate ? null : (endsAt || null),
    });
  } catch (error) {
    if (isAdminApiAuthError(error)) {
      return redirect(couponReturnWithNotice(returnTo, 'admin-auth'));
    }
  }
  revalidatePath('/coupons');
  redirect(couponReturnWithNotice(returnTo, updatedCoupon?.id ? 'updated' : 'update-failed'));
}

export async function activateCoupon(formData: FormData) {
  return changeCouponState(formData, 'activate');
}

export async function pauseCoupon(formData: FormData) {
  return changeCouponState(formData, 'pause');
}

async function changeCouponState(formData: FormData, action: 'activate' | 'pause') {
  const couponId = String(formData.get('couponId') || '').trim();
  const reason = String(formData.get('reason') || '').trim().slice(0, 500);
  const returnTo = sanitizeCouponReturnTo(String(formData.get('returnTo') || ''));
  if (!couponLaunchEnabled()) {
    return redirect(couponReturnWithNotice(returnTo, 'launch-disabled'));
  }
  if (!couponId || !reason) {
    return redirect(couponReturnWithNotice(returnTo, 'state-reason-required'));
  }

  try {
    if (action === 'activate') {
      const couponResult = await adminGetResult<AdminCoupon | null>(`/admin/coupons/${couponId}`, null);
      if (!couponResult.ok || !couponResult.data) {
        return redirect(couponReturnWithNotice(returnTo, 'update-failed'));
      }
      if (couponResult.data.endsAt && Date.parse(couponResult.data.endsAt) < Date.now()) {
        return redirect(couponReturnWithNotice(returnTo, 'activate-expired'));
      }
    }
    await adminPostOrThrow(`/admin/coupons/${couponId}/${action}`, { reason });
  } catch (error) {
    if (isAdminApiAuthError(error)) {
      return redirect(couponReturnWithNotice(returnTo, 'admin-auth'));
    }
    if (adminApiErrorStatus(error) === 409) {
      return redirect(couponReturnWithNotice(returnTo, 'state-conflict'));
    }
    return redirect(couponReturnWithNotice(returnTo, 'update-failed'));
  }
  revalidatePath('/coupons');
  redirect(couponReturnWithNotice(returnTo, 'toggled'));
}

export async function deleteCoupon(formData: FormData) {
  const couponId = String(formData.get('couponId') || '').trim();
  const returnTo = sanitizeCouponReturnTo(String(formData.get('returnTo') || ''));
  if (!couponLaunchEnabled()) {
    return redirect(couponReturnWithNotice(returnTo, 'launch-disabled'));
  }
  if (!couponId) {
    return redirect(couponReturnWithNotice(returnTo, 'delete-missing'));
  }

  let result: { ok: boolean; couponId: string } | null = null;
  try {
    result = await adminDeleteOrThrow<{ ok: boolean; couponId: string }>(`/admin/coupons/${couponId}`);
  } catch (error) {
    if (isAdminApiAuthError(error)) {
      return redirect(couponReturnWithNotice(returnTo, 'admin-auth'));
    }
    if (adminApiErrorStatus(error) === 400) {
      return redirect(couponReturnWithNotice(returnTo, 'delete-used'));
    }
  }
  revalidatePath('/coupons');
  redirect(couponReturnWithNotice(returnTo, result?.ok ? 'deleted' : 'delete-failed'));
}

function couponDescriptionFromForm(formData: FormData) {
  return String(formData.get('description') || '').trim().slice(0, 500);
}

function adminApiErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return null;
  }
  const status = Number((error as { status?: unknown }).status);
  return Number.isInteger(status) ? status : null;
}

function couponDateFromForm(formData: FormData, key: string, originalKey?: string) {
  const raw = String(formData.get(key) || '').trim();
  if (!raw) {
    return undefined;
  }

  const original = originalKey ? String(formData.get(originalKey) || '').trim() : undefined;
  return couponIctWallTimeToIso(raw, original);
}

function createActionError(message: string): CouponCreateActionState {
  return {
    createdCount: 0,
    failedCount: 0,
    message,
    results: [],
    status: 'error',
  };
}
