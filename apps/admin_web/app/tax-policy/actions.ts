'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { AdminTaxPolicyVersion, AdminTaxRule, adminPatch, adminPost } from '../../lib/admin-api';

export async function createTaxPolicyVersion(formData: FormData) {
  const name = String(formData.get('name') || '').trim();
  const status = String(formData.get('status') || 'DRAFT');
  let effectiveFrom: string;
  try {
    effectiveFrom = parseRequiredDate(formData.get('effectiveFrom'), 'Effective from');
  } catch (error) {
    return redirectTaxPolicyValidation(error);
  }
  const notes = String(formData.get('notes') || '').trim();
  const defaultRateBps = parseInteger(formData.get('defaultRateBps'));

  const policy = await adminPost<AdminTaxPolicyVersion | null>(
    '/admin/tax-policy-versions',
    {
      name,
      status,
      effectiveFrom,
      notes: notes || undefined,
    },
    null,
  );

  if (policy?.id && defaultRateBps !== null) {
    await adminPost(
      `/admin/tax-policy-versions/${policy.id}/rules`,
      {
        scope: 'DEFAULT',
        rateBps: defaultRateBps,
        fixedAmount: 0,
        active: true,
      },
      null,
    );
  }

  revalidatePath('/tax-policy');
  revalidatePath('/audit-log');
}

export async function updateTaxPolicyVersion(formData: FormData) {
  const id = String(formData.get('policyId'));
  const status = String(formData.get('status') || 'DRAFT');
  let effectiveFrom: string;
  let effectiveTo: string | null;
  try {
    effectiveFrom = parseRequiredDate(formData.get('effectiveFrom'), 'Effective from');
    effectiveTo = parseOptionalDate(formData.get('effectiveTo'), 'Effective to');
    assertEffectiveDateWindow(effectiveFrom, effectiveTo);
  } catch (error) {
    return redirectTaxPolicyValidation(error);
  }
  const notes = String(formData.get('notes') || '').trim();

  await adminPatch(
    `/admin/tax-policy-versions/${id}`,
    {
      status,
      effectiveFrom,
      effectiveTo,
      notes: notes || null,
    },
    null,
  );

  revalidatePath('/tax-policy');
  revalidatePath('/audit-log');
}

export async function createTaxRule(formData: FormData) {
  const policyId = String(formData.get('policyId'));
  const scope = String(formData.get('scope') || 'DEFAULT');
  const serviceType = String(formData.get('serviceType') || '').trim();
  const minGrossAmount = parseInteger(formData.get('minGrossAmount'));
  const maxGrossAmount = parseInteger(formData.get('maxGrossAmount'));
  const rateBps = parseInteger(formData.get('rateBps')) ?? 0;
  const fixedAmount = parseInteger(formData.get('fixedAmount')) ?? 0;

  await adminPost(
    `/admin/tax-policy-versions/${policyId}/rules`,
    {
      scope,
      serviceType: serviceType || undefined,
      minGrossAmount: minGrossAmount ?? undefined,
      maxGrossAmount: maxGrossAmount ?? undefined,
      rateBps,
      fixedAmount,
      active: true,
    },
    null,
  );

  revalidatePath('/tax-policy');
  revalidatePath('/audit-log');
}

export async function updateTaxRule(formData: FormData) {
  const ruleId = String(formData.get('ruleId'));
  const scope = String(formData.get('scope') || 'DEFAULT');
  const serviceType = String(formData.get('serviceType') || '').trim();
  const minGrossAmount = parseInteger(formData.get('minGrossAmount'));
  const maxGrossAmount = parseInteger(formData.get('maxGrossAmount'));
  const rateBps = parseInteger(formData.get('rateBps')) ?? 0;
  const fixedAmount = parseInteger(formData.get('fixedAmount')) ?? 0;
  const active = formData.get('active') === 'on';

  await adminPatch<AdminTaxRule | null>(
    `/admin/tax-rules/${ruleId}`,
    {
      scope,
      serviceType: serviceType || null,
      minGrossAmount,
      maxGrossAmount,
      rateBps,
      fixedAmount,
      active,
    },
    null,
  );

  revalidatePath('/tax-policy');
  revalidatePath('/audit-log');
}

function parseInteger(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }
  const number = Number(raw);
  return Number.isInteger(number) ? number : null;
}

function parseRequiredDate(value: FormDataEntryValue | null, label: string) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    throw new Error(`${label} is required.`);
  }

  return parseDateToIso(raw, label);
}

function parseOptionalDate(value: FormDataEntryValue | null, label: string) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }

  return parseDateToIso(raw, label);
}

function parseDateToIso(value: string, label: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid date.`);
  }

  return date.toISOString();
}

function assertEffectiveDateWindow(effectiveFrom: string, effectiveTo: string | null) {
  if (!effectiveTo) {
    return;
  }

  if (Date.parse(effectiveTo) <= Date.parse(effectiveFrom)) {
    throw new Error('Effective to must be after effective from.');
  }
}

function redirectTaxPolicyValidation(error: unknown) {
  if (error instanceof Error) {
    return redirect(
      `/tax-policy?taxPolicyNotice=validation&message=${encodeURIComponent(error.message)}`,
    );
  }

  throw error;
}
