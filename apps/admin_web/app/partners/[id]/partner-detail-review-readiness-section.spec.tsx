import {
  PartnerDetailApprovalChecklistSection,
  PartnerDetailRegistrationDossierSection,
} from './partner-detail-review-readiness-section';

describe('Partner detail review readiness sections', () => {
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
            detail: 'Bank account still needs admin approval.',
            label: 'Payout bank',
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
    expect(rendered).toContain('Payout bank');
    expect(rendered).toContain('Bank account still needs admin approval.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-partner-detail-review-card',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
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
            detail: 'Public profile images are ready.',
            label: 'Public profile',
            ok: true,
            operatorAction: 'No action needed.',
            status: 'CLEAR',
          },
          {
            detail: 'Tax profile needs the first earning trigger.',
            label: 'Tax profile',
            ok: false,
            operatorAction: 'Keep deferred until first earning.',
            status: 'DEFER',
          },
        ],
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner registration dossier');
    expect(rendered).toContain('1 gap(s)');
    expect(rendered).toContain('Dossier item');
    expect(rendered).toContain('Operator action');
    expect(rendered).toContain('Tax profile needs the first earning trigger.');
    expect(rendered).toContain('Keep deferred until first earning.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-partner-detail-review-card',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-warn',
        'pill pill-success',
      ]),
    );
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
