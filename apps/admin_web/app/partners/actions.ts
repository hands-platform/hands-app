'use server';

import { revalidatePath } from 'next/cache';
import { adminPatchOrThrow, adminPost } from '../../lib/admin-api';

const MIN_REVIEW_REASON_LENGTH = 12;

export async function approveProvider(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  await adminPost(`/admin/partners/${providerId}/approve`, {}, null);
  revalidateProviderPaths(providerId);
}

export async function rejectProvider(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  const reason = readReviewReason(formData);
  await adminPost(`/admin/partners/${providerId}/reject`, { reason }, null);
  revalidateProviderPaths(providerId);
}

export async function blockProviderAccount(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  const reason = readReviewReason(formData);
  await adminPost(`/admin/partners/${providerId}/block`, { reason }, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function unblockProviderAccount(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  await adminPost(`/admin/partners/${providerId}/unblock`, {}, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function syncSupabaseProviderRole(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  await adminPost(`/admin/partners/${providerId}/sync-supabase-role`, {}, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function addProviderOpsNote(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  const note = readOptionalFormString(formData, 'note');
  const preset = readOptionalFormString(formData, 'preset');
  if (!note && !preset) {
    throw new Error('Partner operation note is required');
  }
  await adminPost(`/admin/partners/${providerId}/ops-note`, { note, preset }, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function enablePushDevice(formData: FormData) {
  const pushDeviceId = readRequiredFormString(formData, 'pushDeviceId');
  await adminPost(`/admin/push-devices/${pushDeviceId}/enable`, {}, null);
  revalidatePath('/partners');
  revalidatePath('/partner-controls');
  revalidatePath('/notifications');
  revalidatePath('/audit-log');
}

export async function blockProviderDevice(formData: FormData) {
  const providerId = readOptionalProviderId(formData);
  const providerDeviceId = readRequiredFormString(formData, 'providerDeviceId');
  const reason = readReviewReason(formData);
  await adminPost(`/admin/partner-devices/${providerDeviceId}/block`, { reason }, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function unblockProviderDevice(formData: FormData) {
  const providerId = readOptionalProviderId(formData);
  const providerDeviceId = readRequiredFormString(formData, 'providerDeviceId');
  await adminPost(`/admin/partner-devices/${providerDeviceId}/unblock`, {}, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function approveProviderKyc(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  await adminPost(`/admin/partners/${providerId}/kyc/approve`, {}, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function rejectProviderKyc(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  const reason = readReviewReason(formData);
  await adminPost(`/admin/partners/${providerId}/kyc/reject`, { reason }, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function approveProviderDocument(formData: FormData) {
  const documentId = readRequiredFormString(formData, 'documentId');
  await adminPost(`/admin/partner-documents/${documentId}/approve`, {}, null);
  revalidateProviderPaths(readOptionalProviderId(formData));
  revalidatePath('/audit-log');
}

export async function rejectProviderDocument(formData: FormData) {
  const documentId = readRequiredFormString(formData, 'documentId');
  const reason = readReviewReason(formData);
  await adminPost(`/admin/partner-documents/${documentId}/reject`, { reason }, null);
  revalidateProviderPaths(readOptionalProviderId(formData));
  revalidatePath('/audit-log');
}

export async function approvePublicProviderMedia(formData: FormData) {
  const fileId = readRequiredFormString(formData, 'fileId');
  await adminPost(`/admin/files/${fileId}/approve-public-media`, {}, null);
  revalidateProviderPaths(readOptionalProviderId(formData));
  revalidatePath('/audit-log');
}

export async function rejectPublicProviderMedia(formData: FormData) {
  const fileId = readRequiredFormString(formData, 'fileId');
  const reason = readReviewReason(formData);
  await adminPost(`/admin/files/${fileId}/reject-public-media`, { reason }, null);
  revalidateProviderPaths(readOptionalProviderId(formData));
  revalidatePath('/audit-log');
}

export async function approveProviderBankAccount(formData: FormData) {
  const bankAccountId = readRequiredFormString(formData, 'bankAccountId');
  await adminPost(`/admin/partner-bank-accounts/${bankAccountId}/approve`, {}, null);
  revalidateProviderPaths(readOptionalProviderId(formData));
  revalidatePath('/audit-log');
}

export async function rejectProviderBankAccount(formData: FormData) {
  const bankAccountId = readRequiredFormString(formData, 'bankAccountId');
  const reason = readReviewReason(formData);
  await adminPost(`/admin/partner-bank-accounts/${bankAccountId}/reject`, { reason }, null);
  revalidateProviderPaths(readOptionalProviderId(formData));
  revalidatePath('/audit-log');
}

export async function approveProviderTaxProfile(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  await adminPost(`/admin/partners/${providerId}/tax-profile/approve`, {}, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function rejectProviderTaxProfile(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  const reason = readReviewReason(formData);
  await adminPost(`/admin/partners/${providerId}/tax-profile/reject`, { reason }, null);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function updatePartnerWalletWithdrawalRequest(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  const requestId = readRequiredFormString(formData, 'requestId');
  const status = readRequiredFormString(formData, 'status');
  const transferRef = readOptionalFormString(formData, 'transferRef');
  const bankTransferDate = readOptionalFormString(formData, 'bankTransferDate');
  const attachmentFileId = readOptionalFormString(formData, 'attachmentFileId');
  const attachmentUrl = readOptionalFormString(formData, 'attachmentUrl');
  const adminNote = readOptionalFormString(formData, 'adminNote');
  const correctionReason = readOptionalFormString(formData, 'correctionReason');
  const approvalAdminId = readOptionalFormString(formData, 'approvalAdminId');
  if (status === 'PAID' && !approvalAdminId) {
    throw new Error('Provider wallet withdrawal paid closeout requires approval from a different admin');
  }

  await adminPatchOrThrow(`/admin/provider-wallet/withdrawal-requests/${requestId}`, {
    status,
    approvalAdminId: approvalAdminId || undefined,
    transferRef: transferRef || undefined,
    bankTransferDate: bankTransferDate || undefined,
    attachmentFileId: attachmentFileId || undefined,
    attachmentUrl: attachmentUrl || undefined,
    adminNote: adminNote || undefined,
    correctionReason: correctionReason || undefined,
  });

  revalidateProviderPaths(providerId);
  revalidatePath('/payouts');
  revalidatePath('/cash-settlements');
  revalidatePath('/earnings');
  revalidatePath('/audit-log');
}

function readRequiredFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function readOptionalFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' && value.trim() ? value.trim().replace(/\s+/g, ' ').slice(0, 1000) : null;
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
  revalidatePath('/partners');
  revalidatePath('/partner-controls');
  revalidatePath('/files');
  if (providerId) {
    revalidatePath(`/partners/${providerId}`);
  }
}
