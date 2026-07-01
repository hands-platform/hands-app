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
  'CUSTOMERS',
  'PARTNERS',
  'FINANCE',
  'NOTIFICATIONS',
  'SYSTEM',
]);

export async function createAdminOperator(formData: FormData) {
  const phone = readOptionalString(formData, 'phone');
  if (!phone) {
    return redirect('/admin-operators?operatorNotice=missing-phone');
  }

  try {
    await adminPostOrThrow('/admin/users/admin-operators', {
      phone,
      email: readOptionalString(formData, 'email') || null,
      fullName: readOptionalString(formData, 'fullName') || null,
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
