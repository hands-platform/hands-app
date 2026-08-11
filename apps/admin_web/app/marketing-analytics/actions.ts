'use server';

import { revalidatePath } from 'next/cache';
import {
  AdminApiRequestError,
  adminPostOrThrow,
  isAdminApiAuthError,
} from '../../lib/admin-api';

export type MarketingSpendActionState = {
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly message?: string;
  readonly saved?: {
    readonly campaignId: string | null;
    readonly platform: string | null;
    readonly reason: string;
    readonly source: string;
    readonly spendAmount: number;
    readonly spendDate: string;
    readonly updatedAt: string | null;
  };
  readonly status: 'idle' | 'invalid' | 'conflict' | 'forbidden' | 'unavailable' | 'error' | 'success';
};

type MarketingSpendSaveResult = {
  campaignId?: string | null;
  platform?: string | null;
  source?: string;
  spendAmount?: number;
  spendDate?: string;
  updatedAt?: string | Date;
};

export async function upsertMarketingSpendDaily(
  _previousState: MarketingSpendActionState,
  formData: FormData,
): Promise<MarketingSpendActionState> {
  const spendDate = readFormText(formData, 'spendDate');
  const source = readFormText(formData, 'source');
  const spendAmount = parseInteger(formData.get('spendAmount'));
  const reason = readFormText(formData, 'reason');
  const fieldErrors: Record<string, string> = {};

  if (!spendDate) fieldErrors.spendDate = 'Spend date is required.';
  if (!source) fieldErrors.source = 'Spend source is required.';
  if (spendAmount === null) fieldErrors.spendAmount = 'Enter a whole VND amount of zero or more.';
  if (reason.length < 12) fieldErrors.reason = 'Explain the change in at least 12 characters.';

  if (Object.keys(fieldErrors).length > 0 || spendAmount === null) {
    return {
      fieldErrors,
      message: 'Review the highlighted spend fields before saving.',
      status: 'invalid',
    };
  }

  const platform = readFormText(formData, 'platform') || undefined;
  const campaignId = readFormText(formData, 'campaignId') || undefined;

  try {
    const saved = await adminPostOrThrow<MarketingSpendSaveResult>('/admin/marketing/spend-daily', {
      spendDate,
      source,
      platform,
      regionCode: readFormText(formData, 'regionCode') || undefined,
      campaignId,
      campaignName: readFormText(formData, 'campaignName') || undefined,
      spendAmount,
      currency: (readFormText(formData, 'currency') || 'VND').toUpperCase(),
      expectedUpdatedAt: readFormText(formData, 'expectedUpdatedAt') || null,
      notes: readFormText(formData, 'notes') || undefined,
      reason,
    });

    revalidatePath('/marketing-analytics');
    revalidatePath('/audit-log');

    return {
      message: 'Daily spend was saved and the marketing aggregates were refreshed.',
      saved: {
        campaignId: saved?.campaignId ?? campaignId ?? null,
        platform: saved?.platform ?? platform ?? null,
        reason,
        source: saved?.source ?? source,
        spendAmount: saved?.spendAmount ?? spendAmount,
        spendDate: saved?.spendDate ?? spendDate,
        updatedAt: normalizeSavedAt(saved?.updatedAt),
      },
      status: 'success',
    };
  } catch (error) {
    if (isAdminApiAuthError(error)) {
      return {
        message: 'You do not have permission to change marketing spend.',
        status: 'forbidden',
      };
    }
    if (error instanceof AdminApiRequestError && error.status === 409) {
      return {
        message: 'This spend row changed after review. Reload the current value before saving again.',
        status: 'conflict',
      };
    }
    if (!(error instanceof AdminApiRequestError) || error.status >= 500) {
      return {
        message: 'Marketing spend could not be saved because the API is unavailable. No change was made.',
        status: 'unavailable',
      };
    }
    return {
      message: 'Marketing spend could not be saved. Review the evidence and try again.',
      status: 'error',
    };
  }
}

function readFormText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function parseInteger(value: FormDataEntryValue | null) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;

  const number = Number(raw);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function normalizeSavedAt(value: string | Date | undefined) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'string' && !Number.isNaN(new Date(value).getTime())) return value;
  return null;
}
