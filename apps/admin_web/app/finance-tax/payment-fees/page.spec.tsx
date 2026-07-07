import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import PaymentFeesPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

describe('PaymentFeesPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('keeps the period filter on shared AdminForm atoms', async () => {
    const page = await PaymentFeesPage({
      searchParams: Promise.resolve({ period: '2026-06' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Payment fee period');
    expect(markup).toContain('Fee command board');
    expect(markup).toContain('Processing fee');
    expect(markup).toContain('Customer paid');
    expect(markup).toContain('Fee methods');
    expect(markup).toContain('Fees by payment method');
    expect(markup).toContain('card admin-filter-panel admin-mb-16');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('admin-form-control-labeled');
    expect(markup).toContain('admin-form-label');
    expect(markup).toContain('admin-form-control-button');
    expect(markup).not.toContain('card admin-card-scroll');
    expect(markup).not.toContain('class="form-input"');
  });

  it('keeps the payment fee period compact by avoiding duplicated page-template metrics', () => {
    expect(source).toContain('<FinanceListCommandBoard ariaLabel="Fee command board">');
    expect(source).not.toContain('metrics={[');
  });

  it('uses the summary currency in every payment fee breakdown table', async () => {
    mockedAdminGet.mockResolvedValue({
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
      settlementCount: 1,
    });

    const page = await PaymentFeesPage({
      searchParams: Promise.resolve({ period: '2026-06' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('1.000 USD');
    expect(markup).toContain('30 USD');
    expect(markup).toContain('Effective rate');
    expect(markup).toContain('3%');
    expect(markup).not.toContain('1.000 VND');
    expect(markup).not.toContain('30 VND');
  });
});
