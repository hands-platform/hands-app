import { FinanceTablePanel } from './finance-table-panel';

describe('FinanceTablePanel', () => {
  it('uses the Vuexy grouped table panel surface by default', () => {
    const panel = FinanceTablePanel({
      children: 'Finance table',
      resultLabel: '1 row',
      resultTone: 'info',
      title: 'Finance rows',
    });

    expect(readRecord(panel.props)?.className).toBe(
      'booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group',
    );
  });
});

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
