import { readFileSync } from 'node:fs';

import {
  PartnerChecklistLaneSection,
  type PartnerChecklistLaneSectionItem,
} from './partner-checklist-lane-section';

describe('PartnerChecklistLaneSection', () => {
  it('uses the shared Vuexy empty-state atom for clear lane fallback', () => {
    const source = readFileSync('app/partners/partner-checklist-lane-section.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).toContain('AdminStageItem');
    expect(source).toContain('AdminStageList');
    expect(source).not.toContain('<div className="setup-stage-list">');
    expect(source).not.toContain('className="setup-stage-item"');
    expect(source).not.toContain('<strong>No partners need immediate attention</strong>');
  });

  it('uses the shared Vuexy badge atom for blocked count', () => {
    const source = readFileSync('app/partners/partner-checklist-lane-section.tsx', 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('<span className={`pill ${blockedCount === 0 ? \'pill-success\' : \'pill-danger\'}`}>');
  });

  it('renders ordered partner checklist items', () => {
    const section = PartnerChecklistLaneSection({
      blockedCount: 2,
      items: buildItems(),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner checklist lane');
    expect(rendered).toContain('Suggested operator order for fixing factual blockers');
    expect(rendered).not.toContain('bank, tax');
    expect(rendered).toContain('2 blocked');
    expect(rendered).toContain('Linh Wellness');
    expect(rendered).toContain('KYC status is PENDING.');
    expect(rendered).toContain('Approve or reject KYC with a clear reason.');
    expect(rendered).toContain('Fix');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/partners/partner-1']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section admin-mb-16 partner-checklist-lane-card',
        'pill pill-danger',
        'text-link',
      ]),
    );
  });

  it('renders a clear fallback when no item needs attention', () => {
    const section = PartnerChecklistLaneSection({
      blockedCount: 0,
      items: [],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('0 blocked');
    expect(rendered).toContain('No partners need immediate attention');
    expect(rendered).toContain('Clear');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-success']));
  });
});

function buildItems(): PartnerChecklistLaneSectionItem[] {
  return [
    {
      actionDetail: 'KYC status is PENDING.',
      actionStatus: 'KYC',
      actionTone: 'blocked',
      href: '/partners/partner-1',
      operatorAction: 'Approve or reject KYC with a clear reason.',
      partnerId: 'partner-1',
      partnerName: 'Linh Wellness',
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
