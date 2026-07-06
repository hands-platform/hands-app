import { readFileSync } from 'node:fs';

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

  it('renders Customer and Partner handoff cards with links', () => {
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
    if (section === null) throw new Error('Expected customer partner handoff section to render.');
    expect(section.type.name).toBe('AdminDetailGrid');
    expect(rendered).toContain('Customer handoff');
    expect(rendered).toContain('Customer Mai');
    expect(rendered).toContain('Partner handoff');
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
