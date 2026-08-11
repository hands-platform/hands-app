'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPatch, adminPost } from '../../lib/admin-api';

const MIN_REASON_LENGTH = 12;

export type PartnerControlActionState = {
  readonly fieldErrors?: Record<string, string>;
  readonly message: string;
  readonly status: 'error' | 'success';
  readonly values: Record<string, string>;
};

export type PartnerControlRestrictionActionState = PartnerControlActionState;

export async function createProviderReport(formData: FormData) {
  const returnTo = partnerControlReturnTo(formData);
  const result = await saveProviderReport(formData);
  if (result.status === 'error') {
    return redirect(partnerControlNoticeHref(returnTo, 'report-failed'));
  }
  redirect(partnerControlNoticeHref(returnTo, 'report-saved'));
}

export async function createProviderReportWithState(
  _previousState: PartnerControlActionState | null,
  formData: FormData,
): Promise<PartnerControlActionState> {
  const returnTo = partnerControlReturnTo(formData);
  const result = await saveProviderReport(formData);
  if (result.status === 'error') return result;
  redirect(partnerControlNoticeHref(returnTo, 'report-saved'));
}

export async function updateProviderReport(formData: FormData) {
  const returnTo = partnerControlReturnTo(formData);
  const result = await saveProviderReportUpdate(formData);
  if (result.status === 'error') {
    return redirect(partnerControlNoticeHref(returnTo, 'report-update-failed'));
  }
  redirect(partnerControlNoticeHref(returnTo, 'report-updated'));
}

export async function updateProviderReportWithState(
  _previousState: PartnerControlActionState | null,
  formData: FormData,
): Promise<PartnerControlActionState> {
  const returnTo = partnerControlReturnTo(formData);
  const result = await saveProviderReportUpdate(formData);
  if (result.status === 'error') return result;
  redirect(partnerControlNoticeHref(returnTo, 'report-updated'));
}

export async function createProviderSanction(formData: FormData) {
  const result = await saveProviderSanction(formData);
  if (result.status === 'error') {
    throw new Error(result.message);
  }
}

export async function createProviderSanctionWithState(
  _previousState: PartnerControlRestrictionActionState | null,
  formData: FormData,
): Promise<PartnerControlRestrictionActionState> {
  return saveProviderSanction(formData);
}

async function saveProviderSanction(formData: FormData): Promise<PartnerControlRestrictionActionState> {
  const values = restrictionFormValues(formData);
  try {
    if (readOptional(formData, 'confirmation') !== 'confirmed') {
      throw new Error('Restriction confirmation is required');
    }
    const providerProfileId = readRequired(formData, 'providerProfileId');
    const type = readOptional(formData, 'type') ?? 'WARNING';
    const reportId = readOptional(formData, 'reportId');
    const expiresAt = restrictionExpiry(formData);
    const reason = readReason(formData);
    await adminPost(
      `/admin/providers/${providerProfileId}/sanctions`,
      { type, reportId, expiresAt, reason },
      null,
    );
    revalidatePartnerControls(providerProfileId);
  } catch {
    return {
      message: 'The restriction was not saved. Check confirmation, expiry, and evidence, then try again.',
      status: 'error',
      values,
    };
  }
  return {
    message: 'The Partner restriction was saved.',
    status: 'success',
    values: {},
  };
}

export async function liftProviderSanction(formData: FormData) {
  const sanctionId = readRequired(formData, 'sanctionId');
  const providerProfileId = readOptional(formData, 'providerProfileId');
  const reason = readReason(formData);
  await adminPost(`/admin/provider-sanctions/${sanctionId}/lift`, { reason }, null);
  revalidatePartnerControls(providerProfileId);
}

async function saveProviderReport(formData: FormData): Promise<PartnerControlActionState> {
  const values = reportFormValues(formData);
  const fieldErrors = requiredFieldErrors(values, ['providerProfileId', 'category', 'severity', 'summary']);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      message: 'Complete the required report fields, then try again.',
      status: 'error',
      values,
    };
  }

  try {
    await adminPost(
      '/admin/provider-reports',
      {
        providerProfileId: values.providerProfileId,
        category: values.category,
        summary: values.summary,
        details: values.details || null,
        severity: values.severity,
        source: 'ADMIN',
        bookingId: values.bookingId || null,
      },
      null,
    );
    revalidatePartnerControls(values.providerProfileId);
  } catch {
    return {
      message: 'The report was not saved. Review the evidence and try again.',
      status: 'error',
      values,
    };
  }
  return { message: 'The Partner report was saved.', status: 'success', values: {} };
}

async function saveProviderReportUpdate(formData: FormData): Promise<PartnerControlActionState> {
  const values = reportUpdateFormValues(formData);
  const fieldErrors = requiredFieldErrors(values, ['reportId', 'status', 'severity']);
  if ((values.status === 'RESOLVED' || values.status === 'DISMISSED') && !values.resolutionNote) {
    fieldErrors.resolutionNote = 'Resolution note is required when closing a report.';
  }
  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      message: 'Complete the report decision evidence, then try again.',
      status: 'error',
      values,
    };
  }

  try {
    await adminPatch(
      `/admin/provider-reports/${values.reportId}`,
      {
        status: values.status,
        severity: values.severity,
        resolutionNote: values.resolutionNote || null,
      },
      null,
    );
    revalidatePartnerControls(readOptional(formData, 'providerProfileId'));
  } catch {
    return {
      message: 'The report decision was not saved. Review the evidence and try again.',
      status: 'error',
      values,
    };
  }
  return { message: 'The report decision was saved.', status: 'success', values: {} };
}

function readRequired(formData: FormData, name: string) {
  const value = readOptional(formData, name);
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function readReason(formData: FormData) {
  const reason = readRequired(formData, 'reason').replace(/\s+/g, ' ');
  if (reason.length < MIN_REASON_LENGTH) {
    throw new Error(`Reason must be at least ${MIN_REASON_LENGTH} characters`);
  }
  return reason.slice(0, 500);
}

function readOptional(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function restrictionExpiry(formData: FormData) {
  const noExpiry = readOptional(formData, 'noExpiry') === 'true';
  const expiresAt = readOptional(formData, 'expiresAt');
  if (noExpiry === Boolean(expiresAt)) {
    throw new Error('Choose one expiry option');
  }
  if (!expiresAt) return null;
  const parsed = new Date(expiresAt);
  if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) {
    throw new Error('Expiry must be in the future');
  }
  return parsed.toISOString();
}

function partnerControlReturnTo(formData: FormData) {
  const value = readOptional(formData, 'returnTo') ?? '/partner-controls';
  const url = new URL(value, 'http://admin.local');
  return url.pathname === '/partner-controls' ? `${url.pathname}${url.search}` : '/partner-controls';
}

function partnerControlNoticeHref(returnTo: string, notice: string) {
  const url = new URL(returnTo, 'http://admin.local');
  url.searchParams.set('notice', notice);
  return `${url.pathname}${url.search}`;
}

function restrictionFormValues(formData: FormData) {
  return Object.fromEntries(
    ['confirmation', 'expiresAt', 'noExpiry', 'reason', 'type'].flatMap((name) => {
      const value = readOptional(formData, name);
      return value ? [[name, value] as const] : [];
    }),
  );
}

function reportFormValues(formData: FormData) {
  return Object.fromEntries(
    ['bookingId', 'category', 'details', 'providerProfileId', 'severity', 'summary'].map((name) => [
      name,
      readOptional(formData, name) ?? '',
    ]),
  );
}

function reportUpdateFormValues(formData: FormData) {
  return Object.fromEntries(
    ['reportId', 'resolutionNote', 'severity', 'status'].map((name) => [
      name,
      readOptional(formData, name) ?? '',
    ]),
  );
}

function requiredFieldErrors(
  values: Record<string, string>,
  fields: readonly string[],
): Record<string, string> {
  return Object.fromEntries(
    fields.flatMap((field) => (values[field] ? [] : [[field, 'This field is required.'] as const])),
  );
}

function revalidatePartnerControls(providerProfileId?: string | null) {
  revalidatePath('/partner-controls');
  revalidatePath('/partners');
  revalidatePath('/audit-log');
  if (providerProfileId) {
    revalidatePath(`/partners/${providerProfileId}`);
  }
}
