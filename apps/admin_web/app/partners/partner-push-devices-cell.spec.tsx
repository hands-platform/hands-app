import { readFileSync } from 'node:fs';

import type { AdminProvider } from '../../lib/admin-api';
import { PartnerPushDevicesCell } from './partner-push-devices-cell';

describe('PartnerPushDevicesCell', () => {
  it('uses the shared DateTimeText atom for visible push delivery timestamps', () => {
    const source = readFileSync('app/partners/partner-push-devices-cell.tsx', 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('Last attempt: {formatDateTime(readLastAttempt(device))}');
  });

  it('renders enabled and disabled Partner push device state', () => {
    const cell = PartnerPushDevicesCell({
      provider: {
        id: 'partner-push',
        user: {
          pushDevices: [
            {
              createdAt: '2026-06-01T08:00:00.000Z',
              enabled: true,
              id: 'push-enabled-123456',
              platform: 'ios',
            },
            {
              id: 'push-disabled-abcdef',
              deliveries: [
                {
                  attemptedAt: '2026-06-08T10:30:00.000Z',
                  id: 'delivery-1',
                  provider: 'fcm',
                  response: {
                    body: {
                      error: {
                        details: [{ errorCode: 'TOKEN_UNREGISTERED' }],
                      },
                    },
                    statusCode: 404,
                  },
                  status: 'FAILED',
                },
              ],
              enabled: false,
              platform: 'android',
            },
          ],
        },
      } as AdminProvider,
    });

    const rendered = normalizedText(cell);

    expect(rendered).toContain('ios / enabled / Token hidden');
    expect(rendered).toContain('android / disabled / Token hidden');
    expect(rendered).toContain('Last failure: TOKEN_UNREGISTERED / FAILED');
    expect(rendered).toContain('Last attempt:');
    expect(rendered).toContain('Re-enable');
    expect(hrefsIn(cell)).toEqual(
      expect.arrayContaining([
        '/partners?pushAction=enable-device&pushDeviceId=push-disabled-abcdef',
      ]),
    );
    expect(ariaLabelsIn(cell)).toEqual(
      expect.arrayContaining(['Push device actions for push-d...cdef']),
    );
    expect(classNamesIn(cell)).toEqual(expect.arrayContaining(['action-menu', 'pill pill-danger']));
  });

  it('renders a compact fallback when no Partner push devices exist', () => {
    const cell = PartnerPushDevicesCell({
      provider: {
        id: 'partner-no-push',
      } as AdminProvider,
    });

    expect(normalizedText(cell)).toBe('None');
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

function ariaLabelsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(ariaLabelsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const label = typeof props?.['aria-label'] === 'string' ? [props['aria-label']] : [];
  return [...label, ...ariaLabelsIn(props?.children)];
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
