import { readFileSync } from 'node:fs';

import {
  PartnerDispatchHandoffSection,
  type PartnerDispatchHandoffSectionModel,
} from './partner-dispatch-handoff-section';

describe('PartnerDispatchHandoffSection', () => {
  it('uses the shared Vuexy trace summary atom for dispatch lane links', () => {
    const source = readFileSync('app/partners/partner-dispatch-handoff-section.tsx', 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-14">');
  });

  it('renders dispatch handoff copy, policy link, and lane links', () => {
    const section = PartnerDispatchHandoffSection({
      handoff: buildHandoff(),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Dispatch handoff links');
    expect(rendered).toContain('Jump to the exact partner lane.');
    expect(rendered).toContain('Current policy: first partner response window 5m.');
    expect(rendered).toContain('Edit dispatch policy');
    expect(rendered).toContain('Marketplace ready');
    expect(rendered).toContain('4');
    expect(rendered).toContain('Partners eligible to receive marketplace alerts.');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/operations-policy', '/partners?review=marketplace-ready']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section admin-mb-16 partner-dispatch-handoff-card',
        'admin-form-control-link button button-secondary',
        'ops-task-breakdown-item ops-task-breakdown-ok',
      ]),
    );
  });
});

function buildHandoff(): PartnerDispatchHandoffSectionModel {
  return {
    detail: 'Current policy: first partner response window 5m.',
    headline: 'Jump to the exact partner lane.',
    links: [
      {
        detail: 'Partners eligible to receive marketplace alerts.',
        href: '/partners?review=marketplace-ready',
        title: 'Marketplace ready',
        tone: 'ok',
        value: '4',
      },
    ],
    policyLabel: 'Edit dispatch policy',
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
