import { readFileSync } from 'node:fs';

describe('payment page presenters', () => {
  it('uses the shared operational signal atom for payment ops hints', () => {
    const source = readFileSync('app/payments/payment-page-presenters.tsx', 'utf8');

    expect(source).toContain('AdminNotePanel');
    expect(source).toContain('AdminStageItem');
    expect(source).toContain('AdminSignal');
    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('<div className="ops-task-note admin-mt-8">');
    expect(source).not.toContain('className="setup-stage-item"');
    expect(source).not.toContain('<span className="signal signal-warn">Callback check</span>');
    expect(source).not.toContain('<span className="signal signal-warn">Cash fee debt</span>');
    expect(source).not.toContain('<span className="signal signal-info">Cash collection</span>');
    expect(source).not.toContain('<span className="signal signal-ok">Settled</span>');
    expect(source).not.toContain('<strong>{formatDateTime(callback.receivedAt)}</strong>');
  });
});
