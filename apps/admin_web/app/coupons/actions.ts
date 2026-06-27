'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { AdminCoupon } from '../../lib/admin-api';
import {
  adminDeleteOrThrow,
  adminPatchOrThrow,
  adminPostOrThrow,
  isAdminApiAuthError,
} from '../../lib/admin-api';

export async function createCoupon(formData: FormData) {
  const codes = couponCodesFromForm(formData);
  const percent = Number(formData.get('percent') || 0);
  const startsAt = couponDateFromForm(formData, 'startsAt');
  const endsAt = couponDateFromForm(formData, 'endsAt');

  if (codes.length === 0 || !Number.isFinite(percent) || percent <= 0) {
    return redirect('/coupons?couponNotice=missing-required');
  }

  if (startsAt === null || endsAt === null) {
    return redirect('/coupons?couponNotice=invalid-date');
  }

  if (startsAt && endsAt && Date.parse(startsAt) > Date.parse(endsAt)) {
    return redirect('/coupons?couponNotice=date-order');
  }

  let createdCount = 0;
  let failedCount = 0;
  let authFailed = false;
  for (const code of codes) {
    try {
      const createdCoupon = await adminPostOrThrow<AdminCoupon>(
        '/admin/coupons',
        {
          code,
          discount: { type: 'percent', value: percent },
          active: true,
          startsAt: startsAt || undefined,
          endsAt: endsAt || undefined,
        },
      );
      if (createdCoupon?.id) {
        createdCount += 1;
      } else {
        failedCount += 1;
      }
    } catch (error) {
      if (isAdminApiAuthError(error)) {
        authFailed = true;
        break;
      }
      failedCount += 1;
    }
  }
  revalidatePath('/coupons');
  if (authFailed && createdCount === 0) {
    return redirect('/coupons?couponNotice=admin-auth');
  }
  redirect(couponCreateNoticePath(createdCount, failedCount));
}

export async function updateCoupon(formData: FormData) {
  const couponId = String(formData.get('couponId') || '').trim();
  const percent = Number(formData.get('percent') || 0);
  const startsAt = couponDateFromForm(formData, 'startsAt');
  const endsAt = couponDateFromForm(formData, 'endsAt');
  const active = String(formData.get('active')) === 'on';

  if (!couponId || !Number.isFinite(percent) || percent <= 0) {
    return redirect('/coupons?couponNotice=update-missing');
  }

  if (startsAt === null || endsAt === null) {
    return redirect('/coupons?couponNotice=invalid-date');
  }

  if (startsAt && endsAt && Date.parse(startsAt) > Date.parse(endsAt)) {
    return redirect('/coupons?couponNotice=date-order');
  }

  let updatedCoupon: AdminCoupon | null = null;
  try {
    updatedCoupon = await adminPatchOrThrow<AdminCoupon>(`/admin/coupons/${couponId}`, {
      active,
      discount: { type: 'percent', value: percent },
      startsAt: startsAt || null,
      endsAt: endsAt || null,
    });
  } catch (error) {
    if (isAdminApiAuthError(error)) {
      return redirect('/coupons?couponNotice=admin-auth');
    }
  }
  revalidatePath('/coupons');
  redirect(`/coupons?couponNotice=${updatedCoupon?.id ? 'updated' : 'update-failed'}`);
}

export async function toggleCoupon(formData: FormData) {
  const couponId = String(formData.get('couponId'));
  const active = String(formData.get('active')) === 'true';
  try {
    await adminPatchOrThrow(`/admin/coupons/${couponId}`, { active: !active });
  } catch (error) {
    if (isAdminApiAuthError(error)) {
      return redirect('/coupons?couponNotice=admin-auth');
    }
    return redirect('/coupons?couponNotice=update-failed');
  }
  revalidatePath('/coupons');
  redirect('/coupons?couponNotice=toggled');
}

export async function deleteCoupon(formData: FormData) {
  const couponId = String(formData.get('couponId') || '').trim();
  if (!couponId) {
    return redirect('/coupons?couponNotice=delete-missing');
  }

  let result: { ok: boolean; couponId: string } | null = null;
  try {
    result = await adminDeleteOrThrow<{ ok: boolean; couponId: string }>(`/admin/coupons/${couponId}`);
  } catch (error) {
    if (isAdminApiAuthError(error)) {
      return redirect('/coupons?couponNotice=admin-auth');
    }
  }
  revalidatePath('/coupons');
  redirect(`/coupons?couponNotice=${result?.ok ? 'deleted' : 'delete-failed'}`);
}

function couponCodesFromForm(formData: FormData) {
  const raw = String(formData.get('codes') || formData.get('code') || '');
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

function couponDateFromForm(formData: FormData, key: string) {
  const raw = String(formData.get(key) || '').trim();
  if (!raw) {
    return undefined;
  }

  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function couponCreateNoticePath(createdCount: number, failedCount: number) {
  const params = new URLSearchParams();
  params.set(
    'couponNotice',
    createdCount > 0 ? (failedCount > 0 ? 'partial' : 'created') : 'failed',
  );
  params.set('created', String(createdCount));
  params.set('failed', String(failedCount));
  return `/coupons?${params.toString()}`;
}
