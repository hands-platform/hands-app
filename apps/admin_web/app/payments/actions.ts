'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  AdminApiRequestError,
  type AdminPaymentActionReceipt,
  adminPostOrThrow,
} from '../../lib/admin-api';
import { paymentReturnTo } from './payment-action-confirmation';

export async function refundPayment(formData: FormData) {
  return runPaymentAction(formData, 'refund', 'refund-request');
}

export async function syncPayment(formData: FormData) {
  return runPaymentAction(formData, 'sync', 'sync');
}

export async function capturePayment(formData: FormData) {
  return runPaymentAction(formData, 'capture', 'capture');
}

export async function releasePayment(formData: FormData) {
  return runPaymentAction(formData, 'release', 'release');
}

async function runPaymentAction(
  formData: FormData,
  action: 'capture' | 'refund' | 'release' | 'sync',
  endpoint: 'capture' | 'refund-request' | 'release' | 'sync',
) {
  const paymentId = readString(formData, 'paymentId');
  const idempotencyKey = readString(formData, 'idempotencyKey');
  const reason = readString(formData, 'reason');
  const returnTo = paymentReturnTo(formData.get('returnTo'));
  if (!paymentId || !idempotencyKey || (action !== 'sync' && reason.length < 12)) {
    redirect(paymentActionNoticeHref(returnTo, {
      action,
      code: 'PAYMENT_ACTION_INPUT_REQUIRED',
      notice: 'error',
      paymentId,
    }));
  }

  let receipt: AdminPaymentActionReceipt;
  try {
    receipt = await adminPostOrThrow<AdminPaymentActionReceipt>(
      `/admin/payments/${encodeURIComponent(paymentId)}/${endpoint}`,
      { idempotencyKey, ...(reason ? { reason } : {}) },
    );
  } catch (error) {
    const failure = paymentActionFailure(error);
    redirect(paymentActionNoticeHref(returnTo, {
      action,
      code: failure.code,
      message: failure.message,
      notice: 'error',
      paymentId,
    }));
  }

  revalidatePaymentOperationPaths();
  if (action === 'refund') revalidatePath('/finance-tax/approval-queue');
  redirect(paymentActionNoticeHref(returnTo, {
    action,
    auditId: receipt.auditId,
    notice: 'success',
    paymentId,
  }));
}

function paymentActionNoticeHref(
  returnTo: string,
  notice: {
    action: string;
    auditId?: string;
    code?: string;
    message?: string;
    notice: 'error' | 'success';
    paymentId: string;
  },
) {
  const url = new URL(paymentReturnTo(returnTo), 'http://admin.local');
  url.searchParams.set('paymentNotice', notice.notice);
  url.searchParams.set('paymentAction', notice.action);
  if (notice.paymentId) url.searchParams.set('paymentId', notice.paymentId);
  if (notice.auditId) url.searchParams.set('auditId', notice.auditId);
  if (notice.code) url.searchParams.set('paymentCode', notice.code.slice(0, 80));
  if (notice.message) url.searchParams.set('paymentMessage', notice.message.slice(0, 240));
  return `${url.pathname}${url.search}`;
}

function paymentActionFailure(error: unknown) {
  if (!(error instanceof AdminApiRequestError)) {
    return { code: 'PAYMENT_ACTION_FAILED', message: 'The payment action could not be completed.' };
  }
  const payload = objectValue(error.payload);
  const nested = objectValue(payload.message);
  return {
    code: stringValue(nested.code) || stringValue(payload.code) || `HTTP_${error.status}`,
    message:
      stringValue(nested.message) ||
      stringValue(payload.message) ||
      'The server rejected this action after rechecking payment and booking evidence.',
  };
}

function readString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function revalidatePaymentOperationPaths() {
  revalidatePath('/payments');
  revalidatePath('/refunds');
  revalidatePath('/earnings');
  revalidatePath('/bookings');
  revalidatePath('/partner-controls');
  revalidatePath('/partners');
  revalidatePath('/audit-log');
}
