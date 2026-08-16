'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  AdminApiRequestError,
  AdminTaxPolicyApprovalRequest,
  AdminTaxPolicyVersion,
  AdminTaxRule,
  adminPatchOrThrow,
  adminPostOrThrow,
} from '../../lib/admin-api';
import { vietnamLocalDateTimeToIso } from './tax-policy-time';
import {
  INITIAL_TAX_POLICY_ACTION_STATE,
  type TaxPolicyActionState,
} from './action-state';

const taxRuleScopes = new Set(['DEFAULT', 'SERVICE_TYPE', 'AMOUNT_BAND']);

export async function createTaxPolicyVersion(
  _state: TaxPolicyActionState,
  formData: FormData,
): Promise<TaxPolicyActionState> {
  let payload: Record<string, unknown>;
  try {
    const defaultRateBps = parseRatePercent(formData.get('defaultRatePercent'), 'Fallback withholding rate');
    payload = {
      name: requiredText(formData, 'name', 'Policy name'),
      status: 'DRAFT',
      effectiveFrom: parseRequiredDate(formData.get('effectiveFrom'), 'Effective from'),
      notes: optionalText(formData, 'notes'),
      legalSourceTitle: requiredText(formData, 'legalSourceTitle', 'Legal source title'),
      legalSourceUrl: requiredText(formData, 'legalSourceUrl', 'Legal source URL'),
      promulgatedDate: parseRequiredVietnamDate(formData.get('promulgatedDate'), 'Promulgated date'),
      taxSubject: requiredText(formData, 'taxSubject', 'Tax subject'),
      changeSummary: requiredText(formData, 'changeSummary', 'Change summary'),
      operatorReason: requiredText(formData, 'operatorReason', 'Operator evidence'),
      supersedesPolicyVersionId: optionalText(formData, 'supersedesPolicyVersionId'),
      ...(defaultRateBps === null ? {} : { defaultRateBps }),
    };
  } catch (error) {
    return taxPolicyActionError(error, formData);
  }

  let created: AdminTaxPolicyVersion;
  try {
    created = await adminPostOrThrow<AdminTaxPolicyVersion>('/admin/tax-policy-versions', payload);
  } catch (error) {
    return taxPolicyActionError(error, formData);
  }
  finishTaxPolicyAction('draft-created', created.id);
  return INITIAL_TAX_POLICY_ACTION_STATE;
}

export async function updateTaxPolicyVersion(
  _state: TaxPolicyActionState,
  formData: FormData,
): Promise<TaxPolicyActionState> {
  const id = String(formData.get('policyId') ?? '').trim();
  let payload: Record<string, unknown>;
  try {
    const effectiveFrom = parseRequiredDate(formData.get('effectiveFrom'), 'Effective from');
    const effectiveTo = parseOptionalDate(formData.get('effectiveTo'), 'Effective to');
    assertEffectiveDateWindow(effectiveFrom, effectiveTo);
    payload = {
      name: requiredText(formData, 'name', 'Policy name'),
      status: 'DRAFT',
      effectiveFrom,
      effectiveTo,
      notes: optionalText(formData, 'notes'),
      legalSourceTitle: requiredText(formData, 'legalSourceTitle', 'Legal source title'),
      legalSourceUrl: requiredText(formData, 'legalSourceUrl', 'Legal source URL'),
      promulgatedDate: parseRequiredVietnamDate(formData.get('promulgatedDate'), 'Promulgated date'),
      taxSubject: requiredText(formData, 'taxSubject', 'Tax subject'),
      changeSummary: requiredText(formData, 'changeSummary', 'Change summary'),
      operatorReason: requiredText(formData, 'operatorReason', 'Operator evidence'),
      supersedesPolicyVersionId: optionalText(formData, 'supersedesPolicyVersionId'),
    };
  } catch (error) {
    return taxPolicyActionError(error, formData);
  }

  try {
    await adminPatchOrThrow<AdminTaxPolicyVersion>(`/admin/tax-policy-versions/${id}`, payload);
  } catch (error) {
    return taxPolicyActionError(error, formData);
  }
  finishTaxPolicyAction('draft-saved', id);
  return INITIAL_TAX_POLICY_ACTION_STATE;
}

export async function createTaxRule(
  _state: TaxPolicyActionState,
  formData: FormData,
): Promise<TaxPolicyActionState> {
  const policyId = String(formData.get('policyId') ?? '').trim();
  let ruleInput: TaxRuleFormInput;
  let operatorReason: string;
  try {
    ruleInput = parseTaxRuleFormInput(formData);
    operatorReason = requiredText(formData, 'operatorReason', 'Operator evidence');
  } catch (error) {
    return taxPolicyActionError(error, formData);
  }

  try {
    await adminPostOrThrow<AdminTaxRule>(`/admin/tax-policy-versions/${policyId}/rules`, {
      active: true,
      ...ruleInput,
      operatorReason,
    });
  } catch (error) {
    return taxPolicyActionError(error, formData);
  }
  finishTaxPolicyAction('rule-created', policyId);
  return INITIAL_TAX_POLICY_ACTION_STATE;
}

export async function updateTaxRule(
  _state: TaxPolicyActionState,
  formData: FormData,
): Promise<TaxPolicyActionState> {
  const ruleId = String(formData.get('ruleId') ?? '').trim();
  const policyId = String(formData.get('policyId') ?? '').trim();
  let ruleInput: TaxRuleFormInput;
  let operatorReason: string;
  try {
    ruleInput = parseTaxRuleFormInput(formData);
    operatorReason = requiredText(formData, 'operatorReason', 'Operator evidence');
  } catch (error) {
    return taxPolicyActionError(error, formData);
  }

  try {
    await adminPatchOrThrow<AdminTaxRule>(`/admin/tax-rules/${ruleId}`, {
      active: formData.get('active') === 'on',
      ...ruleInput,
      operatorReason,
    });
  } catch (error) {
    return taxPolicyActionError(error, formData);
  }
  finishTaxPolicyAction('rule-saved', policyId);
  return INITIAL_TAX_POLICY_ACTION_STATE;
}

export async function submitTaxPolicyApprovalRequest(
  _state: TaxPolicyActionState,
  formData: FormData,
): Promise<TaxPolicyActionState> {
  const policyId = String(formData.get('policyId') ?? '').trim();
  let payload: { cleanSourceAcknowledged: boolean; idempotencyKey: string; operatorReason: string };
  try {
    payload = {
      cleanSourceAcknowledged: formData.get('cleanSourceAcknowledged') === 'on',
      idempotencyKey: requiredText(formData, 'idempotencyKey', 'Idempotency key'),
      operatorReason: requiredText(formData, 'operatorReason', 'Approval evidence'),
    };
  } catch (error) {
    return taxPolicyActionError(error, formData);
  }
  try {
    await adminPostOrThrow<AdminTaxPolicyApprovalRequest>(
      `/admin/tax-policy-versions/${policyId}/approval-requests`,
      payload,
    );
  } catch (error) {
    return taxPolicyActionError(error, formData);
  }
  finishTaxPolicyAction('approval-requested', policyId);
  return INITIAL_TAX_POLICY_ACTION_STATE;
}

export async function decideTaxPolicyApprovalRequest(
  _state: TaxPolicyActionState,
  formData: FormData,
): Promise<TaxPolicyActionState> {
  const requestId = String(formData.get('requestId') ?? '').trim();
  const policyId = String(formData.get('policyId') ?? '').trim();
  const decision = String(formData.get('decision') ?? '').trim();
  if (decision !== 'APPROVE' && decision !== 'REJECT') {
    return taxPolicyActionError(new TaxPolicyFormError('Approval decision is invalid.', 'decision'), formData);
  }
  let decisionReason: string;
  try {
    decisionReason = requiredText(formData, 'decisionReason', 'Decision evidence');
  } catch (error) {
    return taxPolicyActionError(error, formData);
  }
  try {
    await adminPostOrThrow<AdminTaxPolicyApprovalRequest>(
      `/admin/tax-policy-approval-requests/${requestId}/decision`,
      {
        decision,
        decisionReason,
      },
    );
  } catch (error) {
    return taxPolicyActionError(error, formData);
  }
  finishTaxPolicyAction(decision === 'APPROVE' ? 'approval-approved' : 'approval-rejected', policyId);
  return INITIAL_TAX_POLICY_ACTION_STATE;
}

function finishTaxPolicyAction(notice: string, policyId?: string) {
  revalidatePath('/tax-policy');
  revalidatePath('/audit-log');
  const query = new URLSearchParams({ taxPolicyNotice: notice });
  query.set('view', 'drafts');
  if (policyId) query.set('policyId', policyId);
  redirect(`/tax-policy?${query.toString()}${policyId ? `#tax-policy-${encodeURIComponent(policyId)}` : '#create-tax-policy'}`);
}

function parseInteger(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isInteger(number) ? number : null;
}

function parseRatePercent(value: FormDataEntryValue | null, label: string, required = false) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    if (required) throw new Error(`${label} is required.`);
    return null;
  }
  if (!/^\d{1,3}(?:\.\d{1,2})?$/u.test(raw)) {
    throw new Error(`${label} must use a percentage with no more than two decimal places.`);
  }
  const percent = Number(raw);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error(`${label} must be between 0% and 100%.`);
  }
  return Math.round(percent * 100);
}

function requiredText(formData: FormData, name: string, label: string) {
  const value = String(formData.get(name) ?? '').trim();
  if (!value) throw new TaxPolicyFormError(`${label} is required.`, name);
  return value;
}

function optionalText(formData: FormData, name: string) {
  return String(formData.get(name) ?? '').trim() || null;
}

function parseRequiredVietnamDate(value: FormDataEntryValue | null, label: string) {
  const raw = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(raw)) throw new Error(`${label} is required.`);
  return vietnamLocalDateTimeToIso(`${raw}T00:00`, label);
}

function parseRequiredDate(value: FormDataEntryValue | null, label: string) {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error(`${label} is required.`);
  return vietnamLocalDateTimeToIso(raw, label);
}

function parseOptionalDate(value: FormDataEntryValue | null, label: string) {
  const raw = String(value ?? '').trim();
  return raw ? vietnamLocalDateTimeToIso(raw, label) : null;
}

function assertEffectiveDateWindow(effectiveFrom: string, effectiveTo: string | null) {
  if (effectiveTo && Date.parse(effectiveTo) <= Date.parse(effectiveFrom)) {
    throw new Error('Effective to must be after effective from.');
  }
}

function taxPolicyActionError(error: unknown, formData: FormData): TaxPolicyActionState {
  if (error instanceof TaxPolicyFormError) {
    return {
      error: error.message,
      fieldErrors: { [error.field]: error.message },
      status: 'error',
      values: formValues(formData),
    };
  }
  if (error instanceof Error && !(error instanceof AdminApiRequestError)) {
    const field = validationField(error.message);
    return {
      error: error.message,
      fieldErrors: field ? { [field]: error.message } : undefined,
      status: 'error',
      values: formValues(formData),
    };
  }
  if (!(error instanceof AdminApiRequestError)) throw error;
  const payload = apiErrorPayload(error.payload);
  const message = payload.message ?? 'Tax policy request failed. Reload current data before retrying.';
  return {
    code: payload.code ?? `HTTP_${error.status}`,
    error: isStaleError(error.status, payload.code)
      ? `${message} Reload the selected policy and review the current receipt before retrying.`
      : message,
    fieldErrors: apiErrorField(payload.code)
      ? { [apiErrorField(payload.code)!]: message }
      : undefined,
    status: 'error',
    values: formValues(formData),
  };
}

function validationField(message: string) {
  if (message.startsWith('Effective to')) return 'effectiveTo';
  if (message.startsWith('Effective from')) return 'effectiveFrom';
  if (message.startsWith('Fallback withholding rate')) return 'defaultRatePercent';
  if (message.startsWith('Promulgated date')) return 'promulgatedDate';
  if (message.startsWith('Withholding rate')) return 'ratePercent';
  if (message.includes('service type')) return 'serviceType';
  if (message.includes('Min amount')) return 'minGrossAmount';
  if (message.includes('Max amount')) return 'maxGrossAmount';
  if (message.includes('Fixed amount')) return 'fixedAmount';
  if (message.includes('scope')) return 'scope';
  return undefined;
}

function apiErrorField(code?: string) {
  if (code === 'TAX_POLICY_CLEAN_SOURCE_ACKNOWLEDGEMENT_REQUIRED') {
    return 'cleanSourceAcknowledged';
  }
  return undefined;
}

function formValues(formData: FormData) {
  return Object.fromEntries(
    [...formData.entries()]
      .filter(([, value]) => typeof value === 'string')
      .map(([key, value]) => [key, String(value)]),
  );
}

function isStaleError(status: number, code?: string) {
  return status === 409 || status === 422 || Boolean(code?.includes('STALE') || code?.includes('CONFLICT'));
}

class TaxPolicyFormError extends Error {
  constructor(message: string, readonly field: string) {
    super(message);
  }
}

function apiErrorPayload(payload: unknown): { code?: string; message?: string } {
  if (!payload || typeof payload !== 'object') return {};
  const value = payload as Record<string, unknown>;
  const nested = value.message && typeof value.message === 'object'
    ? (value.message as Record<string, unknown>)
    : value;
  return {
    code: typeof nested.code === 'string' ? nested.code : undefined,
    message: typeof nested.message === 'string'
      ? nested.message
      : typeof value.message === 'string'
        ? value.message
        : undefined,
  };
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
  const rateBps = parseRatePercent(formData.get('ratePercent'), 'Withholding rate', true)!;
  const fixedAmount = parseInteger(formData.get('fixedAmount')) ?? 0;

  if (!taxRuleScopes.has(scope)) throw new Error('Tax rule scope is invalid.');
  if (fixedAmount < 0) throw new Error('Fixed amount must be zero or greater.');
  if (minGrossAmount !== null && minGrossAmount < 0) throw new Error('Min amount must be zero or greater.');
  if (maxGrossAmount !== null && maxGrossAmount < 0) throw new Error('Max amount must be zero or greater.');
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
