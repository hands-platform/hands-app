'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { AdminPushCampaign } from '../../../lib/admin-api';
import { adminPostOrThrow } from '../../../lib/admin-api';

export async function sendPushCampaign(formData: FormData) {
  const targetRole = readRequiredFormString(formData, 'targetRole');
  const title = readRequiredFormString(formData, 'title');
  const body = readRequiredFormString(formData, 'body');
  const targetSegment = readOptionalFormString(formData, 'targetSegment');
  const appDestination = readOptionalFormString(formData, 'appDestination');
  const targetUserId = readOptionalFormString(formData, 'targetUserId');
  const locale = readOptionalFormString(formData, 'locale');

  let campaign: AdminPushCampaign;
  try {
    campaign = await adminPostOrThrow<AdminPushCampaign>('/admin/notifications/push-campaigns', {
      targetRole,
      targetSegment,
      appDestination,
      targetUserId,
      locale,
      title,
      body,
    });
    revalidatePath('/notifications');
    revalidatePath('/notifications/push-send');
  } catch {
    redirect('/notifications/push-send?notice=failed');
  }
  redirect(`/notifications/push-send?notice=sent&campaignId=${encodeURIComponent(campaign.id)}`);
}

function readRequiredFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

function readOptionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
