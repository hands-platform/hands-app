import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';

import type { AdminProvider } from '../../lib/admin-api';
import { PartnerLegacyOperationsTableSection } from './partner-legacy-operations-table-section';

describe('PartnerLegacyOperationsTableSection', () => {
  it('uses the shared Vuexy admin card surface for the legacy table shell', () => {
    const source = readFileSync('app/partners/partner-legacy-operations-table-section.tsx', 'utf8');

    expect(source).toContain('AdminTableCard');
    expect(source).not.toContain('AdminCard');
    expect(source).not.toContain('admin-filter-panel booking-monitor-filter-panel');
    expect(source).not.toContain(
      'admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-table-card',
    );
  });

  it('renders the partner operations table with provided cell renderers', () => {
    const section = PartnerLegacyOperationsTableSection({
      emptyMessage: 'No visible partners',
      hiddenPartnerCount: 2,
      partnerName: (partner) => partner.displayName,
      providers: buildProviders(),
      renderActions: renderCell('Actions'),
      renderFiles: renderCell('Files'),
      renderLocation: renderCell('Location'),
      renderOnboarding: renderCell('Onboarding'),
      renderOpsReadiness: renderCell('Ops readiness'),
      renderPushDevices: renderCell('Push devices'),
      renderSecurity: renderCell('Security'),
      renderServices: renderCell('Services'),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner');
    expect(rendered).toContain('Status');
    expect(rendered).toContain('Onboarding');
    expect(rendered).toContain('Linh Wellness');
    expect(rendered).toContain('0865907184');
    expect(rendered).toContain('Queue status: ONLINE_AVAILABLE');
    expect(rendered).toContain('Ops readiness for partner-1');
    expect(rendered).toContain('2 more partner row(s) are hidden for page speed.');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/partners/partner-1']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-card vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-table-card admin-mt-16',
        'admin-avatar-status-dot is-online',
        'admin-table-scroll',
        'table-link',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-table partner-legacy-table',
        'vuexy-booking-table-footer vuexy-partner-table-footer',
        'vuexy-booking-person',
      ]),
    );
    expect(rendered).toContain('Showing 1 to 1 of 1 entries');
  });

  it('renders the empty message when no partner rows are visible', () => {
    const section = PartnerLegacyOperationsTableSection({
      emptyMessage: 'No visible partners',
      hiddenPartnerCount: 0,
      partnerName: (partner) => partner.displayName,
      providers: [],
      renderActions: renderCell('Actions'),
      renderFiles: renderCell('Files'),
      renderLocation: renderCell('Location'),
      renderOnboarding: renderCell('Onboarding'),
      renderOpsReadiness: renderCell('Ops readiness'),
      renderPushDevices: renderCell('Push devices'),
      renderSecurity: renderCell('Security'),
      renderServices: renderCell('Services'),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('No visible partners');
    expect(rendered).toContain('Showing 0 entries');
  });
});

function buildProviders(): AdminProvider[] {
  return [
    {
      displayName: 'Linh Wellness',
      id: 'partner-1',
      status: 'ONLINE_AVAILABLE',
      user: {
        phone: '0865907184',
      },
      verification: {
        id: 'verification-1',
        rejectionReason: 'Missing selfie evidence',
        status: 'PENDING_REVIEW',
      },
    },
  ];
}

function renderCell(label: string): (provider: AdminProvider) => ReactNode {
  return (provider) => `${label} for ${provider.id}`;
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
