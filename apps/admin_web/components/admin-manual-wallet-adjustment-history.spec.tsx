import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import type { AdminManualWalletAdjustmentRow } from '../lib/admin-api';
import { AdminManualWalletAdjustmentHistory } from './admin-manual-wallet-adjustment-history';

const componentSource = readFileSync('components/admin-manual-wallet-adjustment-history.tsx', 'utf8');

describe('AdminManualWalletAdjustmentHistory', () => {
  it('renders bounded manual wallet adjustment rows with accounting context', () => {
    const rows: AdminManualWalletAdjustmentRow[] = [
      {
        adjustmentType: 'PARTNER_BONUS',
        afterBalance: 250000,
        amount: 200000,
        approvalId: 'approval-123',
        beforeBalance: 50000,
        createdAt: '2026-06-29T03:00:00.000Z',
        currency: 'VND',
        direction: 'CREDIT',
        id: 'wallet-adjustment-1',
        ledgerType: 'PARTNER_WALLET',
        ownerId: 'provider-1',
        ownerLabel: 'Smoke Partner',
        ownerPhone: '+84900000000',
        ownerType: 'PARTNER',
        reason: 'Manual bonus approved by ops.',
        sourceKey: 'provider-wallet-ledger',
        walletDelta: 200000,
      },
    ];

    const markup = renderToStaticMarkup(
      <AdminManualWalletAdjustmentHistory
        rows={rows}
        walletAdjustmentsHref="/wallet-adjustments?ownerType=PARTNER&ownerId=provider-1"
      />,
    );

    expect(markup).toContain('Recent manual wallet adjustments');
    expect(markup).toContain(
      'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group',
    );
    expect(markup).toContain('Smoke Partner');
    expect(markup).toContain('PARTNER_BONUS');
    expect(markup).toContain('approval-123');
    expect(markup).toContain('date-time-text');
    expect(markup).toContain('money-text money-text-positive');
    expect(markup.match(/<span class="money-text/g)).toHaveLength(4);
    expect(markup).toContain('50.000 VND');
    expect(markup).toContain('250.000 VND');
    expect(markup).toContain('/wallet-adjustments?ownerType=PARTNER&amp;ownerId=provider-1');
    expect(componentSource).toContain('MoneyText');
    expect(componentSource).toContain('DateTimeText');
    expect(componentSource).toContain('AdminTablePanel');
    expect(componentSource).toContain('AdminInlineFallback');
    expect(componentSource).not.toContain(
      "className = 'admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group'",
    );
    expect(componentSource).not.toContain(
      '<p className="muted">{row.attachmentUrl ? \'Attachment saved\' : \'No attachment\'}</p>',
    );
    expect(componentSource).not.toContain('<strong>{formatMoney(row.amount, row.currency)}</strong>');
    expect(componentSource).not.toContain('<p className="muted">Delta {formatMoney(row.walletDelta, row.currency)}</p>');
    expect(componentSource).not.toContain('<strong>{formatDateTime(row.createdAt)}</strong>');
  });
});
