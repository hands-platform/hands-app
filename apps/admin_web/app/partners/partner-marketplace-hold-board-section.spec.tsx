import { readFileSync } from 'node:fs';

import {
  PartnerMarketplaceHoldBoardSection,
  type PartnerMarketplaceHoldBoardSectionBoard,
} from './partner-marketplace-hold-board-section';

describe('PartnerMarketplaceHoldBoardSection', () => {
  it('uses shared Vuexy badge atoms instead of raw marketplace hold pill spans', () => {
    const source = readFileSync('app/partners/partner-marketplace-hold-board-section.tsx', 'utf8');

    expect(source).toContain('AdminDetailGrid');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<div className="grid admin-mt-12">');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className={`pill ${board.hardBlocked > 0 ? \'pill-danger\' : \'pill-success\'}`}>');
    expect(source).not.toContain('<span className="pill pill-info">{board.eligibleNow} direct-ready</span>');
    expect(source).not.toContain('<span className={`pill ${board.marketplaceBlocked > 0 ? \'pill-warn\' : \'pill-success\'}`}>');
    expect(source).not.toContain('<span className="pill" key={sample}>');
    expect(source).not.toContain('<span className="pill pill-success">No immediate queue</span>');
  });

  it('renders hold counts, blocker cards, samples, and clear fallback', () => {
    const section = PartnerMarketplaceHoldBoardSection({
      board: buildBoard(),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner dispatch repair board');
    expect(rendered).toContain('Shows why partners need dispatch repair before operators rely on booking participation');
    expect(rendered).toContain('2 direct request held');
    expect(rendered).toContain('3 direct-ready');
    expect(rendered).toContain('1 dispatch repair');
    expect(rendered).toContain('Cash fee settlement');
    expect(rendered).toContain('Blocks marketplace');
    expect(rendered).toContain('Cash Debt Partner');
    expect(rendered).toContain('No immediate queue');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/partners?review=cash-debt']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section admin-mb-16 partner-marketplace-hold-board-card',
        'card admin-action-card',
        'pill pill-danger',
        'pill pill-warn',
        'signal signal-warn',
      ]),
    );
  });
});

function buildBoard(): PartnerMarketplaceHoldBoardSectionBoard {
  return {
    cards: [
      {
        count: 1,
        detail: 'Negative wallet blocks marketplace participation.',
        href: '/partners?review=cash-debt',
        operatorAction: 'Open the cash debt queue.',
        samples: ['Cash Debt Partner'],
        status: 'Blocks marketplace',
        title: 'Cash fee settlement',
        tone: 'danger',
      },
      {
        count: 0,
        detail: 'Push devices are ready.',
        href: '/partners?review=push',
        operatorAction: 'Keep monitoring.',
        samples: [],
        status: 'Ready',
        title: 'Push alert reachability',
        tone: 'ok',
      },
    ],
    eligibleNow: 3,
    hardBlocked: 2,
    marketplaceBlocked: 1,
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
