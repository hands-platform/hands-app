import type { AdminProvider } from '../../lib/admin-api';
import { PartnerServicesCell } from './partner-services-cell';

describe('PartnerServicesCell', () => {
  it('renders joined service names when services exist', () => {
    const cell = PartnerServicesCell({
      provider: {
        displayName: 'Linh Wellness',
        id: 'partner-services',
        services: [
          { service: { name: 'Aroma Therapy' } },
          { service: { name: 'Foot Massage' } },
          { service: null },
        ],
        status: 'ONLINE_AVAILABLE',
      } as AdminProvider,
    });

    expect(textContent(cell)).toBe('Aroma Therapy, Foot Massage');
  });

  it('renders none when no service names are available', () => {
    const cell = PartnerServicesCell({
      provider: {
        displayName: 'No Services',
        id: 'partner-no-services',
        services: [],
        status: 'ONLINE_AVAILABLE',
      } as AdminProvider,
    });

    expect(textContent(cell)).toBe('None');
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
  return textContent(props?.children).replace(/\s+/g, ' ').trim();
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
