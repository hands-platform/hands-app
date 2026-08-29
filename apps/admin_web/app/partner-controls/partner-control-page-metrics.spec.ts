import { buildPartnerControlPageMetrics } from './partner-control-page-metrics';

describe('partner control page metrics', () => {
  it('maps the four operating metrics to exact workspaces and policy copy', () => {
    expect(
      buildPartnerControlPageMetrics([
        ['Reports needing review', '2'],
        ['Active restrictions', '1'],
        ['Debt gates', '3'],
        ['Overdue', '4'],
      ], undefined, { overdue: 4, urgent: 1 }),
    ).toEqual([
      expect.objectContaining({
        helper:
          'Open and investigating reports that still need an operator decision. Urgent 1 · overdue 4.',
        href: '/partner-controls?details=reports',
        kind: 'risk',
        label: 'Reports needing review',
        scope: 'All partners',
        scopeKind: 'record',
        value: '2',
      }),
      expect.objectContaining({
        href: '/partner-controls?details=sanctions',
        label: 'Active restrictions',
      }),
      expect.objectContaining({
        helper: 'Negative wallet gates final acceptance, service start, and payout release.',
        href: '/partner-controls?details=controls&review=cash-debt',
        kind: 'risk',
        label: 'Debt gates',
        scopeKind: 'record',
      }),
      expect.objectContaining({
        href: '/partner-controls?details=reports&review=overdue&sort=oldest',
        label: 'Overdue',
      }),
    ]);
  });

  it('distinguishes true zero and unavailable totals', () => {
    expect(buildPartnerControlPageMetrics([['Reports needing review', '0']])[0]).toMatchObject({
      kind: 'live',
    });
    expect(buildPartnerControlPageMetrics([['Reports needing review', 'Unavailable']])[0]).toMatchObject({
      kind: 'record',
    });
  });
});
