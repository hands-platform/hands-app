import { readFileSync } from 'node:fs';

import {
  PartnerChecklistWorkQueueSection,
  type PartnerChecklistWorkQueueSectionQueue,
} from './partner-checklist-work-queue-section';

describe('PartnerChecklistWorkQueueSection', () => {
  it('uses the shared Vuexy empty-state atom for empty work queues', () => {
    const source = readFileSync('app/partners/partner-checklist-work-queue-section.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).not.toContain('<strong>No partner work queue items</strong>');
  });

  it('uses shared Vuexy badge atoms instead of raw work queue pill spans', () => {
    const source = readFileSync('app/partners/partner-checklist-work-queue-section.tsx', 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('<span className={`pill ${queue.blockedCount ? \'pill-warn\' : \'pill-success\'}`}>');
    expect(source).not.toContain('<span className="pill pill-info">{queue.dispatchReadyCount} dispatch-ready</span>');
    expect(source).not.toContain('<span className={`pill ${partnerShiftPillClass(row.tone)}`}>#{index + 1}</span>');
  });

  it('uses the shared Vuexy table panel wrapper instead of hand-composed table card classes', () => {
    const source = readFileSync('app/partners/partner-checklist-work-queue-section.tsx', 'utf8');

    expect(source).toContain('AdminTablePanel');
    expect(source).not.toContain(
      'booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-table-card admin-mb-16',
    );
  });

  it('renders partner checklist queue counters, row facts, and detail links', () => {
    const section = PartnerChecklistWorkQueueSection({
      partnerName: (provider) => provider.displayName,
      queue: buildQueue(),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner checklist work queue');
    expect(rendered).toContain('2 urgent');
    expect(rendered).toContain('1 blocked');
    expect(rendered).toContain('3 dispatch-ready');
    expect(rendered).toContain('# 1');
    expect(rendered).toContain('Linh Wellness');
    expect(rendered).toContain('KYC decision');
    expect(rendered).toContain('KYC');
    expect(rendered).toContain('Review submitted KYC evidence.');
    expect(rendered).toContain('Same shift');
    expect(rendered).toContain('Submitted 2h ago.');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/partners/partner-1#kyc']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-table-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-table service-trace',
        'vuexy-booking-table-footer vuexy-partner-table-footer',
        'admin-avatar-status-dot is-online',
        'pill pill-danger',
        'text-link',
      ]),
    );
    expect(rendered).toContain('Showing 1 to 1 of 1 entries');
  });

  it('renders an empty queue state when no partner work items are visible', () => {
    const section = PartnerChecklistWorkQueueSection({
      partnerName: (provider) => provider.displayName,
      queue: {
        blockedCount: 0,
        dispatchReadyCount: 0,
        rows: [],
        urgentCount: 0,
      },
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('0 urgent');
    expect(rendered).toContain('Showing 0 entries');
    expect(rendered).toContain('No partner work queue items');
    expect(rendered).toContain('Keep monitoring dispatch demand and live booking pressure.');
  });
});

function buildQueue(): PartnerChecklistWorkQueueSectionQueue {
  return {
    blockedCount: 1,
    dispatchReadyCount: 3,
    rows: [
      {
        action: {
          detail: 'Review submitted KYC evidence.',
          operatorAction: 'Approve or reject KYC.',
          priority: 95,
          status: 'KYC',
          tone: 'blocked',
        },
        age: 'Submitted 2h ago.',
        href: '/partners/partner-1#kyc',
        lane: 'KYC decision',
        provider: {
          displayName: 'Linh Wellness',
          id: 'partner-1',
          status: 'ONLINE_AVAILABLE',
          user: {
            phone: '0865907184',
          },
        },
        sla: 'Same shift',
        tone: 'danger',
      },
    ],
    urgentCount: 2,
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
