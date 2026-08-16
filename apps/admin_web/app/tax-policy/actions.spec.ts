import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { vi } from 'vitest';

import {
  AdminApiRequestError,
  adminPatchOrThrow,
  adminPostOrThrow,
} from '../../lib/admin-api';
import {
  createTaxPolicyVersion,
  createTaxRule,
  decideTaxPolicyApprovalRequest,
  submitTaxPolicyApprovalRequest,
  updateTaxPolicyVersion,
} from './actions';
import { INITIAL_TAX_POLICY_ACTION_STATE } from './action-state';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../lib/admin-api', () => ({
  AdminApiRequestError: class AdminApiRequestError extends Error {
    constructor(
      readonly method: string,
      readonly path: string,
      readonly status: number,
      readonly payload?: unknown,
    ) {
      super('request failed');
    }
  },
  adminPatchOrThrow: vi.fn(),
  adminPostOrThrow: vi.fn(),
}));

const mockedAdminPatch = vi.mocked(adminPatchOrThrow);
const mockedAdminPost = vi.mocked(adminPostOrThrow);
const mockedRedirect = vi.mocked(redirect);
const mockedRevalidatePath = vi.mocked(revalidatePath);

function validPolicyForm() {
  const formData = new FormData();
  formData.set('name', ' Vietnam withholding 2027 ');
  formData.set('effectiveFrom', '2027-01-01T00:00');
  formData.set('promulgatedDate', '2026-12-01');
  formData.set('legalSourceTitle', ' Decree 01/2027 ');
  formData.set('legalSourceUrl', ' https://example.gov.vn/decree-01 ');
  formData.set('taxSubject', ' Independent massage Partners ');
  formData.set('changeSummary', ' Apply the reviewed five percent withholding rule. ');
  formData.set('operatorReason', ' Prepared from the attached legal source and Finance review. ');
  formData.set('defaultRatePercent', '5');
  return formData;
}

describe('tax policy server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPatch.mockResolvedValue({} as never);
    mockedAdminPost.mockResolvedValue({ id: 'policy-1' } as never);
  });

  it('creates a draft and optional default rule in one API request using Vietnam time', async () => {
    await createTaxPolicyVersion(INITIAL_TAX_POLICY_ACTION_STATE, validPolicyForm());

    expect(mockedAdminPost).toHaveBeenCalledTimes(1);
    expect(mockedAdminPost).toHaveBeenCalledWith('/admin/tax-policy-versions', {
      changeSummary: 'Apply the reviewed five percent withholding rule.',
      defaultRateBps: 500,
      effectiveFrom: '2026-12-31T17:00:00.000Z',
      legalSourceTitle: 'Decree 01/2027',
      legalSourceUrl: 'https://example.gov.vn/decree-01',
      name: 'Vietnam withholding 2027',
      notes: null,
      operatorReason: 'Prepared from the attached legal source and Finance review.',
      promulgatedDate: '2026-11-30T17:00:00.000Z',
      status: 'DRAFT',
      supersedesPolicyVersionId: null,
      taxSubject: 'Independent massage Partners',
    });
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/tax-policy');
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/tax-policy?taxPolicyNotice=draft-created&view=drafts&policyId=policy-1#tax-policy-policy-1',
    );
  });

  it('saves only a draft and keeps Vietnam effective window instants stable', async () => {
    const formData = validPolicyForm();
    formData.set('policyId', 'policy-1');
    formData.set('effectiveTo', '2027-12-31T23:59');

    await updateTaxPolicyVersion(INITIAL_TAX_POLICY_ACTION_STATE, formData);

    expect(mockedAdminPatch).toHaveBeenCalledWith(
      '/admin/tax-policy-versions/policy-1',
      expect.objectContaining({
        status: 'DRAFT',
        effectiveFrom: '2026-12-31T17:00:00.000Z',
        effectiveTo: '2027-12-31T16:59:00.000Z',
      }),
    );
  });

  it('does not call the API when the Vietnam effective window is invalid', async () => {
    const formData = validPolicyForm();
    formData.set('policyId', 'policy-1');
    formData.set('effectiveTo', '2026-12-31T23:59');

    const state = await updateTaxPolicyVersion(INITIAL_TAX_POLICY_ACTION_STATE, formData);

    expect(mockedAdminPatch).not.toHaveBeenCalled();
    expect(mockedRedirect).not.toHaveBeenCalled();
    expect(state).toMatchObject({
      error: 'Effective to must be after effective from.',
      fieldErrors: { effectiveTo: 'Effective to must be after effective from.' },
      status: 'error',
      values: expect.objectContaining({ name: ' Vietnam withholding 2027 ', policyId: 'policy-1' }),
    });
  });

  it('submits durable approval without a selected approver id', async () => {
    const formData = new FormData();
    formData.set('policyId', 'policy-1');
    formData.set('idempotencyKey', 'tax-policy-policy-1-request-1');
    formData.set('operatorReason', 'Submit the immutable reviewed policy payload for checker review.');

    await submitTaxPolicyApprovalRequest(INITIAL_TAX_POLICY_ACTION_STATE, formData);

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/tax-policy-versions/policy-1/approval-requests',
      {
        cleanSourceAcknowledged: false,
        idempotencyKey: 'tax-policy-policy-1-request-1',
        operatorReason: 'Submit the immutable reviewed policy payload for checker review.',
      },
    );
  });

  it('records a checker decision from the signed-in operator', async () => {
    const formData = new FormData();
    formData.set('requestId', 'request-1');
    formData.set('policyId', 'policy-1');
    formData.set('decision', 'APPROVE');
    formData.set('decisionReason', 'Legal source and proposed rules match the approved Finance schedule.');

    await decideTaxPolicyApprovalRequest(INITIAL_TAX_POLICY_ACTION_STATE, formData);

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/tax-policy-approval-requests/request-1/decision',
      {
        decision: 'APPROVE',
        decisionReason: 'Legal source and proposed rules match the approved Finance schedule.',
      },
    );
  });

  it('surfaces stable API conflict codes instead of swallowing mutation errors', async () => {
    mockedAdminPost.mockRejectedValueOnce(
      new AdminApiRequestError('POST', '/admin/tax-policy-versions', 409, {
        message: {
          code: 'TAX_POLICY_IMMUTABLE',
          message: 'Only unreferenced draft tax policies can be edited.',
        },
      }),
    );

    const state = await createTaxPolicyVersion(INITIAL_TAX_POLICY_ACTION_STATE, validPolicyForm());

    expect(mockedRedirect).not.toHaveBeenCalled();
    expect(state).toMatchObject({
      code: 'TAX_POLICY_IMMUTABLE',
      error: 'Only unreferenced draft tax policies can be edited. Reload the selected policy and review the current receipt before retrying.',
      status: 'error',
      values: expect.objectContaining({ legalSourceTitle: ' Decree 01/2027 ' }),
    });
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it('associates clean-source acknowledgement failures with the confirmation field', async () => {
    mockedAdminPost.mockRejectedValueOnce(
      new AdminApiRequestError('POST', '/admin/tax-policy-versions/policy-1/approval-requests', 400, {
        message: {
          code: 'TAX_POLICY_CLEAN_SOURCE_ACKNOWLEDGEMENT_REQUIRED',
          message: 'Confirm the clean production source review.',
        },
      }),
    );
    const formData = new FormData();
    formData.set('policyId', 'policy-1');
    formData.set('idempotencyKey', 'tax-policy-policy-1-request-2');
    formData.set('operatorReason', 'Submit independently reviewed production evidence.');

    const state = await submitTaxPolicyApprovalRequest(INITIAL_TAX_POLICY_ACTION_STATE, formData);

    expect(state).toMatchObject({
      code: 'TAX_POLICY_CLEAN_SOURCE_ACKNOWLEDGEMENT_REQUIRED',
      fieldErrors: { cleanSourceAcknowledged: 'Confirm the clean production source review.' },
      status: 'error',
    });
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('validates scoped rule inputs before calling the API', async () => {
    const formData = new FormData();
    formData.set('policyId', 'policy-1');
    formData.set('scope', 'SERVICE_TYPE');
    formData.set('ratePercent', '5');

    const state = await createTaxRule(INITIAL_TAX_POLICY_ACTION_STATE, formData);

    expect(mockedAdminPost).not.toHaveBeenCalled();
    expect(state).toMatchObject({ status: 'error', fieldErrors: { serviceType: expect.any(String) } });
  });

  it('rejects percentage precision that cannot round-trip to basis points', async () => {
    const formData = validPolicyForm();
    formData.set('defaultRatePercent', '5.555');

    const state = await createTaxPolicyVersion(INITIAL_TAX_POLICY_ACTION_STATE, formData);

    expect(mockedAdminPost).not.toHaveBeenCalled();
    expect(state).toMatchObject({
      status: 'error',
      fieldErrors: { defaultRatePercent: expect.any(String) },
      values: expect.objectContaining({ defaultRatePercent: '5.555' }),
    });
  });
});
