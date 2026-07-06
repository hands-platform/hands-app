import { readFileSync } from 'node:fs';

import { classNamesIn, hrefsIn, normalizedText } from '../booking-section-test-utils';
import type { AdminBookingDetail } from '../../../lib/admin-api';
import { BookingOperatorQueueSections, BookingOpsCommandCenter } from './booking-operator-sections';

describe('BookingOperatorQueueSections', () => {
  it('uses the shared Vuexy empty-state atom for missing payment actions', () => {
    const source = readFileSync('app/bookings/[id]/booking-operator-sections.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).not.toContain('<strong>No payment action available</strong>');
  });

  it('uses shared Vuexy badge atoms instead of raw operator pill spans', () => {
    const source = readFileSync('app/bookings/[id]/booking-operator-sections.tsx', 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
    expect(source).toContain('AdminNotePanel');
    expect(source).toContain('AdminSectionHeader');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="ops-section-header">');
    expect(source).not.toContain('<div className="ops-task-note admin-mt-14">');
    expect(source).not.toContain('actions={<span className={`pill ${operatorCommandQueue.tone}`}>{operatorCommandQueue.status}</span>}');
    expect(source).not.toContain('<span className="pill pill-info">');
    expect(source).not.toContain('<span className={`pill ${row.tone}`}>{row.status}</span>');
    expect(source).not.toContain('<span className={`pill ${badge.tone}`} key={badge.label}>');
    expect(source).not.toContain('<span className={`pill ${finalGateReason.pillClass}`}>Booking gate reason</span>');
    expect(source).not.toContain('<span className={`pill ${actionEvidenceGate.tone}`}>{actionEvidenceGate.status}</span>');
    expect(source).not.toContain('<span className={`pill ${row.pillClass}`}>{row.status}</span>');
    expect(source).not.toContain('<span className="pill pill-neutral">Locked</span>');
  });

  it('uses shared Vuexy card atoms for booking operation gate cards', () => {
    const source = readFileSync('app/bookings/[id]/booking-operator-sections.tsx', 'utf8');

    expect(source).toContain('AdminActionCard');
    expect(source).toContain('AdminTaskCard');
    expect(source).not.toContain('className={`ops-task-card ${finalGateReason.className}`');
    expect(source).not.toContain('<a className={`ops-task-card ${row.className}`');
    expect(source).not.toContain('<div className="action-button-card ops-task-blocked"');
  });

  it('renders command queue and action availability table with shared table styling', () => {
    const section = BookingOperatorQueueSections({
      bookingId: 'booking-1',
      operatorActionMatrix: [
        {
          action: 'Payment capture',
          available: true,
          evidence: 'Payment is authorized.',
          href: '#booking-ops',
          hrefLabel: 'Open gate',
          operatorRule: 'Capture only after Partner completion evidence.',
          status: 'Available',
          tone: 'pill-success',
        },
      ],
      operatorCommandQueue: {
        commands: [
          {
            action: {
              href: '#booking-ops',
              label: 'Open ops',
              type: 'link',
            },
            detail: 'Review the manual action gate.',
            id: 'command-1',
            label: '1',
            owner: 'Ops',
            title: 'Check payment gate',
            tone: 'pill-info',
          },
        ],
        labels: [
          {
            helper: 'One same-shift action.',
            label: 'Queued',
            value: '1',
          },
        ],
        status: 'Action needed',
        tone: 'pill-warn',
      },
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Operator command queue');
    expect(rendered).toContain('Check payment gate');
    expect(rendered).toContain('Operator action availability');
    expect(rendered).toContain('1 / 1 available');
    expect(rendered).toContain('Payment capture');
    expect(rendered).toContain('Payment is authorized.');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#booking-ops']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section admin-mb-16',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table',
        'pill pill-success',
      ]),
    );
    expect(classNamesIn(section).filter((className) => className === 'card admin-section admin-mb-16')).toHaveLength(2);
  });

  it('renders operations command center with the shared Vuexy admin section surface', () => {
    const section = BookingOpsCommandCenter({
      actionEvidenceGate: {
        rows: [
          {
            action: 'Payment sync',
            className: 'ops-task-ready',
            evidence: 'Payment record is linked.',
            href: '#payment',
            operatorRule: 'Sync before capture.',
            pillClass: 'pill-info',
            status: 'Ready',
          },
        ],
        status: 'Evidence ready',
        tone: 'pill-success',
      },
      actionGateByAction: new Map(),
      badges: [{ label: 'Manual action gate', tone: 'pill-info' }],
      booking: {
        earning: null,
        id: 'booking-1',
        payment: null,
      } as unknown as AdminBookingDetail,
      cashDebtNeedsSettlement: false,
      finalGateReason: {
        className: 'ops-task-ready',
        detail: 'No blocking issue is active.',
        operatorRule: 'Continue normal handling.',
        pillClass: 'pill-success',
        title: 'Ready',
      },
      instruction: 'Review evidence before using a manual operation.',
    });

    expect(normalizedText(section)).toContain('Operations command center');
    expect(normalizedText(section)).toContain('Action evidence gate');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['card admin-section ops-command-center admin-mb-16']),
    );
  });
});
