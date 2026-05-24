'use server';

import { revalidatePath } from 'next/cache';
import { AdminTaxPolicyVersion, adminPatch, adminPost } from '../../lib/admin-api';

export async function createTaxPolicyVersion(formData: FormData) {
  const name = String(formData.get('name') || '').trim();
  const status = String(formData.get('status') || 'DRAFT');
  const effectiveFrom = String(formData.get('effectiveFrom') || new Date().toISOString());
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
  const effectiveFrom = String(formData.get('effectiveFrom') || '');
  const effectiveTo = String(formData.get('effectiveTo') || '').trim();
  const notes = String(formData.get('notes') || '').trim();

  await adminPatch(
    `/admin/tax-policy-versions/${id}`,
    {
      status,
      effectiveFrom: effectiveFrom || undefined,
      effectiveTo: effectiveTo || null,
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

function parseInteger(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }
  const number = Number(raw);
  return Number.isInteger(number) ? number : null;
}
