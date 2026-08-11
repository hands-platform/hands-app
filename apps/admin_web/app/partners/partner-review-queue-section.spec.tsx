import { readFileSync } from 'node:fs';

import {
  PartnerReviewQueueSection,
  type PartnerReviewQueueSectionQueue,
} from './partner-review-queue-section';

describe('PartnerReviewQueueSection', () => {
  it('uses the shared Vuexy badge atom for queue status', () => {
    const source = readFileSync('app/partners/partner-review-queue-section.tsx', 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).toContain('AdminStageItem');
    expect(source).toContain('AdminStageList');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="setup-stage-list">');
    expect(source).not.toContain('className="setup-stage-item"');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('<span className={`pill ${queue.totalOpen === 0 ? \'pill-success\' : \'pill-warn\'}`}>');
  });

  it('renders review queue status and item links', () => {
    const section = PartnerReviewQueueSection({
      queue: buildQueue(),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Review queue');
    expect(rendered).toContain('Grouped partner records for KYC, documents, payout readiness');
    expect(rendered).toContain('3 open items');
    expect(rendered).toContain('KYC updates');
    expect(rendered).toContain('Partners with missing identity verification.');
    expect(rendered).toContain('CHECK');
    expect(rendered).toContain('Push alert readiness');
    expect(rendered).toContain('OK');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/partners?review=kyc']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section admin-mb-16 partner-review-queue-card',
        'pill pill-warn',
        'text-link',
      ]),
    );
  });

  it('renders a clear status when no review work is open', () => {
    const section = PartnerReviewQueueSection({
      queue: {
        items: [
          {
            count: 0,
            detail: 'No open KYC work.',
            href: '/partners?review=kyc',
            label: 'KYC updates',
          },
        ],
        totalOpen: 0,
      },
    });

    expect(normalizedText(section)).toContain('0 open items');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-success']));
  });
});

function buildQueue(): PartnerReviewQueueSectionQueue {
  return {
    items: [
      {
        count: 3,
        detail: 'Partners with missing identity verification.',
        href: '/partners?review=kyc',
        label: 'KYC updates',
      },
      {
        count: 0,
        detail: 'No push alert work.',
        href: '/partners?review=push',
        label: 'Push alert readiness',
      },
    ],
    totalOpen: 3,
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
