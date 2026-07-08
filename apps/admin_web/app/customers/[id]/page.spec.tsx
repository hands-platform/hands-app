import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import type { AdminCustomerDetail } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import CustomerDetailPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

vi.mock('../../../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn(),
}));

const mockedAdminGet = vi.mocked(adminGet);
const mockedGetCurrentAdminOperatorAccess = vi.mocked(getCurrentAdminOperatorAccess);
const customerDetailSource = readFileSync('app/customers/[id]/page.tsx', 'utf8');

describe('CustomerDetailPage', () => {
  beforeEach(() => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: [],
      email: 'master@example.com',
      fullName: 'Master Admin',
      id: 'master-1',
      phone: null,
      roles: ['ADMIN', 'MASTER_ADMIN'],
      updatedAt: null,
    });
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/customers/customer-1' || href === '/admin/customers/customer-1?includeDiagnostics=true') {
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
    expect(markup).toContain('id="customer-record-archive-summary"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="customer-booking-create-gates"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="customer-operator-command-queue"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="record-date-filter"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="customer-account-evidence"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="customer-account-operations"');
    expect(markup).not.toContain('<button type="submit">Add address note</button>');
    expect(markup).toContain(
      'class="admin-form-control-button button button-primary" type="submit">Add address note</button>',
    );
    expect(markup).toContain('No saved address yet.');
    expect(markup).toContain('Load record archive');
    expect(markup).not.toContain('No chat rooms matched this date filter.');
    expect(markup).toContain('class="empty-state');
  });

  it('requests customer detail without diagnostics for ordinary operators', async () => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: ['CUSTOMERS_DETAIL'],
      email: 'ops@example.com',
      fullName: 'Ops',
      id: 'ops-1',
      phone: null,
      roles: ['ADMIN'],
      updatedAt: null,
    });
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (
        href === '/admin/customers/customer-no-diagnostics' ||
        href === '/admin/customers/customer-no-diagnostics?includeDiagnostics=false'
      ) {
        return customerDetail();
      }

      return fallback;
    });

    const page = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-no-diagnostics' }),
      searchParams: Promise.resolve({ records: 'all' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/customers/customer-no-diagnostics?includeDiagnostics=false',
      null,
    );
    expect(mockedAdminGet).not.toHaveBeenCalledWith(
      '/admin/customers/customer-no-diagnostics?includeDiagnostics=true',
      null,
    );
    expect(markup).not.toContain('No app session');
    expect(markup).not.toContain('No push device');
    expect(markup).not.toContain('App sessions');
  });

  it('keeps customer chat and audit archive rows collapsed by default', async () => {
    const page = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-1' }),
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('id="customer-record-archive-summary"');
    expect(markup).toContain('Load record archive');
    expect(markup).toContain('/customers/customer-1?records=all#chat-history');
    expect(markup).not.toContain('customer-chat-history-section');
    expect(markup).not.toContain('id="notifications"');
  });

  it('uses a protected server export route instead of embedding activity CSV data in the detail HTML', async () => {
    const page = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-1' }),
      searchParams: Promise.resolve({ range: '7d', type: 'BOOKING' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain(
      'href="/api/admin/customers/customer-1/activity/export?range=7d&amp;type=BOOKING"',
    );
    expect(markup).not.toContain('data:text/csv');
  });

  it('renders customer chat and audit archive rows when records=all is requested', async () => {
    const page = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-1' }),
      searchParams: Promise.resolve({ records: 'all' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('customer-chat-history-section');
    expect(markup).toContain('id="notifications"');
    expect(markup).toContain('No chat rooms matched this date filter.');
  });

  it('keeps customer archive and support copy operator-facing', () => {
    expect(customerDetailSource).toContain('support checks');
    expect(customerDetailSource).toContain('Notification and audit records');
    expect(customerDetailSource).toContain('Record archive summary');
    expect(customerDetailSource).toContain('Saved service addresses');
    expect(customerDetailSource).not.toContain('setup checks');
    expect(customerDetailSource).not.toContain('Notification and audit trace');
    expect(customerDetailSource).not.toContain('Record archive loaded on demand');
    expect(customerDetailSource).not.toContain('Address snapshot metadata missing');
    expect(customerDetailSource).not.toContain("label: 'Address snapshots'");
  });

  it('uses shared Vuexy status badge atoms instead of raw customer detail pill markup', () => {
    expect(customerDetailSource).toContain('AdminTraceSummary');
    expect(customerDetailSource).toContain("from '../../../components/status-badge'");
    expect(customerDetailSource).toContain('AdminSectionHeader');
    expect(customerDetailSource).toContain('AdminNotePanel');
    expect(customerDetailSource).toContain('AdminStageItem');
    expect(customerDetailSource).toContain('AdminStageList');
    expect(customerDetailSource).toContain('AdminFilterChipGroup');
    expect(customerDetailSource).toContain('StatusBadge');
    expect(customerDetailSource).toContain('StatusBadgeFromPillClass');
    expect(customerDetailSource).not.toContain('statusBadgeToneFromPillClass');
    expect(customerDetailSource).not.toContain('PillClassBadge');
    expect(customerDetailSource).not.toContain('<div className="participant-list');
    expect(customerDetailSource).not.toContain('className="setup-stage-item"');
    expect(customerDetailSource).not.toContain('<div className="setup-stage-list');
    expect(customerDetailSource).not.toContain('<div className="ops-section-header');
    expect(customerDetailSource).not.toContain('<div className={`ops-task-note');
    expect(customerDetailSource).not.toContain(
      '<div className="ops-task-note ops-task-pending admin-mt-14">',
    );
    expect(customerDetailSource).not.toContain('<div className="ops-task-note ops-task-info">');
    expect(customerDetailSource).not.toContain(
      '<div className="ops-task-note ops-task-info" id="addresses">',
    );
    expect(customerDetailSource).not.toContain('<div className="service-trace-summary admin-mt-12">');
    expect(customerDetailSource).not.toContain('<span className="pill');
    expect(customerDetailSource).not.toContain('<span className={`pill');
  });

  it('uses the shared Vuexy form control link for button-style customer actions', () => {
    expect(customerDetailSource).toContain('AdminFormControlLink');
    expect(customerDetailSource).toContain('AdminTextLink');
    expect(customerDetailSource).not.toContain('<Link className="button button-secondary"');
    expect(customerDetailSource).not.toContain('className="text-link"');
  });

  it('uses the shared Vuexy card surface for customer chat history rooms', () => {
    expect(customerDetailSource).toContain('AdminCard');
    expect(customerDetailSource).not.toContain('<div className="card customer-chat-history-room-card">');
  });

  it('passes raw chat timestamps to the shared date atom instead of formatting locally', () => {
    expect(customerDetailSource).toContain('createdDateTime: message.createdAt');
    expect(customerDetailSource).not.toContain('createdLabel: formatDate(message.createdAt)');
  });

  it('uses the shared DateTimeText atom for visible customer detail table timestamps', () => {
    expect(customerDetailSource).toContain("from '../../../components/date-time-text'");
    expect(customerDetailSource).not.toContain('<small>{formatDate(attempt.at)}</small>');
    expect(customerDetailSource).not.toContain('<td>{formatDate(notification.createdAt)}</td>');
    expect(customerDetailSource).not.toContain('<td>{formatDate(log.createdAt)}</td>');
  });

  it('uses the shared DateTimeText atom for visible customer overview timestamps', () => {
    expect(customerDetailSource).toContain("valueDateTimeFallback: 'Unknown'");
    expect(customerDetailSource).toContain('valueDateTimeValue: customer.user?.createdAt');
    expect(customerDetailSource).toContain("valueDateTimeFallback: 'No session'");
    expect(customerDetailSource).toContain('valueDateTimeValue: latestSession?.lastSeenAt');
    expect(customerDetailSource).toContain(
      '<DateTimeText value={bookingLatestActivityAt(lastCompletedBooking)} />',
    );
    expect(customerDetailSource).toContain('<DateTimeText value={bookingLatestActivityAt(latestBooking)} />');
    expect(customerDetailSource).not.toContain(
      'value: <DateTimeText fallback="Unknown" value={customer.user?.createdAt} />',
    );
    expect(customerDetailSource).not.toContain(
      'value: <DateTimeText fallback="No session" value={latestSession?.lastSeenAt} />',
    );
    expect(customerDetailSource).not.toContain('value: formatDate(customer.user?.createdAt)');
    expect(customerDetailSource).not.toContain('value: formatDate(latestSession?.lastSeenAt)');
  });

  it('uses the shared DateTimeText atom for customer partner rail helper timestamps', () => {
    const overviewSource = readFileSync(
      new URL('./customer-detail-overview-shell.tsx', import.meta.url),
      'utf8',
    );

    expect(overviewSource).toContain('readonly helper: ReactNode;');
    expect(customerDetailSource).toContain('Saved <DateTimeText value={favorite.createdAt} />');
    expect(customerDetailSource).toContain('Last viewed <DateTimeText value={view.lastViewedAt} />');
    expect(customerDetailSource).toContain(
      'Latest completed <DateTimeText value={bookingLatestActivityAt(booking)} />',
    );
    expect(customerDetailSource).not.toContain('helper: `Saved ${formatDate(favorite.createdAt)}`');
    expect(customerDetailSource).not.toContain(
      'helper: `Latest completed ${formatDate(bookingLatestActivityAt(booking))}`',
    );
  });

  it('uses the shared DateTimeText atom for selected location address labels', () => {
    expect(customerDetailSource).toContain('labelNode?: ReactNode;');
    expect(customerDetailSource).toContain('{address.labelNode ?? address.label}');
    expect(customerDetailSource).toContain(
      'Selected service address <DateTimeText value={location.createdAt} />',
    );
    expect(customerDetailSource).not.toContain(
      'label: `Selected service address ${formatDate(location.createdAt)}`',
    );
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

  it('uses the shared MoneyText atom for visible customer command queue payment amounts', () => {
    expect(customerDetailSource).toContain('detailNode?: ReactNode;');
    expect(customerDetailSource).toContain('{command.detailNode ?? command.detail}');
    expect(customerDetailSource).toContain(
      '<MoneyText amount={Number(paymentIssueBooking.payment?.amount ?? 0)}',
    );
    expect(customerDetailSource).not.toContain('formatMoney(paymentAmount, paymentCurrency)');
    expect(customerDetailSource).not.toContain(
      '} / ${formatMoney(Number(paymentIssueBooking.payment?.amount ?? 0))}`',
    );
  });

  it('uses shared atoms for customer action panel refund and stale session facts', () => {
    expect(customerDetailSource).toContain('joinCustomerActivityFacts(activityFacts)');
    expect(customerDetailSource).toContain('<MoneyText amount={wallet.refundAmount} />');
    expect(customerDetailSource).toContain('Last seen <DateTimeText value={latestSession.lastSeenAt} />');
    expect(customerDetailSource).not.toContain(
      'wallet.refundAmount > 0 ? `${formatMoney(wallet.refundAmount)} refund record(s)`',
    );
    expect(customerDetailSource).not.toContain('`Last seen ${formatDate(latestSession.lastSeenAt)} on ${');
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
