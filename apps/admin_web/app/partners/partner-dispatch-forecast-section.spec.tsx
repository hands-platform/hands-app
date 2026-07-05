import { readFileSync } from 'node:fs';

import {
  PartnerDispatchForecastSection,
  type PartnerDispatchForecastSectionForecast,
} from './partner-dispatch-forecast-section';

describe('PartnerDispatchForecastSection', () => {
  it('uses the shared Vuexy admin card surface for dispatch panels', () => {
    const source = readFileSync('app/partners/partner-dispatch-forecast-section.tsx', 'utf8');

    expect(source).toContain('AdminNoteCard');
    expect(source).toContain('AdminEmptyState');
    expect(source).not.toContain('<AdminCard className="ops-task-note partner-dispatch-panel">');
    expect(source).not.toContain('className="card admin-card ops-task-note partner-dispatch-panel"');
    expect(source).not.toContain('<strong>No city data yet</strong>');
  });

  it('renders dispatch totals, blockers, and city supply lanes', () => {
    const section = PartnerDispatchForecastSection({
      forecast: buildForecast(),
      staleLocationMinutes: 12,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Dispatch capacity forecast');
    expect(rendered).toContain('Converts the filtered partner list into dispatch capacity');
    expect(rendered).toContain('Policy: fresh location <= 12 m');
    expect(rendered).toContain('Ready now');
    expect(rendered).toContain('3/5');
    expect(rendered).toContain('Dispatch blockers');
    expect(rendered).toContain('Location refresh');
    expect(rendered).toContain('FIX');
    expect(rendered).toContain('City supply lanes');
    expect(rendered).toContain('Ho Chi Minh City');
    expect(rendered).toContain('2 / 4 ready, 3 online, 1 need location refresh, 1 blocked.');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/operations-policy', '/partners?readiness=ready']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section admin-mb-16 partner-dispatch-forecast-card',
        'card admin-action-card',
        'signal signal-ok',
        'admin-form-control-link button button-secondary',
      ]),
    );
    expect(
      classNamesIn(section).filter(
        (className) => className === 'card admin-card ops-task-note partner-dispatch-panel',
      ),
    ).toHaveLength(2);
  });

  it('renders an empty city fallback when no supply lane exists', () => {
    const section = PartnerDispatchForecastSection({
      forecast: {
        blockers: [],
        supplyLanes: [],
        totals: [],
      },
      staleLocationMinutes: 12,
    });

    expect(normalizedText(section)).toContain('No city data yet');
  });
});

function buildForecast(): PartnerDispatchForecastSectionForecast {
  return {
    blockers: [
      {
        count: 1,
        detail: 'Partner location is missing or stale.',
        href: '/partners?review=location',
        label: 'Location refresh',
        tone: 'warn',
      },
    ],
    supplyLanes: [
      {
        blocked: 1,
        city: 'Ho Chi Minh City',
        locationNeedsRefresh: 1,
        online: 3,
        ready: 2,
        total: 4,
      },
    ],
    totals: [
      {
        detail: 'Approved, online, fresh location, clear device checks, and push-ready partners.',
        href: '/partners?readiness=ready',
        label: 'Ready now',
        tone: 'ok',
        value: '3/5',
      },
    ],
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
