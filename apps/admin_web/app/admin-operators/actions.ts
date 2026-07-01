'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  adminDeleteWithBodyOrThrow,
  adminPatchOrThrow,
  adminPostOrThrow,
  isAdminApiAuthError,
} from '../../lib/admin-api';

const operatorRoles = new Set(['ADMIN', 'FINANCE_APPROVER', 'MASTER_ADMIN']);
const permissionCategories = new Set([
  'BOOKINGS',
  'BOOKINGS_REALTIME',
  'BOOKINGS_IN_PROGRESS',
  'BOOKINGS_COMPLETED',
  'BOOKINGS_CANCELLATIONS',
  'BOOKINGS_DETAIL',
  'CUSTOMERS',
  'CUSTOMERS_DIRECTORY',
  'CUSTOMERS_DETAIL',
  'CUSTOMERS_REVIEWS',
  'PARTNERS',
  'PARTNERS_DIRECTORY',
  'PARTNERS_UNAPPROVED',
  'PARTNERS_DETAIL',
  'PARTNERS_KYC',
  'FINANCE',
  'FINANCE_PAYMENT_CLEARING',
  'FINANCE_GENERAL_LEDGER',
  'FINANCE_BANK_RECONCILIATION',
  'FINANCE_WALLET_ADJUSTMENTS',
  'FINANCE_SETTLEMENTS',
  'FINANCE_TAX',
  'NOTIFICATIONS',
  'NOTIFICATIONS_TEMPLATES',
  'NOTIFICATIONS_PUSH',
  'NOTIFICATIONS_DELIVERY',
  'SYSTEM',
  'SYSTEM_SERVICES',
  'SYSTEM_COUPONS',
  'SYSTEM_ADMIN_OPERATORS',
  'SYSTEM_POLICY',
  'SYSTEM_AUDIT',
  'SYSTEM_SETUP',
]);

export async function createAdminOperator(formData: FormData) {
  const email = readOptionalString(formData, 'email');
  if (!email) {
    return redirect('/admin-operators?operatorNotice=missing-email');
  }
  const password = readOptionalString(formData, 'password');
  if (!password) {
    return redirect('/admin-operators?operatorNotice=missing-password');
  }

  try {
    await adminPostOrThrow('/admin/users/admin-operators', {
      email,
      fullName: readOptionalString(formData, 'fullName') || null,
      password,
      roles: readOperatorRoles(formData),
      permissionCategories: readPermissionCategories(formData),
      reason: readOptionalString(formData, 'reason'),
    });
  } catch (error) {
    return redirect(adminOperatorFailureRedirect(error));
  }

  revalidateAdminOperatorPaths();
  redirect('/admin-operators?operatorNotice=created');
}

export async function updateAdminOperatorAccess(formData: FormData) {
  const userId = readOptionalString(formData, 'userId');
  if (!userId) {
    return redirect('/admin-operators?operatorNotice=missing-user');
  }

  try {
    await adminPatchOrThrow(`/admin/users/${encodeURIComponent(userId)}/admin-operator-access`, {
      roles: readOperatorRoles(formData),
      permissionCategories: readPermissionCategories(formData),
      reason: readOptionalString(formData, 'reason'),
    });
  } catch (error) {
    return redirect(adminOperatorFailureRedirect(error));
  }

  revalidateAdminOperatorPaths();
  redirect('/admin-operators?operatorNotice=updated');
}

export async function revokeAdminOperatorAccess(formData: FormData) {
  const userId = readOptionalString(formData, 'userId');
  if (!userId) {
    return redirect('/admin-operators?operatorNotice=missing-user');
  }

  try {
    await adminDeleteWithBodyOrThrow(`/admin/users/${encodeURIComponent(userId)}/admin-operator`, {
      reason: readOptionalString(formData, 'reason'),
    });
  } catch (error) {
    return redirect(adminOperatorFailureRedirect(error));
  }

  revalidateAdminOperatorPaths();
  redirect('/admin-operators?operatorNotice=revoked');
}

function readOperatorRoles(formData: FormData) {
  const roles = new Set(['ADMIN']);
  for (const value of formData.getAll('roles')) {
    if (typeof value === 'string' && operatorRoles.has(value)) {
      roles.add(value);
    }
  }
  return [...roles];
}

function readPermissionCategories(formData: FormData) {
  return formData
    .getAll('permissionCategories')
    .filter((value): value is string => typeof value === 'string' && permissionCategories.has(value));
}

function readOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function adminOperatorFailureRedirect(error: unknown) {
  if (isAdminApiAuthError(error)) {
    return '/admin-operators?operatorNotice=admin-auth';
  }

  return '/admin-operators?operatorNotice=failed';
}

function revalidateAdminOperatorPaths() {
  revalidatePath('/admin-operators');
  revalidatePath('/audit-log');
}
