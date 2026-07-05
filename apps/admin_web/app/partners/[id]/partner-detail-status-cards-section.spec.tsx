import { readFileSync } from 'node:fs';

import { PartnerDetailStatusCardsSection } from './partner-detail-status-cards-section';

describe('PartnerDetailStatusCardsSection', () => {
  it('keeps partner status summary cards on Vuexy KPI surfaces', () => {
    const section = PartnerDetailStatusCardsSection({
      cards: [
        { label: 'Bookings done', value: '12' },
        { label: 'Wallet balance', value: '450.000 VND' },
      ],
    });

    const classNames = classNamesIn(section);
    const source = readFileSync('app/partners/[id]/partner-detail-status-cards-section.tsx', 'utf8');

    expect(classNames).toContain('admin-metric-grid partner-detail-metric-grid admin-mb-16');
    expect(classNames).toContain('metric-card');
    expect(source).toContain('AdminMetricGrid');
    expect(source).not.toContain('AdminCard');
    expect(source).not.toContain('<section className="partner-detail-metric-grid admin-mb-16"');
    expect(source).not.toContain('<div className="card admin-kpi-card partner-detail-metric-card"');
    expect(textContent(section)).toContain('Bookings done');
    expect(textContent(section)).toContain('450.000 VND');
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
