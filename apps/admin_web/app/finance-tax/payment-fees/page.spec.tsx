import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import PaymentFeesPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});
vi.mock('../../../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn(),
}));

const mockedAdminGet = vi.mocked(adminGet);
const mockedGetCurrentAdminOperatorAccess = vi.mocked(getCurrentAdminOperatorAccess);
const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

describe('PaymentFeesPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue(null);
  });

  it('keeps the period filter on shared AdminForm atoms', async () => {
    const page = await PaymentFeesPage({
      searchParams: Promise.resolve({ period: '2026-06' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Payment fee period');
    expect(markup).toContain('Active payment fee filters');
    expect(markup).toContain('Period: 2026-06');
    expect(markup).toContain('Currency: VND');
    expect(markup).toContain('Fee command board');
    expect(markup).toContain('Processing fee');
    expect(markup).toContain('Customer paid');
    expect(markup).toContain('Evidence review');
    expect(markup).toContain('Historical remediation preview');
    expect(markup).toContain('Active payment fee policy');
    expect(markup).toContain('Payment fee policy drafts');
    expect(markup).toContain('Payment fee policy history');
    expect(markup).toContain('Create draft');
    expect(markup).toContain('No active policy');
    expect(markup).toContain('Active policy missing');
    expect(markup).toContain('card admin-filter-panel admin-mb-16');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('admin-form-control-labeled');
    expect(markup).toContain('admin-form-label');
    expect(markup).toContain('admin-form-control-button');
    expect(markup).not.toContain('card admin-card-scroll');
    expect(markup).not.toContain('class="form-input"');
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/payment-fee-policies?take=20', []);
    expect(mockedAdminGet).not.toHaveBeenCalledWith(
      expect.stringContaining('finance-approver-directory'),
      expect.anything(),
    );
  });

  it('keeps the payment fee period compact by avoiding duplicated page-template metrics', () => {
    expect(source).toContain('<FinanceListCommandBoard ariaLabel="Fee command board">');
    expect(source).not.toContain('metrics={[');
  });

  it('keeps payment fee CSV download off the page payload', () => {
    expect(source).toContain('buildPaymentFeeExportHref');
    expect(source).not.toContain('data:text/csv');
    expect(source).not.toContain('buildPaymentFeeSummaryCsvHref');
  });

  it('uses the summary currency in every payment fee breakdown table', async () => {
    const summary = {
      byPayer: [
        {
          customerPaymentAmountTotal: 1000,
          paymentFeePayer: 'HANDS',
          paymentProcessingFeeTotal: 30,
          settlementCount: 1,
        },
      ],
      byPaymentMethod: [
        {
          customerPaymentAmountTotal: 1000,
          paymentMethod: 'CARD',
          paymentProcessingFeeTotal: 30,
          settlementCount: 1,
          evidenceReviewCount: 1,
          evidenceCustomerPaymentAmountTotal: 1000,
          evidenceRecordedFeeTotal: 30,
          remediationExpectedFeeTotal: null,
          remediationDelta: null,
        },
      ],
      byTreatment: [
        {
          customerPaymentAmountTotal: 1000,
          paymentFeeTreatment: 'OPERATING_EXPENSE',
          paymentProcessingFeeTotal: 30,
          settlementCount: 1,
        },
      ],
      currency: 'USD',
      customerPaymentAmountTotal: 1000,
      paymentProcessingFeeTotal: 30,
      period: '2026-06',
      policyReadiness: {
        activePolicy: {
          effectiveFrom: '2026-01-01T00:00:00.000Z',
          effectiveTo: null,
          id: 'payment-fee-policy-2026',
          name: 'HANDS payment fee policy',
          rules: [
            {
              feeType: 'RATE',
              fixedAmount: 0,
              id: 'payment-fee-rule-card',
              method: 'CARD',
              payer: 'HANDS',
              rateBps: 150,
              treatment: 'OPERATING_EXPENSE',
            },
          ],
          status: 'ACTIVE',
        },
        configuredMethods: ['CARD'],
        missingMethods: ['MOMO', 'VNPAY', 'CASH', 'BANK_TRANSFER', 'CUSTOMER_WALLET', 'MANUAL'],
        status: 'MISSING_METHOD_RULES',
      },
      remediationPreview: {
        status: 'BLOCKED',
        policyVersionId: 'payment-fee-policy-2026',
        blockers: [
          {
            code: 'MISSING_METHOD_RULE',
            message: 'Historical preview requires exactly one active MOMO rule.',
          },
        ],
        evidenceReviewCount: 1,
        evidenceCustomerPaymentAmountTotal: 1000,
        recordedFeeTotal: 30,
        expectedFeeTotal: null,
        delta: null,
      },
      settlementCount: 1,
    };
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      href.startsWith('/admin/payment-fees/summary') ? summary : fallback,
    );

    const page = await PaymentFeesPage({
      searchParams: Promise.resolve({ period: '2026-06' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('1.000 USD');
    expect(markup).toContain('30 USD');
    expect(markup).toContain('Effective rate');
    expect(markup).toContain('3%');
    expect(markup).toContain('Active payment fee policy');
    expect(markup).toContain('HANDS payment fee policy');
    expect(markup).toContain('Method rules missing');
    expect(markup).toContain('MOMO, VNPAY, CASH, BANK_TRANSFER, CUSTOMER_WALLET, MANUAL');
    expect(markup).toContain('Example rates in tests are not production policy');
    expect(markup).toContain('Historical remediation preview');
    expect(markup).toContain('Preview blocked');
    expect(markup).toContain('Policy required');
    expect(markup).toContain('1 review');
    expect(markup).toContain('paymentMethod=CARD');
    expect(markup).not.toContain('1.000 VND');
    expect(markup).not.toContain('30 VND');
  });

  it('renders a governed draft editor with full method coverage and separate approval', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/payment-fee-policies?take=20') {
        return [
          {
            id: 'payment-fee-policy-draft',
            name: 'Gateway contract 2026',
            status: 'DRAFT',
            effectiveFrom: '2026-01-01T00:00:00.000Z',
            effectiveTo: null,
            notes: 'Contract evidence pending approval',
            createdById: 'maker-admin',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            createdBy: { id: 'maker-admin', fullName: 'Policy Maker', email: 'maker@example.test' },
            rules: [
              {
                id: 'rule-card',
                method: 'CARD',
                feeType: 'RATE',
                rateBps: 150,
                fixedAmount: 0,
                payer: 'HANDS',
                treatment: 'OPERATING_EXPENSE',
                active: true,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
        ];
      }
      if (href.includes('role=FINANCE_APPROVER')) {
        return [{ id: 'approver-admin', phone: 'hidden', fullName: 'Finance Approver', roles: ['FINANCE_APPROVER'] }];
      }
      if (href === '/admin/payment-fee-policies/payment-fee-policy-draft/preflight?sampleAmount=100000') {
        return {
          policyId: 'payment-fee-policy-draft',
          policyStatus: 'DRAFT',
          sampleAmount: 100000,
          currency: 'VND',
          readyForActivation: false,
          blockers: [
            { code: 'MISSING_METHOD_RULE', method: 'MOMO', message: 'Payment fee policy requires exactly one active MOMO rule' },
          ],
          coverage: {
            requiredMethods: 7,
            configuredMethods: 1,
            missingMethods: ['MOMO', 'VNPAY', 'CASH', 'BANK_TRANSFER', 'CUSTOMER_WALLET', 'MANUAL'],
            duplicateMethods: [],
            invalidMethods: [],
          },
          rules: [
            {
              method: 'CARD',
              ruleCount: 1,
              feeType: 'RATE',
              rateBps: 150,
              fixedAmount: 0,
              payer: 'HANDS',
              treatment: 'OPERATING_EXPENSE',
              estimatedFeeAmount: 1500,
              status: 'READY',
            },
          ],
        };
      }
      return fallback;
    });

    const page = await PaymentFeesPage({
      searchParams: Promise.resolve({
        period: '2026-06',
        policyId: 'payment-fee-policy-draft',
        method: 'CARD',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Draft policy editor');
    expect(markup).toContain('Gateway contract 2026');
    expect(markup).toContain('1/7 rules ready');
    expect(markup).toContain('Save CARD rule');
    expect(markup).toContain('1.500 VND');
    expect(markup).toContain('1 activation blocker(s)');
    expect(markup).toContain('Finance Approver');
    expect(markup).toContain('Contract and pricing evidence');
    expect(markup).toContain('Request Finance approval');
    expect(markup).not.toContain('Approve and activate policy');
    expect(markup).toContain('Corrections require a new DRAFT version');
  });

  it('only offers activation to the different signed-in Finance Approver on a current request', async () => {
    const methods = ['MOMO', 'VNPAY', 'CASH', 'CARD', 'BANK_TRANSFER', 'CUSTOMER_WALLET', 'MANUAL'];
    let approvalState = {
      policyId: 'payment-fee-policy-draft',
      status: 'REQUESTED',
      requestId: 'approval-request-1',
      requestedAt: '2026-07-13T12:00:00.000Z',
      requestedBy: { id: 'maker-admin', fullName: 'Policy Maker', email: 'maker@example.test' },
      decisionAt: null as string | null,
      decidedBy: null as { id: string; fullName: string; email: string } | null,
      reason: 'Independent review requested',
    };
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      id: 'approver-admin',
      email: 'approver@example.test',
      fullName: 'Finance Approver',
      phone: null,
      roles: ['ADMIN', 'FINANCE_APPROVER'],
      categories: ['FINANCE'],
    });
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/payment-fee-policies?take=20') {
        return [
          {
            id: 'payment-fee-policy-draft',
            name: 'Gateway contract 2026',
            status: 'DRAFT',
            effectiveFrom: '2026-01-01T00:00:00.000Z',
            effectiveTo: null,
            notes: 'Signed gateway contract and pricing schedule',
            createdById: 'maker-admin',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            createdBy: { id: 'maker-admin', fullName: 'Policy Maker', email: 'maker@example.test' },
            rules: methods.map((method) => ({
              id: `rule-${method}`,
              method,
              feeType: 'RATE',
              rateBps: method === 'CARD' ? 150 : 0,
              fixedAmount: 0,
              payer: 'HANDS',
              treatment: 'OPERATING_EXPENSE',
              active: true,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            })),
          },
        ];
      }
      if (href.endsWith('/preflight?sampleAmount=100000')) {
        return {
          policyId: 'payment-fee-policy-draft',
          policyStatus: 'DRAFT',
          sampleAmount: 100000,
          currency: 'VND',
          readyForActivation: true,
          blockers: [],
          coverage: {
            requiredMethods: 7,
            configuredMethods: 7,
            missingMethods: [],
            duplicateMethods: [],
            invalidMethods: [],
          },
          rules: methods.map((method) => ({
            method,
            ruleCount: 1,
            feeType: 'RATE',
            rateBps: method === 'CARD' ? 150 : 0,
            fixedAmount: 0,
            payer: 'HANDS',
            treatment: 'OPERATING_EXPENSE',
            estimatedFeeAmount: method === 'CARD' ? 1500 : 0,
            status: 'READY',
          })),
        };
      }
      if (href.endsWith('/approval')) {
        return approvalState;
      }
      return fallback;
    });

    const page = await PaymentFeesPage({
      searchParams: Promise.resolve({
        confirm: 'activate',
        period: '2026-07',
        policyId: 'payment-fee-policy-draft',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Approval requested');
    expect(markup).toContain('Requested by Policy Maker');
    expect(markup).toContain('Confirm policy activation');
    expect(markup).toContain('type="hidden" name="approvalAdminId" value="approver-admin"');
    expect(markup).toContain('name="confirmationPolicyId" value="payment-fee-policy-draft"');
    expect(markup).toContain('Approval decision evidence');
    expect(markup).toContain('Approve and activate policy');
    expect(markup).toContain('Review rejection');
    expect(markup).not.toContain('Review cancellation');
    expect(markup).not.toContain('Request Finance approval');

    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      id: 'maker-admin',
      email: 'maker@example.test',
      fullName: 'Policy Maker',
      phone: null,
      roles: ['ADMIN', 'FINANCE_APPROVER'],
      categories: ['FINANCE'],
    });
    const makerPage = await PaymentFeesPage({
      searchParams: Promise.resolve({
        period: '2026-07',
        policyId: 'payment-fee-policy-draft',
      }),
    });
    const makerMarkup = renderToStaticMarkup(makerPage);

    expect(makerMarkup).toContain('Review cancellation');
    expect(makerMarkup).not.toContain('Approve and activate policy');
    expect(makerMarkup).not.toContain('Review rejection');

    approvalState = {
      ...approvalState,
      status: 'REJECTED',
      decisionAt: '2026-07-13T13:00:00.000Z',
      decidedBy: {
        id: 'approver-admin',
        fullName: 'Finance Approver',
        email: 'approver@example.test',
      },
      reason: 'CARD fee differs from the signed schedule',
    };
    const rejectedPage = await PaymentFeesPage({
      searchParams: Promise.resolve({
        period: '2026-07',
        policyId: 'payment-fee-policy-draft',
      }),
    });
    const rejectedMarkup = renderToStaticMarkup(rejectedPage);

    expect(rejectedMarkup).toContain('Approval rejected');
    expect(rejectedMarkup).toContain('CARD fee differs from the signed schedule');
    expect(rejectedMarkup).toContain('Review approval request');
    expect(rejectedMarkup).not.toContain('Review cancellation');
  });
});
