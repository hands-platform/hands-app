import type { ReactNode } from 'react';

import type { AdminProvider } from '../../lib/admin-api';
import { PartnerLegacyOperationsTableSection } from './partner-legacy-operations-table-section';

describe('PartnerLegacyOperationsTableSection', () => {
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

    expect(normalizedText(section)).toContain('No visible partners');
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
