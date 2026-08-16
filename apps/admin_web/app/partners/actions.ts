'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  type AdminProvider,
  adminDeleteOrThrow,
  adminGet,
  adminPatchOrThrow,
  adminPost,
  adminPostOrThrow,
} from '../../lib/admin-api';
import {
  PARTNER_APPROVAL_QUEUE_API_HREF,
  nextPartnerApprovalHref,
  readPartnerDecisionQueue,
} from './partner-review-mode';

const MIN_REVIEW_REASON_LENGTH = 12;
const PARTNER_PUBLIC_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const PARTNER_PUBLIC_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function approveProvider(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  await adminPostOrThrow(`/admin/partners/${providerId}/approve`, {});
  revalidateProviderPaths(providerId);
  await redirectAfterPartnerApprovalDecision(formData, providerId);
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
  await adminPostOrThrow(`/admin/partners/${providerId}/block`, { reason });
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
  await redirectAfterPartnerApprovalDecision(formData, providerId);
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
  await adminPostOrThrow(`/admin/partners/${providerId}/kyc/approve`, {});
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

export async function putProviderKycOnHold(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  const reason = readReviewReason(formData);
  await adminPostOrThrow(`/admin/partners/${providerId}/kyc/hold`, { reason });
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
  await redirectAfterPartnerApprovalDecision(formData, providerId);
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

export async function updatePartnerProfileTranslations(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  await adminPatchOrThrow(`/admin/partners/${providerId}/profile-content`, {
    bioEn: readBioTranslation(formData, 'bioEn'),
    bioJa: readBioTranslation(formData, 'bioJa'),
    bioKo: readBioTranslation(formData, 'bioKo'),
    bioZh: readBioTranslation(formData, 'bioZh'),
  });
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function uploadPartnerPublicMedia(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  const purpose = readRequiredFormString(formData, 'purpose');
  if (purpose !== 'profile-image' && purpose !== 'provider-gallery') {
    throw new Error('Public media type is invalid');
  }
  const photo = formData.get('photo');
  if (!(photo instanceof File) || photo.size === 0) {
    throw new Error('Select a public profile image to upload');
  }
  const contentType = photo.type.trim().toLowerCase();
  if (!PARTNER_PUBLIC_IMAGE_TYPES.has(contentType)) {
    throw new Error('Only JPEG, PNG, and WebP public profile images are allowed');
  }
  if (photo.size > PARTNER_PUBLIC_IMAGE_MAX_BYTES) {
    throw new Error('Public profile images must be 10 MB or smaller');
  }

  const presigned = await adminPostOrThrow<{
    file: { id: string };
    storageMode: string;
    upload: { headers?: Record<string, string>; method: string; url: string };
  }>(`/admin/partners/${providerId}/public-media/presign`, {
    contentType,
    purpose,
    sizeBytes: photo.size,
  });

  try {
    if (!/^https?:\/\//u.test(presigned.upload.url)) {
      throw new Error('Public media storage is not configured for uploads');
    }
    const uploadResponse = await fetch(presigned.upload.url, {
      method: 'PUT',
      headers: presigned.upload.headers ?? { 'content-type': contentType },
      body: Buffer.from(await photo.arrayBuffer()),
    });
    if (!uploadResponse.ok) {
      throw new Error(`Public media upload failed with status ${uploadResponse.status}`);
    }
    await adminPostOrThrow(`/admin/partners/${providerId}/public-media/${presigned.file.id}/complete`, {
      sizeBytes: photo.size,
    });
  } catch (error) {
    await adminDeleteOrThrow(`/admin/partners/${providerId}/public-media/${presigned.file.id}`).catch(
      () => undefined,
    );
    throw error;
  }

  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function deletePartnerPublicMedia(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  const fileId = readRequiredFormString(formData, 'fileId');
  await adminDeleteOrThrow(`/admin/partners/${providerId}/public-media/${fileId}`);
  revalidateProviderPaths(providerId);
  revalidatePath('/audit-log');
}

export async function reorderPartnerPublicMedia(formData: FormData) {
  const providerId = readRequiredFormString(formData, 'providerId');
  const fileId = readRequiredFormString(formData, 'fileId');
  const direction = readRequiredFormString(formData, 'direction');
  const fileIds = readRequiredFormString(formData, 'fileIds')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const currentIndex = fileIds.indexOf(fileId);
  const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= fileIds.length) {
    return;
  }
  [fileIds[currentIndex], fileIds[targetIndex]] = [fileIds[targetIndex], fileIds[currentIndex]];
  await adminPatchOrThrow(`/admin/partners/${providerId}/public-media/order`, { fileIds });
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
  if (status === 'BANK_TRANSFER_PENDING' && !transferRef) {
    throw new Error('Partner wallet withdrawal bank transfer request requires a transfer reference');
  }
  if (status === 'BANK_TRANSFER_PENDING' && !bankTransferDate) {
    throw new Error('Partner wallet withdrawal bank transfer request requires a transfer date');
  }
  if (status === 'BANK_TRANSFER_PENDING' && !attachmentFileId && !attachmentUrl) {
    throw new Error('Partner wallet withdrawal bank transfer request requires attached bank evidence');
  }

  await adminPatchOrThrow(
    `/admin/provider-wallet/withdrawal-requests/${requestId}`,
    status === 'PAID'
      ? { status }
      : {
          status,
          transferRef: transferRef || undefined,
          bankTransferDate: bankTransferDate || undefined,
          attachmentFileId: attachmentFileId || undefined,
          attachmentUrl: attachmentUrl || undefined,
          adminNote: adminNote || undefined,
          correctionReason: correctionReason || undefined,
        },
  );

  revalidateProviderPaths(providerId);
  revalidatePath('/payouts');
  revalidatePath('/cash-settlements');
  revalidatePath('/earnings');
  revalidatePath('/audit-log');
}

export async function createPartnerManualCustomerReview(formData: FormData) {
  const providerProfileId = readRequiredFormString(formData, 'providerProfileId');
  const rating = Number.parseInt(readRequiredFormString(formData, 'rating'), 10);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('rating must be between 1 and 5');
  }

  await adminPostOrThrow('/admin/reviews/manual', {
    bookingId: readRequiredFormString(formData, 'bookingId'),
    providerProfileId,
    rating,
    comment: readRequiredFormString(formData, 'comment').replace(/\s+/g, ' ').slice(0, 1000),
    createdAt: `${readRequiredFormString(formData, 'reviewDate')}T12:00:00+07:00`,
  });

  revalidateProviderPaths(providerProfileId);
  revalidatePath('/reviews');
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

async function redirectAfterPartnerApprovalDecision(formData: FormData, providerId: string) {
  const decisionQueue = readPartnerDecisionQueue(readOptionalFormString(formData, 'decisionQueue'));
  if (!decisionQueue) return;

  const oldestPendingProviders = await adminGet<AdminProvider[]>(PARTNER_APPROVAL_QUEUE_API_HREF, []);
  redirect(nextPartnerApprovalHref(oldestPendingProviders, providerId));
}

function readBioTranslation(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim().slice(0, 2000) : '';
}
