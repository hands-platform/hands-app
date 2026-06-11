import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingBackupAlertTraceDisplay,
  bookingBackupAlertTraceLabel,
  bookingBackupAlertTracePill,
  bookingBackupAlertTraceSummary,
  bookingBackupAlertTraceTone,
} from './booking-alert-trace';

describe('booking alert trace adapters', () => {
  it('summarizes retained marketplace alert traces with age labels', () => {
    const booking = bookingWithTrace('OPEN_MATCHING');
    const nowMs = Date.parse('2026-06-07T01:15:00.000Z');

    expect(bookingBackupAlertTraceSummary(booking, nowMs)).toEqual({
      batchCount: 2,
      totalNotified: 5,
      lastStage: 'retry',
      lastCreatedAt: '2026-06-07T01:10:00.000Z',
      lastAge: '5m ago',
    });
  });

  it('builds display labels and pills from alert trace summaries', () => {
    const booking = bookingWithTrace('OPEN_MATCHING');
    const nowMs = Date.parse('2026-06-07T01:15:00.000Z');

    expect(bookingBackupAlertTraceLabel(booking, nowMs)).toBe(
      'Marketplace alerts: 5 notified / 2 batch(es) / last 5m ago',
    );
    expect(bookingBackupAlertTracePill(booking)).toBe('5 marketplace alert(s)');
    expect(bookingBackupAlertTraceTone(booking)).toBe('pill-success');
    expect(bookingBackupAlertTraceDisplay(booking, nowMs)).toMatchObject({
      tone: 'pill-success',
    });
  });

  it('keeps open matching with no trace in danger state', () => {
    const booking = { status: 'OPEN_MATCHING', metadata: {} } as AdminBooking;

    expect(bookingBackupAlertTraceDisplay(booking)).toEqual({
      label: 'Marketplace alerts: no batch recorded',
      pill: 'No marketplace trace',
      tone: 'pill-danger',
    });
  });
});

function bookingWithTrace(status: string): AdminBooking {
  return {
    status,
    metadata: {
      backupNotificationTraces: [
        { notifiedCount: 2, stage: 'initial_open', createdAt: '2026-06-07T01:00:00.000Z' },
        { notifiedCount: '3', stage: 'retry', createdAt: '2026-06-07T01:10:00.000Z' },
      ],
    },
  } as AdminBooking;
}
