import { readFileSync } from 'fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { classNamesIn, hrefsIn, normalizedText } from '../booking-section-test-utils';
import { BookingEvidenceSections } from './booking-evidence-sections';

describe('Booking evidence sections', () => {
  it('uses shared Vuexy badge atoms instead of raw evidence pill spans', () => {
    const source = readFileSync('app/bookings/[id]/booking-evidence-sections.tsx', 'utf8');

    expect(source).toContain('AdminCard');
    expect(source).toContain('AdminNotePanel');
    expect(source).toContain('AdminSectionHeader');
    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('DateTimeText');
    expect(source).toContain('fallback={metric.value}');
    expect(source).toContain('value={metric.dateTimeValue}');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('<div className="ops-section-header">');
    expect(source).not.toContain('<div className="ops-task-note admin-mt-14">');
    expect(source).not.toContain('<span className="pill pill-info">{decisionEvidenceGuardrails.length} guardrail row(s)</span>');
    expect(source).not.toContain('<span className={`pill ${row.tone}`}>{row.status}</span>');
    expect(source).not.toContain('actions={<span className={`pill ${evidencePacket.tone}`}>{evidencePacket.status}</span>}');
    expect(source).not.toContain('<span className="pill pill-neutral">Record</span>');
    expect(source).not.toContain('actions={<span className={`pill ${chatEvidenceDecisionBoard.tone}`}>{chatEvidenceDecisionBoard.status}</span>}');
    expect(source).not.toContain('<span className={`pill ${row.tone}`}>{row.state}</span>');
    expect(source).not.toContain('<span className="pill pill-info">{manualDecisionReadiness.length} decision lane(s)</span>');
    expect(source).not.toContain('<span className="pill pill-info">{decisionNotePresets.length} preset(s)</span>');
    expect(source).not.toContain('<span className="pill pill-neutral">{preset.label}</span>');
    expect(source).not.toContain('<div className="booking-decision-preset-card"');
    expect(source).not.toContain('actions={<span className="pill pill-info">{bookingEvidenceBundleRows.length} evidence lane(s)</span>}');
  });

  it('renders evidence decision ledgers with compact styling and links', () => {
    const section = BookingEvidenceSections({
      bookingId: 'booking-1',
      bookingEvidenceBundleRows: [
        {
          evidence: 'Address, payment, wallet, chat, and notes are retained.',
          href: '#bundle',
          lane: 'Full bundle',
          operatorUse: 'Use before final decision.',
          recordLabel: 'All evidence',
          status: 'Ready',
          tone: 'pill-success',
        },
      ],
      chatEvidenceDecisionBoard: {
        metrics: [
          {
            dateTimeValue: '2026-06-14T02:00:00.000Z',
            helper: 'Partner cancellation message exists.',
            label: 'Chat',
            value: 'Retained',
          },
        ],
        rows: [
          {
            href: '#chat',
            lane: 'Cancellation chat',
            operatorUse: 'Confirm Partner reason before settlement.',
            record: 'Partner left a cancellation reason.',
            scope: 'Partner chat',
            state: 'Loaded',
            tone: 'pill-success',
          },
        ],
        status: 'Loaded',
        summary: 'Chat records are available for review.',
        tone: 'pill-info',
      },
      decisionEvidenceGuardrails: [
        {
          evidence: 'Payment capture and wallet state are visible.',
          href: '#guardrail',
          id: 'payment',
          nextStep: 'Check settlement before closeout.',
          scope: 'Finance',
          status: 'Ready',
          title: 'Finance guardrail',
          tone: 'pill-success',
        },
      ],
      decisionNotePresets: [
        {
          detail: 'Ask for missing payment evidence before changing status.',
          id: 'missing-payment',
          label: 'Payment',
          preset: 'missing_payment',
          title: 'Request payment evidence',
        },
      ],
      evidencePacket: {
        metrics: [
          {
            helper: 'All required records were retained.',
            label: 'Packet',
            value: 'Complete',
          },
        ],
        records: [
          {
            detail: 'Booking address snapshot is loaded.',
            evidence: 'Address retained at booking time.',
            href: '#packet',
            id: 'packet-address',
            label: 'Address',
            title: 'Service address',
          },
        ],
        status: 'Complete',
        summary: 'Evidence packet is ready for admin decision.',
        tone: 'pill-success',
      },
      manualDecisionReadiness: [
        {
          evidence: 'No-show evidence and chat context are loaded.',
          href: '#manual',
          lane: 'No-show decision',
          operatorUse: 'Use before confirming the final no-show outcome.',
          scope: 'Manual review',
          status: 'Ready',
          tone: 'pill-success',
        },
      ],
    });

    const rendered = normalizedText(section);
    const markup = renderToStaticMarkup(section);

    expect(rendered).toContain('Decision evidence guardrails');
    expect(rendered).toContain('Evidence packet for admin decision');
    expect(rendered).toContain('Chat evidence decision board');
    expect(rendered).toContain('Manual outcome decision readiness');
    expect(rendered).toContain('Booking full evidence bundle');
    expect(rendered).toContain('Finance guardrail');
    expect(rendered).toContain('Partner left a cancellation reason.');
    expect(rendered).toContain('No-show evidence and chat context are loaded.');
    expect(rendered).toContain('Address, payment, wallet, chat, and notes are retained.');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '#bundle',
        '#chat',
        '#guardrail',
        '#manual',
        '#packet',
        '/bookings?view=manual-decision',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'booking-settlement-ledger booking-evidence-ledger admin-mt-12',
        'booking-settlement-ledger-row is-evidence-record',
        'card admin-section admin-mb-16',
        'booking-decision-preset-list admin-mt-12',
        'card admin-card booking-decision-preset-card',
        'text-link',
        'pill pill-success',
      ]),
    );
    expect(classNamesIn(section)).not.toContain('admin-table-scroll');
    expect(classNamesIn(section)).not.toContain('table vuexy-data-table');
    expect(classNamesIn(section)).not.toContain('setup-stage-list admin-mt-12');
    expect(classNamesIn(section).filter((className) => className === 'card admin-section admin-mb-16')).toHaveLength(5);
    expect(classNamesIn(section)).toContain('date-time-text');
    expect(markup).toContain('dateTime="2026-06-14T02:00:00.000Z"');
  });
});
