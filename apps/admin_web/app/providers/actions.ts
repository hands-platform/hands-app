'use server';

import { revalidatePath } from 'next/cache';
import { adminPost } from '../../lib/admin-api';

const MIN_REVIEW_REASON_LENGTH = 12;

export async function approveProvider(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  await adminPost(`/admin/providers/${providerId}/approve`, {}, null);
  revalidateProviderPaths(providerId);
}

export async function rejectProvider(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  const reason = readReviewReason(formData);
  await adminPost(`/admin/providers/${providerId}/reject`, { reason }, null);
  revalidateProviderPaths(providerId);
}

export async function syncSupabaseProviderRole(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  await adminPost(`/admin/providers/${providerId}/sync-supabase-role`, {}, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function enablePushDevice(formData: FormData) {
  const pushDeviceId = String(formData.get('pushDeviceId'));
  await adminPost(`/admin/push-devices/${pushDeviceId}/enable`, {}, null);
  revalidatePath('/providers');
  revalidatePath('/notifications');
}

export async function blockProviderDevice(formData: FormData) {
  const providerId = readOptionalProviderId(formData);
  const providerDeviceId = readRequiredFormString(formData, 'providerDeviceId');
  const reason = readReviewReason(formData);
  await adminPost(`/admin/provider-devices/${providerDeviceId}/block`, { reason }, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function unblockProviderDevice(formData: FormData) {
  const providerId = readOptionalProviderId(formData);
  const providerDeviceId = readRequiredFormString(formData, 'providerDeviceId');
  await adminPost(`/admin/provider-devices/${providerDeviceId}/unblock`, {}, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function approveProviderKyc(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  await adminPost(`/admin/providers/${providerId}/kyc/approve`, {}, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function rejectProviderKyc(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  const reason = readReviewReason(formData);
  await adminPost(`/admin/providers/${providerId}/kyc/reject`, { reason }, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function approveProviderDocument(formData: FormData) {
  const documentId = readRequiredFormString(formData, 'documentId');
  await adminPost(`/admin/provider-documents/${documentId}/approve`, {}, null);
  revalidateProviderPaths(readOptionalProviderId(formData));
  revalidatePath('/audit-log');
}

export async function rejectProviderDocument(formData: FormData) {
  const documentId = readRequiredFormString(formData, 'documentId');
  const reason = readReviewReason(formData);
  await adminPost(`/admin/provider-documents/${documentId}/reject`, { reason }, null);
  revalidateProviderPaths(readOptionalProviderId(formData));
  revalidatePath('/audit-log');
}

export async function approveProviderBankAccount(formData: FormData) {
  const bankAccountId = readRequiredFormString(formData, 'bankAccountId');
  await adminPost(`/admin/provider-bank-accounts/${bankAccountId}/approve`, {}, null);
  revalidateProviderPaths(readOptionalProviderId(formData));
  revalidatePath('/audit-log');
}

export async function rejectProviderBankAccount(formData: FormData) {
  const bankAccountId = readRequiredFormString(formData, 'bankAccountId');
  const reason = readReviewReason(formData);
  await adminPost(`/admin/provider-bank-accounts/${bankAccountId}/reject`, { reason }, null);
  revalidateProviderPaths(readOptionalProviderId(formData));
  revalidatePath('/audit-log');
}

export async function approveProviderTaxProfile(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  await adminPost(`/admin/providers/${providerId}/tax-profile/approve`, {}, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function rejectProviderTaxProfile(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  const reason = readReviewReason(formData);
  await adminPost(`/admin/providers/${providerId}/tax-profile/reject`, { reason }, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

function readRequiredFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function readReviewReason(formData: FormData) {
  const value = readRequiredFormString(formData, 'reason').replace(/\s+/g, ' ');
  if (value.length < MIN_REVIEW_REASON_LENGTH) {
    throw new Error(`Review reason must be at least ${MIN_REVIEW_REASON_LENGTH} characters`);
  }
  return value.slice(0, 500);
}

function readOptionalProviderId(formData: FormData) {
  const value = formData.get('providerId');
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function revalidateProviderPaths(providerId?: string | null) {
  revalidatePath('/providers');
  if (providerId) {
    revalidatePath(`/providers/${providerId}`);
  }
}
