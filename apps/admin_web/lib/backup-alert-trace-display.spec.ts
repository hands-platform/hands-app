import {
  backupAlertTraceDisplayFromSummary,
  type BackupAlertTraceDisplayInput,
} from './backup-alert-trace-display';

const baseInput: BackupAlertTraceDisplayInput = {
  batchCount: 0,
  bookingStatus: 'OPEN_MATCHING',
  lastAge: null,
  totalNotified: 0,
};

describe('backupAlertTraceDisplayFromSummary', () => {
  it('returns danger display when open matching has no marketplace trace', () => {
    expect(backupAlertTraceDisplayFromSummary(baseInput)).toEqual({
      label: 'Marketplace alerts: no batch recorded',
      pill: 'No marketplace trace',
      tone: 'pill-danger',
    });
  });

  it('returns neutral display when non-open booking has no marketplace trace', () => {
    expect(
      backupAlertTraceDisplayFromSummary({
        ...baseInput,
        bookingStatus: 'MATCHED',
      }),
    ).toEqual({
      label: 'Marketplace alerts: no batch recorded',
      pill: 'No marketplace trace',
      tone: 'pill-neutral',
    });
  });

  it('returns success display when marketplace alerts notified partners', () => {
    expect(
      backupAlertTraceDisplayFromSummary({
        ...baseInput,
        batchCount: 2,
        lastAge: '3m old',
        totalNotified: 5,
      }),
    ).toEqual({
      label: 'Marketplace alerts: 5 notified / 2 batch(es) / last 3m old',
      pill: '5 marketplace alert(s)',
      tone: 'pill-success',
    });
  });

  it('returns warning display when batches exist but no partner was notified', () => {
    expect(
      backupAlertTraceDisplayFromSummary({
        ...baseInput,
        batchCount: 1,
      }),
    ).toEqual({
      label: 'Marketplace alerts: 1 batch(es), no eligible partner notified',
      pill: 'Marketplace trace empty',
      tone: 'pill-warn',
    });
  });
});
