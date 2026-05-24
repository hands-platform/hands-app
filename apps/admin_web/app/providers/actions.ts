'use server';

import { revalidatePath } from 'next/cache';
import { adminPost } from '../../lib/admin-api';

export async function approveProvider(formData: FormData) {
  const providerId = String(formData.get('providerId'));
  await adminPost(`/admin/providers/${providerId}/approve`, {}, null);
  revalidateProviderPaths(providerId);
}

export async function rejectProvider(formData: FormData) {
  const providerId = String(formData.get('providerId'));
  const reason = String(formData.get('reason') || 'Rejected by admin');
  await adminPost(`/admin/providers/${providerId}/reject`, { reason }, null);
  revalidateProviderPaths(providerId);
}

export async function syncSupabaseProviderRole(formData: FormData) {
  const providerId = String(formData.get('providerId'));
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

export async function approveProviderKyc(formData: FormData) {
  const providerId = String(formData.get('providerId'));
  await adminPost(`/admin/providers/${providerId}/kyc/approve`, {}, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function rejectProviderKyc(formData: FormData) {
  const providerId = String(formData.get('providerId'));
  const reason = String(formData.get('reason') || 'KYC rejected by admin');
  await adminPost(`/admin/providers/${providerId}/kyc/reject`, { reason }, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function approveProviderDocument(formData: FormData) {
  const documentId = String(formData.get('documentId'));
  await adminPost(`/admin/provider-documents/${documentId}/approve`, {}, null);
  revalidateProviderPaths(readOptionalProviderId(formData));
  revalidatePath('/audit-log');
}

export async function rejectProviderDocument(formData: FormData) {
  const documentId = String(formData.get('documentId'));
  const reason = String(formData.get('reason') || 'Provider document rejected by admin');
  await adminPost(`/admin/provider-documents/${documentId}/reject`, { reason }, null);
  revalidateProviderPaths(readOptionalProviderId(formData));
  revalidatePath('/audit-log');
}

export async function approveProviderBankAccount(formData: FormData) {
  const bankAccountId = String(formData.get('bankAccountId'));
  await adminPost(`/admin/provider-bank-accounts/${bankAccountId}/approve`, {}, null);
  revalidateProviderPaths(readOptionalProviderId(formData));
  revalidatePath('/audit-log');
}

export async function rejectProviderBankAccount(formData: FormData) {
  const bankAccountId = String(formData.get('bankAccountId'));
  const reason = String(formData.get('reason') || 'Bank account rejected by admin');
  await adminPost(`/admin/provider-bank-accounts/${bankAccountId}/reject`, { reason }, null);
  revalidateProviderPaths(readOptionalProviderId(formData));
  revalidatePath('/audit-log');
}

export async function approveProviderTaxProfile(formData: FormData) {
  const providerId = String(formData.get('providerId'));
  await adminPost(`/admin/providers/${providerId}/tax-profile/approve`, {}, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function rejectProviderTaxProfile(formData: FormData) {
  const providerId = String(formData.get('providerId'));
  const reason = String(formData.get('reason') || 'Tax profile rejected by admin');
  await adminPost(`/admin/providers/${providerId}/tax-profile/reject`, { reason }, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
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
