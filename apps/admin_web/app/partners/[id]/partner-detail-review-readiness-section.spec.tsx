import { readFileSync } from 'node:fs';
import {
  PartnerDetailApprovalChecklistSection,
  PartnerDetailRegistrationDossierSection,
} from './partner-detail-review-readiness-section';

describe('Partner detail review readiness sections', () => {
  it('uses the partner detail Vuexy table panel atom for review readiness shells', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-review-readiness-section.tsx', 'utf8');

    expect(source).toContain('PartnerDetailVuexyTablePanel');
    expect(source).not.toContain('AdminFilterPanel');
    expect(source).not.toContain('partnerDetailReviewCardClassName');
  });

  it('uses the shared Vuexy empty-state atom', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-review-readiness-section.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).not.toContain('<strong>No records found</strong>');
  });

  it('uses shared Vuexy status badges for readiness status chips', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-review-readiness-section.tsx', 'utf8');

    expect(source).toContain('<StatusBadge');
    expect(source).not.toContain("<span className={`pill ${item.ok ? 'pill-success' : 'pill-warn'}`}>");
  });

  it('renders the approval checklist as a Vuexy table', () => {
    const section = PartnerDetailApprovalChecklistSection({
      checklist: {
        blockers: 1,
        ready: false,
        items: [
          {
            detail: 'KYC evidence is approved.',
            label: 'KYC',
            ok: true,
            status: 'CLEAR',
          },
          {
            detail: 'Withdrawal details still need admin review.',
            label: 'Withdrawal details',
            ok: false,
            status: 'CHECK',
          },
        ],
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Approval checklist');
    expect(rendered).toContain('1 blocker(s)');
    expect(rendered).toContain('Gate');
    expect(rendered).toContain('Outcome');
    expect(rendered).toContain('Withdrawal details');
    expect(rendered).toContain('Withdrawal details still need admin review.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-warn',
        'pill pill-success',
      ]),
    );
  });

  it('renders the registration dossier as a Vuexy table', () => {
    const section = PartnerDetailRegistrationDossierSection({
      dossier: {
        blockers: 1,
        ready: false,
        items: [
          {
            detail: 'Public profile images still need review.',
            label: 'Public profile',
            ok: false,
            operatorAction: 'Review public profile images.',
            status: 'MISSING',
          },
          {
            detail: 'KYC and required documents are approved.',
            label: 'KYC evidence',
            ok: true,
            operatorAction: 'Identity gate is clear.',
            status: 'APPROVED',
          },
        ],
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner registration dossier');
    expect(rendered).toContain('1 gap(s)');
    expect(rendered).toContain('Dossier item');
    expect(rendered).toContain('Operator action');
    expect(rendered).toContain('KYC evidence');
    expect(rendered).toContain('KYC and required documents are approved.');
    expect(rendered).toContain('Identity gate is clear.');
    expect(rendered).not.toContain('Tax profile optional');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-warn',
        'pill pill-success',
      ]),
    );
  });

  it('prefers shared detail nodes over fallback readiness detail text', () => {
    const approvalSection = PartnerDetailApprovalChecklistSection({
      checklist: {
        blockers: 0,
        ready: true,
        items: [
          {
            detail: 'Fallback location freshness date',
            detailNode: <span>Shared location freshness date marker</span>,
            label: 'Location freshness',
            ok: true,
            status: 'RECENT',
          },
        ],
      },
    });
    const dossierSection = PartnerDetailRegistrationDossierSection({
      dossier: {
        blockers: 0,
        ready: true,
        items: [
          {
            detail: 'Fallback registration dossier date',
            detailNode: <span>Shared registration dossier date marker</span>,
            label: 'Joined',
            ok: true,
            operatorAction: 'No action.',
            status: 'READY',
          },
        ],
      },
    });
    const rendered = normalizeSpaces(`${textContent(approvalSection)} ${textContent(dossierSection)}`);
    const source = readFileSync('app/partners/[id]/partner-detail-review-readiness-section.tsx', 'utf8');
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(rendered).toContain('Shared location freshness date marker');
    expect(rendered).toContain('Shared registration dossier date marker');
    expect(rendered).not.toContain('Fallback location freshness date');
    expect(rendered).not.toContain('Fallback registration dossier date');
    expect(source).toContain('detailNode?: ReactNode;');
    expect(source).toContain('item.detailNode ?? item.detail');
    expect(pageSource).toContain('<DateTimeText fallback="Missing" value={provider.currentLocationUpdatedAt} />');
  });
});

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function classNamesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
