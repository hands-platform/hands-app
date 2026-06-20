import {
  PartnerDetailApprovalEvidenceSummarySection,
  PartnerDetailLevelPathSection,
  PartnerDetailResubmissionGuidanceSection,
  PartnerDetailReviewControlPanelSection,
  type PartnerApprovalEvidenceSummaryRow,
  type PartnerReviewControlPanelView,
} from './partner-detail-review-progress-section';

describe('PartnerDetailReviewControlPanelSection', () => {
  it('renders submitted dossier, hold, resubmission, and review history summary', () => {
    const section = PartnerDetailReviewControlPanelSection({
      panel: buildPanel(),
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner review control panel');
    expect(rendered).toContain('Partner on hold');
    expect(rendered).toContain('Submitted');
    expect(rendered).toContain('Hold state');
    expect(rendered).toContain('KYC identity review');
    expect(rendered).toContain('Partner must upload a clearer selfie.');
    expect(rendered).toContain('Review gate');
    expect(rendered).toContain('Status');
    expect(rendered).toContain('Detail');
    expect(rendered).toContain('Action');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '#partner-connected-operations-records',
        '#partner-operator-command-queue',
        '#partner-review-history',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table',
        'pill pill-danger',
        'pill pill-warn',
        'pill pill-info',
      ]),
    );
  });

  it('renders compact approval evidence links for KYC, documents, bank, and tax', () => {
    const section = PartnerDetailApprovalEvidenceSummarySection({
      rows: buildApprovalEvidenceRows(),
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner approval evidence summary');
    expect(rendered).toContain('2 check(s)');
    expect(rendered).toContain('KYC decision needed');
    expect(rendered).toContain('Required documents approved');
    expect(rendered).toContain('Payout bank needs review');
    expect(rendered).toContain('Tax can stay deferred');
    expect(rendered).toContain('Evidence');
    expect(rendered).toContain('Status');
    expect(rendered).toContain('Detail');
    expect(rendered).toContain('Action');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#kyc', '#documents', '#bank', '#tax']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table',
        'pill pill-warn',
        'pill pill-success',
        'pill pill-neutral',
      ]),
    );
  });

  it('renders the partner level path as a Vuexy table', () => {
    const section = PartnerDetailLevelPathSection({
      plan: {
        currentLevel: 'Level 2',
        items: [
          {
            blocked: false,
            detail: 'Signup and KYC are complete.',
            level: 'Level 1 signup',
            operatorAction: 'No action needed.',
            ready: true,
            status: 'CLEAR',
          },
          {
            blocked: true,
            detail: 'Payout bank is not approved.',
            level: 'Level 3 payout',
            operatorAction: 'Approve bank account before payout.',
            ready: false,
            status: 'BLOCKED',
          },
        ],
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner level path');
    expect(rendered).toContain('Level 2');
    expect(rendered).toContain('Level');
    expect(rendered).toContain('Operator action');
    expect(rendered).toContain('Level 3 payout');
    expect(rendered).toContain('Approve bank account before payout.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table',
        'pill pill-success',
        'pill pill-danger',
      ]),
    );
  });

  it('renders resubmission guidance and clear empty state as Vuexy tables', () => {
    const section = PartnerDetailResubmissionGuidanceSection({
      plan: {
        items: [
          {
            operatorAction: 'Request a clearer selfie.',
            providerInstruction: 'Upload a bright selfie with your full face visible.',
            reason: 'Selfie is too dark.',
            status: 'REJECTED',
            target: 'KYC selfie',
          },
        ],
      },
    });
    const emptySection = PartnerDetailResubmissionGuidanceSection({ plan: { items: [] } });

    const rendered = normalizeSpaces(textContent(section));
    const emptyRendered = normalizeSpaces(textContent(emptySection));

    expect(rendered).toContain('Resubmission guidance');
    expect(rendered).toContain('1 item(s)');
    expect(rendered).toContain('Target');
    expect(rendered).toContain('Partner instruction');
    expect(rendered).toContain('KYC selfie');
    expect(rendered).toContain('Upload a bright selfie with your full face visible.');
    expect(emptyRendered).toContain('No records found');
    expect(emptyRendered).toContain('No resubmission request needed.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table',
        'pill pill-danger',
      ]),
    );
  });
});

function buildPanel(): PartnerReviewControlPanelView {
  return {
    status: 'Partner on hold',
    tone: 'pill-danger',
    metrics: [
      {
        label: 'Submitted',
        value: '20 Jun 2026, 09:00',
        helper: 'Latest KYC submission timestamp.',
      },
      {
        label: 'Hold state',
        value: 'On hold',
        helper: 'Missing bank evidence.',
      },
    ],
    items: [
      {
        detail: 'Basic identity is complete.',
        href: '#partner-connected-operations-records',
        id: 'submitted-dossier',
        label: 'SUBMIT',
        status: 'READY',
        title: 'Submitted dossier is complete',
        tone: 'pill-success',
      },
      {
        detail: 'Missing bank evidence.',
        href: '#partner-operator-command-queue',
        id: 'account-hold-state',
        label: 'HOLD',
        status: 'ON HOLD',
        title: 'Active Partner hold',
        tone: 'pill-danger',
      },
      {
        detail: 'KYC identity review: Partner must upload a clearer selfie.',
        href: '#partner-review-history',
        id: 'resubmission-needs',
        label: 'FIX',
        status: '1 ITEM(S)',
        title: 'Partner resubmission needed',
        tone: 'pill-warn',
      },
      {
        detail: 'KYC rejected by Admin at 20 Jun 2026, 09:10.',
        href: '#partner-review-history',
        id: 'latest-review-event',
        label: 'LOG',
        status: 'REJECT_KYC',
        title: 'KYC identity review',
        tone: 'pill-info',
      },
    ],
  };
}

function buildApprovalEvidenceRows(): PartnerApprovalEvidenceSummaryRow[] {
  return [
    {
      detail: 'Status PENDING; CCCD/CMND ****1234; submitted 20 Jun 2026, 09:00.',
      href: '#kyc',
      id: 'kyc-evidence-summary',
      label: 'KYC',
      status: 'PENDING',
      title: 'KYC decision needed',
      tone: 'pill-warn',
    },
    {
      detail: '3/3 required document(s) approved.',
      href: '#documents',
      id: 'document-evidence-summary',
      label: 'DOCS',
      status: 'APPROVED',
      title: 'Required documents approved',
      tone: 'pill-success',
    },
    {
      detail: 'VCB / Linh Wellness / ****6789.',
      href: '#bank',
      id: 'bank-evidence-summary',
      label: 'BANK',
      status: 'PENDING',
      title: 'Payout bank needs review',
      tone: 'pill-warn',
    },
    {
      detail: 'Partner has no first earning yet, so tax evidence does not block onboarding.',
      href: '#tax',
      id: 'tax-evidence-summary',
      label: 'TAX',
      status: 'DEFERRED',
      title: 'Tax can stay deferred',
      tone: 'pill-neutral',
    },
  ];
}

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

function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
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
