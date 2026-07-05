import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import type { AdminCustomerDetail } from '../../../lib/admin-api';
import CustomerDetailPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const customerDetailSource = readFileSync('app/customers/[id]/page.tsx', 'utf8');

describe('CustomerDetailPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/customers/customer-1') {
        return customerDetail();
      }

      return fallback;
    });
  });

  it('renders customer operations blocks with the shared Vuexy section surface', async () => {
    const page = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-1' }),
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('toolbar admin-page-header');
    expect(markup).toContain('id="customer-booking-create-gates"');
    expect(markup).toContain('id="customer-operator-command-queue"');
    expect(markup).toContain('id="record-date-filter"');
    expect(markup).toContain('id="customer-account-evidence"');
    expect(markup).toContain('id="customer-account-operations"');
    expect(markup).toContain('id="notifications"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="customer-booking-create-gates"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="customer-operator-command-queue"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="record-date-filter"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="customer-account-evidence"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="customer-account-operations"');
    expect(markup).toContain('class="card admin-section" id="notifications"');
    expect(markup).not.toContain('<button type="submit">Add address note</button>');
    expect(markup).toContain(
      'class="admin-form-control-button button button-primary" type="submit">Add address note</button>',
    );
    expect(markup).toContain('No saved address yet.');
    expect(markup).toContain('No chat rooms matched this date filter.');
    expect(markup).toContain('class="empty-state');
  });

  it('uses shared Vuexy status badge atoms instead of raw customer detail pill markup', () => {
    expect(customerDetailSource).toContain("from '../../../components/status-badge'");
    expect(customerDetailSource).toContain('AdminSectionHeader');
    expect(customerDetailSource).toContain('AdminNotePanel');
    expect(customerDetailSource).toContain('StatusBadge');
    expect(customerDetailSource).not.toContain('PillClassBadge');
    expect(customerDetailSource).not.toContain('<div className="ops-section-header');
    expect(customerDetailSource).not.toContain('<div className={`ops-task-note');
    expect(customerDetailSource).not.toContain('<div className="ops-task-note ops-task-pending admin-mt-14">');
    expect(customerDetailSource).not.toContain('<div className="ops-task-note ops-task-info">');
    expect(customerDetailSource).not.toContain('<div className="ops-task-note ops-task-info" id="addresses">');
    expect(customerDetailSource).not.toContain('<span className="pill');
    expect(customerDetailSource).not.toContain('<span className={`pill');
  });

  it('uses the shared Vuexy form control link for button-style customer actions', () => {
    expect(customerDetailSource).toContain('AdminFormControlLink');
    expect(customerDetailSource).not.toContain('<Link className="button button-secondary"');
  });

  it('uses the shared Vuexy card surface for customer chat history rooms', () => {
    expect(customerDetailSource).toContain('AdminCard');
    expect(customerDetailSource).not.toContain('<div className="card customer-chat-history-room-card">');
  });

  it('uses the shared table pagination footer for customer chat history', () => {
    expect(customerDetailSource).toContain('AdminTablePaginationFooter');
    expect(customerDetailSource).toContain('className="customer-chat-history-footer"');
    expect(customerDetailSource).not.toContain('<AdminTableFooter');
    expect(customerDetailSource).not.toContain(
      'Showing {chatHistoryPageFrom} to {chatHistoryPageTo} of {filteredChatBookings.length} rooms',
    );
  });

  it('uses the shared MoneyText atom for visible customer wallet money values', () => {
    expect(customerDetailSource).toContain("from '../../../components/money-text'");
    expect(customerDetailSource).toContain('value: <MoneyText amount={wallet.customerBalance}');
    expect(customerDetailSource).not.toContain('value: formatMoney(wallet.customerBalance)');
    expect(customerDetailSource).not.toContain(
      '<StatusBadge tone="info">{formatMoney(wallet.customerBalance)}</StatusBadge>',
    );
    expect(customerDetailSource).not.toContain('<span>{formatMoney(wallet.capturedSpend)}</span>');
  });

  it('uses the shared MoneyText atom for customer overview payment helper amounts', () => {
    expect(customerDetailSource).not.toContain(
      '`${latestPaymentBooking.payment.status} / ${formatMoney(Number(latestPaymentBooking.payment.amount ?? 0))}`',
    );
    expect(customerDetailSource).not.toContain(
      'helper: formatMoney(refunds.reduce((sum, refund) => sum + Number(refund.amount ?? 0), 0))',
    );
  });
});

function customerDetail(): AdminCustomerDetail {
  return {
    addresses: [],
    auditLogs: [],
    bookings: [],
    favoriteProviders: [],
    id: 'customer-1',
    providerReviews: [],
    reviews: [],
    selectedLocations: [],
    user: {
      appSessions: [],
      createdAt: '2026-07-01T00:00:00.000Z',
      email: 'smoke.customer@example.com',
      fullName: 'Smoke Customer',
      id: 'user-1',
      notifications: [],
      phone: '+84900000000',
      pushDevices: [],
      updatedAt: '2026-07-01T00:00:00.000Z',
    },
    userId: 'user-1',
    viewedProviders: [],
  } as unknown as AdminCustomerDetail;
}
