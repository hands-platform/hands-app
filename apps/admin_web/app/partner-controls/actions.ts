'use server';

import { revalidatePath } from 'next/cache';
import { adminPatch, adminPost } from '../../lib/admin-api';

const MIN_REASON_LENGTH = 12;

export async function createProviderReport(formData: FormData) {
  const providerProfileId = readRequired(formData, 'providerProfileId');
  const category = readRequired(formData, 'category');
  const summary = readRequired(formData, 'summary');
  const details = readOptional(formData, 'details');
  const severity = readOptional(formData, 'severity') ?? 'MEDIUM';
  const source = readOptional(formData, 'source') ?? 'ADMIN';
  const bookingId = readOptional(formData, 'bookingId');
  await adminPost(
    '/admin/partner-reports',
    { providerProfileId, category, summary, details, severity, source, bookingId },
    null,
  );
  revalidateProviderRisk(providerProfileId);
}

export async function updateProviderReport(formData: FormData) {
  const reportId = readRequired(formData, 'reportId');
  const providerProfileId = readOptional(formData, 'providerProfileId');
  const status = readOptional(formData, 'status');
  const severity = readOptional(formData, 'severity');
  const resolutionNote = readOptional(formData, 'resolutionNote');
  await adminPatch(`/admin/partner-reports/${reportId}`, { status, severity, resolutionNote }, null);
  revalidateProviderRisk(providerProfileId);
}

export async function createProviderSanction(formData: FormData) {
  const providerProfileId = readRequired(formData, 'providerProfileId');
  const type = readOptional(formData, 'type') ?? 'WARNING';
  const reportId = readOptional(formData, 'reportId');
  const expiresAt = readOptional(formData, 'expiresAt');
  const reason = readReason(formData);
  await adminPost(
    `/admin/partners/${providerProfileId}/sanctions`,
    { type, reportId, expiresAt, reason },
    null,
  );
  revalidateProviderRisk(providerProfileId);
}

export async function liftProviderSanction(formData: FormData) {
  const sanctionId = readRequired(formData, 'sanctionId');
  const providerProfileId = readOptional(formData, 'providerProfileId');
  await adminPost(`/admin/partner-sanctions/${sanctionId}/lift`, {}, null);
  revalidateProviderRisk(providerProfileId);
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

function revalidateProviderRisk(providerProfileId?: string | null) {
  revalidatePath('/partner-controls');
  revalidatePath('/partners');
  revalidatePath('/audit-log');
  if (providerProfileId) {
    revalidatePath(`/partners/${providerProfileId}`);
  }
}
