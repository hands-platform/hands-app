'use server';

import { revalidatePath } from 'next/cache';
import {
  AdminApiRequestError,
  adminPostOrThrow,
} from '../../lib/admin-api';

export type MarketingSpendActionState = {
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly message?: string;
  readonly saved?: {
    readonly auditId: string | null;
    readonly campaignId: string | null;
    readonly canonicalTarget: string | null;
    readonly outcome: 'NO_CHANGE' | 'SAVED';
    readonly platform: string | null;
    readonly reason: string;
    readonly source: string;
    readonly spendAmount: number;
    readonly spendDate: string;
    readonly updatedAt: string | null;
  };
  readonly status:
    | 'idle'
    | 'invalid'
    | 'unauthorized'
    | 'forbidden'
    | 'conflict'
    | 'throttled'
    | 'unavailable'
    | 'error'
    | 'success';
};

type MarketingSpendSaveResult = {
  auditId?: string | null;
  campaignId?: string | null;
  canonicalTarget?: string | null;
  platform?: string | null;
  source?: string;
  spendAmount?: number;
  spendDate?: string;
  status?: 'NO_CHANGE' | 'SAVED';
  updatedAt?: string | Date;
};

export async function upsertMarketingSpendDaily(
  _previousState: MarketingSpendActionState,
  formData: FormData,
): Promise<MarketingSpendActionState> {
  const spendDate = readFormText(formData, 'spendDate');
  const source = readFormText(formData, 'source');
  const platform = readFormText(formData, 'platform');
  const spendAmount = parseInteger(formData.get('spendAmount'));
  const reason = readFormText(formData, 'reason');
  const fieldErrors: Record<string, string> = {};

  if (!spendDate) fieldErrors.spendDate = 'Spend date is required.';
  if (!source) fieldErrors.source = 'Spend source is required.';
  if (!platform) fieldErrors.platform = 'Spend platform is required.';
  if (spendAmount === null || spendAmount > 2_000_000_000) {
    fieldErrors.spendAmount = 'Enter a whole VND amount from zero to 2,000,000,000.';
  }
  if (reason.length < 12) fieldErrors.reason = 'Explain the change in at least 12 characters.';

  if (Object.keys(fieldErrors).length > 0 || spendAmount === null) {
    return {
      fieldErrors,
      message: 'Review the highlighted spend fields before saving.',
      status: 'invalid',
    };
  }

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

    const outcome = saved?.status ?? 'SAVED';
    if (outcome === 'SAVED') {
      revalidatePath('/marketing-analytics');
      revalidatePath('/audit-log');
    }

    return {
      message:
        outcome === 'NO_CHANGE'
          ? 'No change was required. The reviewed value already matches the spend ledger.'
          : 'Daily spend was saved and the marketing aggregates were refreshed.',
      saved: {
        auditId: saved?.auditId ?? null,
        campaignId: saved?.campaignId ?? campaignId ?? null,
        canonicalTarget: saved?.canonicalTarget ?? null,
        outcome,
        platform: saved?.platform ?? platform,
        reason,
        source: saved?.source ?? source,
        spendAmount: saved?.spendAmount ?? spendAmount,
        spendDate: saved?.spendDate ?? spendDate,
        updatedAt: normalizeSavedAt(saved?.updatedAt),
      },
      status: 'success',
    };
  } catch (error) {
    const code = marketingSpendApiErrorCode(error);
    const knownMessage: Record<string, string> = {
      MARKETING_SPEND_AMOUNT_INVALID: 'Spend must be a whole VND amount from zero to 2,000,000,000.',
      MARKETING_SPEND_CAMPAIGN_ID_AMBIGUOUS:
        'This campaign resolves to duplicate or non-canonical spend rows. Resolve the ledger conflict before editing.',
      MARKETING_SPEND_DATE_INVALID: 'Spend date must be a valid calendar date.',
      MARKETING_SPEND_FUTURE_DATE: 'Future Vietnam dates cannot be recorded as spend.',
      MARKETING_SPEND_PLATFORM_REQUIRED: 'Select the platform explicitly before saving spend.',
      MARKETING_SPEND_VERSION_CONFLICT:
        'This spend row changed after review. Reload the current value before saving again.',
    };
    if (knownMessage[code]) {
      return {
        message: knownMessage[code],
        status: code.includes('CONFLICT') || code.includes('AMBIGUOUS') ? 'conflict' : 'invalid',
      };
    }
    if (error instanceof AdminApiRequestError && error.status === 401) {
      return {
        message: 'Your administrator session expired. Sign in again before saving spend.',
        status: 'unauthorized',
      };
    }
    if (error instanceof AdminApiRequestError && error.status === 403) {
      return {
        message: 'Your role can read marketing analytics but cannot manage marketing spend.',
        status: 'forbidden',
      };
    }
    if (error instanceof AdminApiRequestError && error.status === 409) {
      return {
        message: 'This spend row changed after review. Reload the current value before saving again.',
        status: 'conflict',
      };
    }
    if (error instanceof AdminApiRequestError && error.status === 429) {
      return {
        message: 'Too many spend updates were submitted. Wait briefly, then review the current row before retrying.',
        status: 'throttled',
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

function marketingSpendApiErrorCode(error: unknown) {
  if (!(error instanceof AdminApiRequestError) || !isRecord(error.payload)) return '';
  const nested = isRecord(error.payload.error) ? error.payload.error : null;
  if (typeof nested?.code === 'string') return nested.code;
  return typeof error.payload.code === 'string' ? error.payload.code : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
