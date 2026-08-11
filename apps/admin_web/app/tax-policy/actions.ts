'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { AdminTaxPolicyVersion, AdminTaxRule, adminPatch, adminPost } from '../../lib/admin-api';

const taxRuleScopes = new Set(['DEFAULT', 'SERVICE_TYPE', 'AMOUNT_BAND']);

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
  const approval = taxPolicyApprovalPayload(formData);

  const policy = await adminPost<AdminTaxPolicyVersion | null>(
    '/admin/tax-policy-versions',
    {
      ...approval,
      effectiveFrom,
      name,
      notes: notes || undefined,
      status,
    },
    null,
  );

  if (policy?.id && defaultRateBps !== null) {
    await adminPost(
      `/admin/tax-policy-versions/${policy.id}/rules`,
      {
        active: true,
        ...approval,
        fixedAmount: 0,
        rateBps: defaultRateBps,
        scope: 'DEFAULT',
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
  const approval = taxPolicyApprovalPayload(formData);

  await adminPatch(
    `/admin/tax-policy-versions/${id}`,
    {
      ...approval,
      effectiveFrom,
      effectiveTo,
      notes: notes || null,
      status,
    },
    null,
  );

  revalidatePath('/tax-policy');
  revalidatePath('/audit-log');
}

export async function createTaxRule(formData: FormData) {
  const policyId = String(formData.get('policyId'));
  let ruleInput: TaxRuleFormInput;
  try {
    ruleInput = parseTaxRuleFormInput(formData);
  } catch (error) {
    return redirectTaxPolicyValidation(error);
  }
  const approval = taxPolicyApprovalPayload(formData);

  await adminPost(
    `/admin/tax-policy-versions/${policyId}/rules`,
    {
      active: true,
      ...approval,
      fixedAmount: ruleInput.fixedAmount,
      maxGrossAmount: ruleInput.maxGrossAmount ?? undefined,
      minGrossAmount: ruleInput.minGrossAmount ?? undefined,
      rateBps: ruleInput.rateBps,
      scope: ruleInput.scope,
      serviceType: ruleInput.serviceType || undefined,
    },
    null,
  );

  revalidatePath('/tax-policy');
  revalidatePath('/audit-log');
}

export async function updateTaxRule(formData: FormData) {
  const ruleId = String(formData.get('ruleId'));
  let ruleInput: TaxRuleFormInput;
  try {
    ruleInput = parseTaxRuleFormInput(formData);
  } catch (error) {
    return redirectTaxPolicyValidation(error);
  }
  const active = formData.get('active') === 'on';
  const approval = taxPolicyApprovalPayload(formData);

  await adminPatch<AdminTaxRule | null>(
    `/admin/tax-rules/${ruleId}`,
    {
      active,
      ...approval,
      fixedAmount: ruleInput.fixedAmount,
      maxGrossAmount: ruleInput.maxGrossAmount,
      minGrossAmount: ruleInput.minGrossAmount,
      rateBps: ruleInput.rateBps,
      scope: ruleInput.scope,
      serviceType: ruleInput.serviceType,
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

function taxPolicyApprovalPayload(formData: FormData) {
  return {
    approvalAdminId: String(formData.get('approvalAdminId') ?? '').trim(),
    operatorReason: String(formData.get('operatorReason') ?? '').trim(),
  };
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

type TaxRuleFormInput = {
  readonly scope: string;
  readonly serviceType: string | null;
  readonly minGrossAmount: number | null;
  readonly maxGrossAmount: number | null;
  readonly rateBps: number;
  readonly fixedAmount: number;
};

function parseTaxRuleFormInput(formData: FormData): TaxRuleFormInput {
  const scope = String(formData.get('scope') || 'DEFAULT').trim() || 'DEFAULT';
  const serviceType = String(formData.get('serviceType') || '').trim();
  const minGrossAmount = parseInteger(formData.get('minGrossAmount'));
  const maxGrossAmount = parseInteger(formData.get('maxGrossAmount'));
  const rateBps = parseInteger(formData.get('rateBps')) ?? 0;
  const fixedAmount = parseInteger(formData.get('fixedAmount')) ?? 0;

  if (!taxRuleScopes.has(scope)) {
    throw new Error('Tax rule scope is invalid.');
  }
  if (rateBps < 0 || rateBps > 10000) {
    throw new Error('Rate bps must be between 0 and 10000.');
  }
  if (fixedAmount < 0) {
    throw new Error('Fixed amount must be zero or greater.');
  }
  if (minGrossAmount !== null && minGrossAmount < 0) {
    throw new Error('Min amount must be zero or greater.');
  }
  if (maxGrossAmount !== null && maxGrossAmount < 0) {
    throw new Error('Max amount must be zero or greater.');
  }
  if (minGrossAmount !== null && maxGrossAmount !== null && minGrossAmount > maxGrossAmount) {
    throw new Error('Min amount cannot be greater than max amount.');
  }
  if (scope === 'SERVICE_TYPE' && !serviceType) {
    throw new Error('SERVICE_TYPE tax rules require service type.');
  }
  if (scope === 'AMOUNT_BAND' && minGrossAmount === null && maxGrossAmount === null) {
    throw new Error('AMOUNT_BAND tax rules require min or max amount.');
  }

  return {
    fixedAmount,
    maxGrossAmount: scope === 'AMOUNT_BAND' ? maxGrossAmount : null,
    minGrossAmount: scope === 'AMOUNT_BAND' ? minGrossAmount : null,
    rateBps,
    scope,
    serviceType: scope === 'SERVICE_TYPE' ? serviceType : null,
  };
}
