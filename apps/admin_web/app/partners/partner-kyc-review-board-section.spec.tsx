import { readFileSync } from 'node:fs';

import {
  PartnerKycReviewBoardSection,
  type PartnerKycReviewBoardSectionBoard,
} from './partner-kyc-review-board-section';

describe('PartnerKycReviewBoardSection', () => {
  it('uses shared Vuexy badge atoms instead of raw KYC board pill spans', () => {
    const source = readFileSync('app/partners/partner-kyc-review-board-section.tsx', 'utf8');

    expect(source).toContain('AdminDetailGrid');
    expect(source).toContain('AdminFilterChipGroup');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('AdminStageItem');
    expect(source).toContain('AdminStageList');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<div className="grid admin-mt-12">');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain('<div className="setup-stage-list admin-mt-14">');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className="setup-stage-item"');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('<span className={`pill ${board.openCount > 0 ? \'pill-warn\' : \'pill-success\'}`}>');
    expect(source).not.toContain('<span className="pill pill-success">{board.readyToApprove} ready to approve</span>');
    expect(source).not.toContain('<span className="pill pill-danger">{board.blockedByDocuments} blocked by docs</span>');
    expect(source).not.toContain('<span className="pill" key={sample}>');
    expect(source).not.toContain('<span className="pill pill-success">No immediate queue</span>');
  });

  it('renders KYC summary counts, review cards, and playbook steps', () => {
    const section = PartnerKycReviewBoardSection({
      board: buildBoard(),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('KYC review board');
    expect(rendered).toContain('Tracks identity records, CCCD front/back, and selfie evidence');
    expect(rendered).toContain('4 KYC items');
    expect(rendered).toContain('2 ready to approve');
    expect(rendered).toContain('1 blocked by docs');
    expect(rendered).toContain('Ready to approve');
    expect(rendered).toContain('Decision needed');
    expect(rendered).toContain('Ready Partner');
    expect(rendered).toContain('Review submitted KYC evidence');
    expect(rendered).toContain('1ST');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/partners?review=kyc']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section admin-mb-16 partner-kyc-review-board-card',
        'card admin-action-card',
        'pill pill-warn',
        'signal signal-info',
      ]),
    );
  });
});

function buildBoard(): PartnerKycReviewBoardSectionBoard {
  return {
    blockedByDocuments: 1,
    cards: [
      {
        count: 2,
        detail: 'KYC record and all required evidence are submitted.',
        href: '/partners?review=kyc',
        operatorAction: 'Open partner detail and make the final decision.',
        samples: ['Ready Partner'],
        status: 'Decision needed',
        title: 'Ready to approve',
        tone: 'info',
      },
      {
        count: 0,
        detail: 'No missing records.',
        href: '/partners?review=kyc',
        operatorAction: 'Keep monitoring.',
        samples: [],
        status: 'Clear',
        title: 'Missing KYC record',
        tone: 'ok',
      },
    ],
    openCount: 4,
    playbook: [
      {
        count: 1,
        detail: 'CCCD front/back and selfie evidence are ready for one overall decision.',
        href: '/partners?review=kyc',
        operatorAction: 'Check file type and image clarity, then approve or hold.',
        status: '1ST',
        title: 'Review submitted KYC evidence',
      },
    ],
    readyToApprove: 2,
  };
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

function normalizedText(value: unknown): string {
  return textContent(value).replace(/\s+/g, ' ').trim();
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
