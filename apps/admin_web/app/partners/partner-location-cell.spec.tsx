import { readFileSync } from 'node:fs';

import type { AdminProvider } from '../../lib/admin-api';
import { DEFAULT_PROVIDER_OPS_POLICY } from './partner-list-ops';
import { PartnerLocationCell } from './partner-location-cell';

describe('PartnerLocationCell', () => {
  it('uses the shared Vuexy badge atom for location status', () => {
    const source = readFileSync('app/partners/partner-location-cell.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).toContain('AdminFilterChipGroup');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain('<span className={`pill ${providerLocationPillClass(status)}`}>');
    expect(source).not.toContain('<p className="muted">No saved location yet.</p>');
  });

  it('renders recent partner location status without exposing raw coordinates', () => {
    const cell = PartnerLocationCell({
      opsPolicy: DEFAULT_PROVIDER_OPS_POLICY,
      provider: {
        currentLat: 10.12345,
        currentLng: 106.98765,
        currentLocationUpdatedAt: new Date().toISOString(),
        id: 'partner-location',
      } as AdminProvider,
    });

    const rendered = normalizedText(cell);

    expect(rendered).toContain('Location recent');
    expect(rendered).toContain('Partner location saved for dispatch checks.');
    expect(rendered).not.toContain('10.1235');
    expect(rendered).not.toContain('106.9877');
    expect(classNamesIn(cell)).toEqual(expect.arrayContaining(['pill pill-success']));
  });

  it('renders a clear fallback when partner coordinates are missing', () => {
    const cell = PartnerLocationCell({
      opsPolicy: DEFAULT_PROVIDER_OPS_POLICY,
      provider: {
        id: 'partner-no-location',
      } as AdminProvider,
    });

    const rendered = normalizedText(cell);

    expect(rendered).toContain('No location');
    expect(rendered).toContain('Partner app has not shared a location.');
    expect(rendered).toContain('No saved location yet.');
    expect(classNamesIn(cell)).toEqual(expect.arrayContaining(['pill pill-neutral']));
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

function normalizedText(value: unknown): string {
  return textContent(value).replace(/\s+/g, ' ').trim();
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
