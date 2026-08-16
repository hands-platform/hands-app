'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';

import type {
  AdminCustomerDirectoryRow,
  AdminProvider,
  AdminPushCampaign,
  AdminPushCampaignPreview,
} from '../../../lib/admin-api';
import {
  AdminApiRequestError,
  adminGetResult,
  adminPostOrThrow,
} from '../../../lib/admin-api';

export type PushAccountCandidate = {
  readonly accountStatus: string;
  readonly displayLabel: string;
  readonly maskedPhone: string;
  readonly selectionId: string;
};

export type PushAccountSearchState = {
  readonly status: 'idle' | 'success' | 'error';
  readonly candidates?: readonly PushAccountCandidate[];
  readonly error?: string;
  readonly role?: 'CUSTOMER' | 'PROVIDER';
};

export type PushPreviewActionState = {
  readonly status: 'idle' | 'success' | 'error';
  readonly preview?: AdminPushCampaignPreview;
  readonly idempotencyKey?: string;
  readonly draftRevision?: string;
  readonly error?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
};

export type PushConfirmActionState = {
  readonly status: 'idle' | 'success' | 'error';
  readonly campaign?: AdminPushCampaign & { replayed?: boolean };
  readonly error?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
};

export const INITIAL_PUSH_ACCOUNT_SEARCH_STATE: PushAccountSearchState = { status: 'idle' };
export const INITIAL_PUSH_PREVIEW_STATE: PushPreviewActionState = { status: 'idle' };
export const INITIAL_PUSH_CONFIRM_STATE: PushConfirmActionState = { status: 'idle' };

export async function searchPushAccounts(
  _previous: PushAccountSearchState,
  formData: FormData,
): Promise<PushAccountSearchState> {
  const role = readRole(formData);
  const query = readString(formData, 'accountSearch');
  if (query.length < 2) return { status: 'error', role, error: 'Enter at least 2 characters.' };
  const href = role === 'CUSTOMER'
    ? `/admin/customers?q=${encodeURIComponent(query)}&take=8&skip=0`
    : `/admin/partners/list-providers?q=${encodeURIComponent(query)}&take=8`;
  if (role === 'CUSTOMER') {
    const result = await adminGetResult<AdminCustomerDirectoryRow[]>(href, []);
    if (!result.ok) return { status: 'error', role, error: searchError(result.status) };
    return {
      status: 'success',
      role,
      candidates: result.data.flatMap((customer) => customer.user?.id ? [{
        accountStatus: 'Customer account',
        displayLabel: customer.user.fullName || maskPhone(customer.user.phone) || 'Unnamed customer',
        maskedPhone: maskPhone(customer.user.phone),
        selectionId: customer.user.id,
      }] : []),
    };
  }
  const result = await adminGetResult<AdminProvider[]>(href, []);
  if (!result.ok) return { status: 'error', role, error: searchError(result.status) };
  return {
    status: 'success',
    role,
    candidates: result.data.flatMap((partner) => {
      const userId = partner.user?.id ?? partner.userId;
      return userId ? [{
        accountStatus: sentenceCase(partner.status),
        displayLabel: partner.displayName || partner.user?.fullName || 'Unnamed Partner',
        maskedPhone: maskPhone(partner.user?.phone),
        selectionId: userId,
      }] : [];
    }),
  };
}

export async function previewPushCampaign(
  _previous: PushPreviewActionState,
  formData: FormData,
): Promise<PushPreviewActionState> {
  const title = readString(formData, 'title');
  const body = readString(formData, 'body');
  const locale = readString(formData, 'locale');
  const appDestination = readString(formData, 'appDestination');
  const fieldErrors: Record<string, string> = {};
  if (!title || title.length > 120) fieldErrors.title = 'Enter a title of 1 to 120 characters.';
  if (!body || body.length > 500) fieldErrors.body = 'Enter a message of 1 to 500 characters.';
  if (!locale) fieldErrors.locale = 'Choose the language used by eligible devices.';
  if (!appDestination) fieldErrors.appDestination = 'Choose a safe app destination.';
  if (Object.keys(fieldErrors).length) {
    return { status: 'error', error: 'Review the highlighted fields. No preview was created.', fieldErrors };
  }
  try {
    const preview = await adminPostOrThrow<AdminPushCampaignPreview>(
      '/admin/notifications/push-campaigns/preview',
      {
        appDestination,
        body,
        locale,
        targetRole: readRole(formData),
        targetSegment: readString(formData, 'targetSegment') || 'all',
        targetUserId: readString(formData, 'targetUserId') || undefined,
        title,
      },
    );
    return {
      status: 'success',
      draftRevision: readString(formData, 'draftRevision'),
      idempotencyKey: `push_${randomUUID()}`,
      preview,
    };
  } catch (error) {
    return { status: 'error', error: pushActionError(error, 'preview') };
  }
}

export async function confirmPushCampaign(
  _previous: PushConfirmActionState,
  formData: FormData,
): Promise<PushConfirmActionState> {
  const reason = readString(formData, 'reason');
  const confirmationPhrase = readString(formData, 'confirmationPhrase');
  const fieldErrors: Record<string, string> = {};
  if (reason.length < 12 || reason.length > 500) {
    fieldErrors.reason = 'Enter 12 to 500 characters explaining this campaign.';
  }
  if (!confirmationPhrase) fieldErrors.confirmationPhrase = 'Type the exact confirmation shown above.';
  if (Object.keys(fieldErrors).length) {
    return { status: 'error', error: 'Review the confirmation fields. Nothing was queued.', fieldErrors };
  }
  try {
    const campaign = await adminPostOrThrow<AdminPushCampaign & { replayed?: boolean }>(
      '/admin/notifications/push-campaigns',
      {
        confirmationPhrase,
        idempotencyKey: readString(formData, 'idempotencyKey'),
        previewId: readString(formData, 'previewId'),
        reason,
      },
    );
    revalidatePath('/notifications/push-send');
    revalidatePath('/notifications');
    revalidatePath('/audit-log');
    return { status: 'success', campaign };
  } catch (error) {
    return { status: 'error', error: pushActionError(error, 'confirm') };
  }
}

function pushActionError(error: unknown, operation: 'preview' | 'confirm') {
  if (error instanceof AdminApiRequestError) {
    if (error.status === 400) return 'The audience, copy, language, or destination is invalid. Draft preserved.';
    if (error.status === 401) return 'Your Admin Web session expired. Sign in again; draft preserved.';
    if (error.status === 403) return 'You do not have Push Send permission.';
    if (error.status === 404) return operation === 'preview'
      ? 'The selected account no longer exists. Choose another account.'
      : 'The preview no longer exists. Create a new preview.';
    if (error.status === 409) {
      const message = apiErrorMessage(error.payload).toLowerCase();
      if (message.includes('expired')) return 'Preview expired. Create and review a new preview before queueing.';
      if (message.includes('consumed')) return 'This preview was already used. Review campaign history before retrying.';
      return 'Audience or preview state changed. Create and review a new preview.';
    }
    if (error.status === 422) return 'The audience cannot be queued. Review the limit, devices, and destination.';
    if (error.status === 429) return 'Push Send is rate limited. Wait briefly, then retry with the same draft.';
    if (error.status >= 500) return operation === 'confirm'
      ? 'Queue unavailable. Draft preserved; retry uses the same request key.'
      : 'Preview source unavailable. Draft preserved.';
  }
  return operation === 'confirm'
    ? 'Campaign result is not confirmed. Review history before retrying.'
    : 'Preview could not be created. Draft preserved.';
}

function searchError(status: number | null) {
  if (status === 401) return 'Your Admin Web session expired.';
  if (status === 403) return 'You do not have Push Send permission.';
  return 'Account search is unavailable. No account was selected.';
}

function readRole(formData: FormData) {
  return readString(formData, 'targetRole') === 'PROVIDER' ? 'PROVIDER' as const : 'CUSTOMER' as const;
}

function readString(formData: FormData, name: string) {
  return String(formData.get(name) ?? '').trim();
}

function apiErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') return '';
  const message = (payload as { message?: unknown }).message;
  if (Array.isArray(message)) return message.filter((item): item is string => typeof item === 'string').join(' ');
  return typeof message === 'string' ? message : '';
}

function maskPhone(value?: string | null) {
  if (!value) return '';
  const compact = value.replace(/\s+/gu, '');
  return compact.length <= 6
    ? `${compact.slice(0, 2)}**${compact.slice(-2)}`
    : `${compact.slice(0, 3)}${'*'.repeat(Math.min(6, compact.length - 6))}${compact.slice(-3)}`;
}

function sentenceCase(value: string) {
  return value.toLowerCase().split('_').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
}
