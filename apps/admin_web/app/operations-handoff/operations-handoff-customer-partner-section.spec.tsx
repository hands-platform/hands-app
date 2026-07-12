import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { classNamesIn, hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffCustomerPartnerSection } from './operations-handoff-customer-partner-section';

describe('OperationsHandoffCustomerPartnerSection', () => {
  it('uses shared Vuexy badge atoms for Customer and Partner labels', () => {
    const source = readFileSync(
      'app/operations-handoff/operations-handoff-customer-partner-section.tsx',
      'utf8',
    );

    expect(source).toContain('AdminActionCard');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('<span className="pill pill-success">{customer.completedCount} completed</span>');
    expect(source).not.toContain('<span className={partner.className}>{partner.status}</span>');
    expect(source).not.toContain('<Link className="ops-signal-card"');
    expect(source).not.toContain('className="ops-signal-card"');
    expect(source).toContain('variant="ops-signal"');
  });

  it('uses the shared AdminFormControlLink atom for list actions', () => {
    const source = readFileSync(
      'app/operations-handoff/operations-handoff-customer-partner-section.tsx',
      'utf8',
    );

    expect(source).toContain('AdminFormControlLink');
    expect(source).not.toContain('<Link className="button button-secondary"');
  });

  it('uses the shared Vuexy detail grid atom', () => {
    const source = readFileSync(
      'app/operations-handoff/operations-handoff-customer-partner-section.tsx',
      'utf8',
    );

    expect(source).toContain('AdminDetailGrid');
    expect(source).not.toContain('<section className="detail-grid admin-mb-16"');
  });

  it('renders Customer and Partner history cards with links', () => {
    const section = OperationsHandoffCustomerPartnerSection({
      customers: [
        {
          avatarStatus: 'offline',
          completedCount: 2,
          detail: '3 booking(s), 150.000 VND payment total, 1 saved location(s).',
          id: 'customer-1',
          lastWorkLabel: 'Last booking booking-1 / 2h ago',
          name: 'Customer Mai',
          sortTime: 1,
        },
      ],
      partners: [
        {
          action: 'Open cash settlement before final acceptance, service start, or payout release.',
          attention: true,
          avatarStatus: 'working',
          className: 'pill pill-danger',
          detail: '2 completed booking(s), ACTIVE, location 10m ago.',
          id: 'partner-1',
          name: 'Partner Linh',
          sortPriority: 5,
          status: 'Cash settlement',
        },
        {
          action: 'Continue normal operational watch.',
          attention: false,
          avatarStatus: 'online',
          className: 'pill pill-success',
          detail: '3 completed booking(s), ACTIVE, location 3m ago.',
          id: 'partner-2',
          name: 'Partner An',
          sortPriority: 0,
          status: 'Location fresh',
        },
      ],
    });

    const rendered = textContent(section);

    expect(section).not.toBeNull();
    if (section === null) throw new Error('Expected customer partner history section to render.');
    expect(section.type.name).toBe('AdminDetailGrid');
    expect(rendered).toContain('Customer history');
    expect(rendered).toContain('Customer Mai');
    expect(rendered).toContain('Partner history');
    expect(rendered).toContain('Partner Linh');
    expect(rendered).not.toContain('Partner An');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-avatar-status-dot is-offline',
        'admin-avatar-status-dot is-working',
        'card admin-section',
        'ops-section-header admin-section-header',
        'ops-task-card ops-signal-card',
      ]),
    );
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/customers', '/customers/customer-1', '/partners', '/partners/partner-1']),
    );
  });

  it('paginates full history Customer and Partner signal lists', () => {
    const section = OperationsHandoffCustomerPartnerSection({
      customerPagination: {
        activePage: 2,
        ariaLabel: 'Customer signal pagination',
        hrefForPage: (page: number) => `/operations-handoff?details=all&customerPage=${page}`,
        itemLabel: 'customer signals',
        totalRows: 12,
      },
      customers: Array.from({ length: 12 }, (_, index) => customerSignal(index + 1)),
      partnerPagination: {
        activePage: 2,
        ariaLabel: 'Partner signal pagination',
        hrefForPage: (page: number) => `/operations-handoff?details=all&partnerPage=${page}`,
        itemLabel: 'partner signals',
        totalRows: 12,
      },
      partners: Array.from({ length: 12 }, (_, index) => partnerSignal(index + 1)),
    });

    const rendered = textContent(section);
    const markup = renderToStaticMarkup(section);

    expect(rendered).not.toContain('Customer 2');
    expect(rendered).toContain('Customer 11');
    expect(markup).toContain('Showing 11 to 12 of 12 customer signals');
    expect(rendered).not.toContain('Partner 2');
    expect(rendered).toContain('Partner 11');
    expect(markup).toContain('Showing 11 to 12 of 12 partner signals');
    expect(markup).toContain('href="/operations-handoff?details=all&amp;customerPage=1"');
    expect(markup).toContain('href="/operations-handoff?details=all&amp;partnerPage=1"');
  });

  it('returns no section when there are no Customer rows or Partner attention rows', () => {
    const section = OperationsHandoffCustomerPartnerSection({
      customers: [],
      partners: [
        {
          action: 'Continue normal operational watch.',
          attention: false,
          avatarStatus: 'online',
          className: 'pill pill-success',
          detail: '3 completed booking(s), ACTIVE, location 3m ago.',
          id: 'partner-2',
          name: 'Partner An',
          sortPriority: 0,
          status: 'Location fresh',
        },
      ],
    });

    expect(section).toBeNull();
  });
});

function customerSignal(index: number) {
  return {
    avatarStatus: 'offline' as const,
    completedCount: index,
    detail: `${index} booking(s), ${index * 1000} VND payment total, 1 saved location(s).`,
    id: `customer-${index}`,
    lastWorkLabel: `Last booking booking-${index}`,
    name: `Customer ${index}`,
    sortTime: index,
  };
}

function partnerSignal(index: number) {
  return {
    action: 'Open Partner detail.',
    attention: true,
    avatarStatus: 'working' as const,
    className: 'pill pill-warn',
    detail: `${index} completed booking(s), ACTIVE, location ${index}m ago.`,
    id: `partner-${index}`,
    name: `Partner ${index}`,
    sortPriority: index,
    status: 'Needs review',
  };
}
