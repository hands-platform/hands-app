import { readFileSync } from 'node:fs';

import {
  PartnerCommandCenterSection,
  type PartnerCommandCenterSectionLane,
} from './partner-command-center-section';

describe('PartnerCommandCenterSection', () => {
  it('uses shared Vuexy badge atoms instead of raw command center pill spans', () => {
    const source = readFileSync('app/partners/partner-command-center-section.tsx', 'utf8');

    expect(source).toContain('AdminDetailGrid');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<div className="grid admin-mt-12">');
    expect(source).not.toContain('actions={<span className="pill pill-info">Daily control view</span>}');
    expect(source).not.toContain('<span className="pill" key={item.label}>');
  });

  it('renders partner command lanes with metrics and status', () => {
    const section = PartnerCommandCenterSection({
      lanes: buildLanes(),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner command center');
    expect(rendered).toContain('Operator overview across onboarding, dispatch readiness');
    expect(rendered).toContain('Daily control view');
    expect(rendered).toContain('Onboarding pipeline');
    expect(rendered).toContain('Review needed');
    expect(rendered).toContain('Monitor');
    expect(rendered).toContain('verification : 2');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/partners?review=kyc']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section admin-mb-16 partner-command-center-card',
        'card admin-action-card',
        'signal signal-warn',
      ]),
    );
  });
});

function buildLanes(): PartnerCommandCenterSectionLane[] {
  return [
    {
      detail: 'Partners are waiting for identity, verification, or document decisions.',
      href: '/partners?review=kyc',
      metrics: [
        { label: 'verification', value: '2' },
        { label: 'KYC', value: '1' },
      ],
      status: 'Review needed',
      title: 'Onboarding pipeline',
      tone: 'warn',
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
