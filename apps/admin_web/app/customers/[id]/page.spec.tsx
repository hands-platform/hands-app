import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGetResult } from '../../../lib/admin-api';
import type { AdminBookingDetail, AdminCustomerDetail } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import CustomerDetailPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGetResult: vi.fn(),
  };
});

vi.mock('../../../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn(),
}));

const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedGetCurrentAdminOperatorAccess = vi.mocked(getCurrentAdminOperatorAccess);
const customerDetailSource = readFileSync('app/customers/[id]/page.tsx', 'utf8');

function successfulResult<T>(data: T) {
  return { data, ok: true as const, status: 200 };
}

describe('CustomerDetailPage', () => {
  beforeEach(() => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: ['FINANCE_WALLET_ADJUSTMENTS'],
      email: 'master@example.com',
      fullName: 'Master Admin',
      id: 'master-1',
      phone: null,
      roles: ['ADMIN', 'MASTER_ADMIN'],
      updatedAt: null,
    });
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (
        href === '/admin/customers/customer-1' ||
        href === '/admin/customers/customer-1?includeDiagnostics=false' ||
        href === '/admin/customers/customer-1?includeDiagnostics=true'
      ) {
        return successfulResult(customerDetail());
      }

      if (href === '/admin/wallet-adjustments/open-periods') {
        return successfulResult([
          {
            currency: 'VND',
            id: 'period-2026-08',
            period: '2026-08',
            status: 'DRAFT',
            updatedAt: '2026-08-10T00:00:00.000Z',
          },
        ]);
      }

      return successfulResult(fallback);
    });
  });

  it('consolidates operations, account money, profile contact, and retained records on one page', async () => {
    const page = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-1' }),
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('admin-page-header admin-page-header-toolbar');
    expect(markup).not.toContain('id="customer-workspace-selector"');
    expect(markup).toContain('Current status');
    expect(markup).toContain('Profile and contact');
    expect(markup.match(/Profile and contact/g)).toHaveLength(1);
    expect(markup).toContain('No open action');
    expect(markup.indexOf('No open action')).toBeLessThan(markup.indexOf('Current status'));
    expect(markup.indexOf('Current status')).toBeLessThan(markup.indexOf('Recent bookings'));
    expect(markup).toContain('Recent bookings');
    expect(markup).toContain('id="customer-operator-command-queue"');
    expect(markup).toContain('Payment &amp; wallet');
    expect(markup).toContain('id="customer-wallet-adjustment-request"');
    expect(markup).toContain('id="customer-account-operations"');
    expect(markup).toContain('Financial adjustment');
    expect(markup).not.toContain('Add balance (Credit)');
    expect(markup).not.toContain('name="executionMode" value="customer-direct"');
    expect(markup).toContain('?action=wallet#customer-wallet-adjustment-request');
    expect(markup).toContain(
      'class="card admin-card admin-profile-overview-card customer-detail-overview-card"',
    );
    expect(markup).toContain('Wallet transaction history');
    expect(markup).not.toContain('Recent manual wallet adjustments');
    expect(markup).not.toContain('Pending wallet requests');
    expect(markup).toContain('No saved address yet.');
    expect(markup).not.toContain('Customer behavior');
    expect(markup).not.toContain('Usage and region summary');
    expect(markup).toContain('Referral activity');
    expect(markup).toContain('No customer referral activity is recorded.');
    expect(markup).toContain('id="customer-app-notifications"');
    expect(markup).toContain('Customer app notifications');
    expect(markup).toContain('Push unavailable');
    expect(markup).not.toContain('name="title"');
    expect(markup).toContain('Notification history');
    expect(markup).not.toContain('Audit record filters');
    expect(markup).toContain('Export retained customer activity CSV');
    expect(markup).toContain('Add customer activity note');
    expect(markup).toContain('Operator note history');
    expect(markup).toContain('?action=note#customer-operator-notes');
    expect(markup).not.toContain('name="preset"');
    expect(markup).not.toContain('No customer booking activity yet.');
    expect(markup).toContain('id="customer-chat-system-evidence"');
    expect(markup).toContain('customer-chat-history-section');
    expect(markup).not.toContain('id="customer-system-diagnostics"');
    expect(markup).toContain('Load developer/system evidence');
    expect(markup).toContain('+84900000000');
    expect(markup).not.toContain('Load record archive');
    expect(markup).not.toContain('id="customer-account-evidence"');
    expect(markup).not.toContain('Add address note');
    expect(
      mockedAdminGetResult.mock.calls.some(([href]) =>
        href.startsWith('/admin/customers/customer-1/wallet-ledger?take=10&skip=0'),
      ),
    ).toBe(true);
    expect(
      mockedAdminGetResult.mock.calls.some(([href]) =>
        href.startsWith('/admin/wallet-adjustment-requests?status=REQUESTED'),
      ),
    ).toBe(false);

    mockedAdminGetResult.mockClear();
    const legacyViewPage = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-1' }),
      searchParams: Promise.resolve({ view: 'records' }),
    });
    const legacyViewMarkup = renderToStaticMarkup(legacyViewPage);

    expect(legacyViewMarkup).toContain('Current status');
    expect(legacyViewMarkup).toContain('Payment &amp; wallet');
    expect(legacyViewMarkup).not.toContain('Audit record filters');
    expect(legacyViewMarkup).not.toContain('name="view"');
    expect(legacyViewMarkup).not.toContain('view=records');
  });

  it('renders only the selected customer write panel and keeps its target fixed', async () => {
    const walletPage = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-1' }),
      searchParams: Promise.resolve({ action: 'wallet' }),
    });
    const walletMarkup = renderToStaticMarkup(walletPage);
    expect(walletMarkup).toContain('name="ownerId" value="customer-1"');
    expect(walletMarkup).toContain('Review balance change');
    expect(walletMarkup).not.toContain('name="title"');
    expect(walletMarkup).not.toContain('name="preset"');

    const messagePage = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-1' }),
      searchParams: Promise.resolve({ action: 'message' }),
    });
    const messageMarkup = renderToStaticMarkup(messagePage);
    expect(messageMarkup).toContain('Push unavailable');
    expect(messageMarkup).not.toContain('Message target');
    expect(messageMarkup).not.toContain('name="targetUserId"');

    const notePage = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-1' }),
      searchParams: Promise.resolve({ action: 'note' }),
    });
    const noteMarkup = renderToStaticMarkup(notePage);
    expect(noteMarkup).toContain('Note target');
    expect(noteMarkup).toContain('name="customerId" value="customer-1"');
    expect(noteMarkup).not.toContain('name="ownerId"');
    expect(noteMarkup).not.toContain('name="title"');
  });

  it('defaults an operator note to no booking and keeps same-prefix booking options distinct', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href === '/admin/customers/customer-1?includeDiagnostics=false') {
        return successfulResult(customerDetail({
          bookings: [
            customerBooking('audit_post_match_booking_alpha'),
            customerBooking('audit_post_match_booking_bravo'),
          ],
        }));
      }
      return successfulResult(fallback);
    });

    const page = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-1' }),
      searchParams: Promise.resolve({ action: 'note' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('<option value="" selected="">No booking link</option>');
    expect(markup).toContain('...king_alpha');
    expect(markup).toContain('...king_bravo');
  });

  it('uses the safe session summary for language and last app activity', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href === '/admin/customers/customer-1?includeDiagnostics=false') {
        return successfulResult(customerDetail({
          sessionSummary: {
            deviceLanguage: 'vi-VN',
            lastSeenAt: '2026-08-05T09:30:00.000Z',
          },
        }));
      }
      return successfulResult(fallback);
    });

    const page = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-1' }),
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('vi-VN / Not saved');
    expect(markup).toContain('Vietnam');
    expect(markup).toContain('Last seen');
  });

  it('shows retained operator notes and customer referral relationships with their real labels', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href === '/admin/customers/customer-1?includeDiagnostics=false') {
        return successfulResult(customerDetail({
          operatorNotes: [
            {
              action: 'customer.ops_note.add',
              actor: { fullName: 'Support Operator', id: 'operator-1' },
              createdAt: '2026-07-10T09:30:00.000Z',
              id: 'note-1',
              metadata: { note: 'Confirmed the customer address by phone.' },
              target: 'customer:customer-1',
            },
          ],
          referralCodes: [
            {
              active: true,
              code: 'CUSTOMER10',
              createdAt: '2026-07-01T00:00:00.000Z',
              id: 'code-1',
            },
          ],
          referralsMade: [
            {
              createdAt: '2026-07-11T00:00:00.000Z',
              fraudReviewStatus: 'CLEAR',
              id: 'referral-made-1',
              referralCode: {
                active: true,
                code: 'CUSTOMER10',
                createdAt: '2026-07-01T00:00:00.000Z',
                id: 'code-1',
              },
              referredCustomerProfile: {
                id: 'customer-referred',
                user: { fullName: 'Referred Customer', id: 'user-referred' },
              },
              referrerCustomerProfile: {
                id: 'customer-1',
                user: { fullName: 'Smoke Customer', id: 'user-1' },
              },
              rewards: [
                {
                  amount: 100000,
                  availableAt: '2026-07-19T00:00:00.000Z',
                  createdAt: '2026-07-12T00:00:00.000Z',
                  currency: 'VND',
                  id: 'reward-1',
                  qualifyingBookingId: 'booking-qualified-1',
                  status: 'CREDITED',
                  walletOwnerCustomerProfileId: 'customer-1',
                },
              ],
              status: 'REWARDED',
            },
          ],
          referralsReceived: [
            {
              createdAt: '2026-07-01T00:00:00.000Z',
              fraudReviewStatus: 'CLEAR',
              id: 'referral-received-1',
              referralCode: {
                active: true,
                code: 'INVITER20',
                createdAt: '2026-06-30T00:00:00.000Z',
                id: 'code-inviter',
              },
              referredCustomerProfile: {
                id: 'customer-1',
                user: { fullName: 'Smoke Customer', id: 'user-1' },
              },
              referrerCustomerProfile: {
                id: 'customer-inviter',
                user: { fullName: 'Inviter Customer', id: 'user-inviter' },
              },
              rewards: [],
              status: 'QUALIFIED',
            },
          ],
        }));
      }

      return successfulResult(fallback);
    });

    const page = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-1' }),
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Support Operator');
    expect(markup).toContain('Confirmed the customer address by phone.');
    expect(markup).toContain('CUSTOMER10');
    expect(markup).toContain('Inviter Customer');
    expect(markup).toContain('Referred Customer');
    expect(markup).toContain('Customer referral code');
    expect(markup).toContain('Credited');
    expect(markup).toContain('Reward booking');
    expect(markup).toContain('href="/bookings/booking-qualified-1"');
    expect(markup).toContain('CREDITED');
    expect(markup).toContain('100.000 VND');
  });

  it('renders the customer booking create gate section only when gate attempts exist', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href === '/admin/customers/customer-with-gate?includeDiagnostics=true') {
        return successfulResult(customerDetail({
          auditLogs: [
            {
              action: 'booking.create.rejected',
              actor: { id: 'system', fullName: 'System' },
              createdAt: '2026-07-01T00:00:00.000Z',
              id: 'audit-gate-1',
              metadata: {
                bookingAddress: { addressText: 'District 1, Ho Chi Minh City' },
                reasonCode: 'CUSTOMER_OUT_OF_RANGE',
              },
              target: 'customer:customer-with-gate',
            },
          ],
        }));
      }

      return successfulResult(fallback);
    });

    const page = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-with-gate' }),
      searchParams: Promise.resolve({ diagnostics: 'developer' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('id="customer-booking-create-gates"');
    expect(markup).toContain('Booking gate queue');
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
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (
        href === '/admin/customers/customer-no-diagnostics' ||
        href === '/admin/customers/customer-no-diagnostics?includeDiagnostics=false'
      ) {
        return successfulResult(customerDetail());
      }

      return successfulResult(fallback);
    });

    const page = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-no-diagnostics' }),
      searchParams: Promise.resolve({ records: 'all' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/customers/customer-no-diagnostics?includeDiagnostics=false',
      null,
    );
    expect(mockedAdminGetResult).not.toHaveBeenCalledWith(
      '/admin/customers/customer-no-diagnostics?includeDiagnostics=true',
      null,
    );
    expect(markup).toContain('Language and profile');
    expect(markup).toContain('Not recorded');
    expect(markup).toContain('No active device');
    expect(markup).not.toContain('App sessions');
  });

  it('shows customer chat as compact disclosures and loads system evidence only on request', async () => {
    const page = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-1' }),
      searchParams: Promise.resolve({ diagnostics: 'developer' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('id="customer-chat-system-evidence"');
    expect(markup).toContain('customer-chat-history-section');
    expect(markup).toContain('id="customer-system-diagnostics"');
    expect(markup).toContain('Hide developer/system evidence');
    expect(markup).not.toContain('Load record archive');
    expect(customerDetailSource).toContain('customer-chat-history-disclosure');
    expect(markup).not.toContain('id="notifications"');
  });

  it('uses an unfiltered protected server export route instead of embedding activity CSV data in the detail HTML', async () => {
    const page = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-1' }),
      searchParams: Promise.resolve({ range: '7d', type: 'BOOKING', view: 'records' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('href="/api/admin/customers/customer-1/activity/export"');
    expect(markup).not.toContain('Audit record filters');
    expect(markup).not.toContain('range=7d');
    expect(markup).not.toContain('data:text/csv');
  });

  it('keeps legacy records=all links compatible while rendering the always-visible archive', async () => {
    const page = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-1' }),
      searchParams: Promise.resolve({ records: 'all' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('customer-chat-history-section');
    expect(markup).not.toContain('id="customer-system-diagnostics"');
    expect(markup).toContain('id="customer-app-notifications"');
    expect(markup).toContain('No retained customer chat rooms are available.');
  });

  it('treats only a customer 404 as not found', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) =>
      href.includes('/admin/customers/missing-customer?')
        ? { data: null, ok: false, status: 404 }
        : successfulResult(fallback),
    );

    await expect(
      CustomerDetailPage({
        params: Promise.resolve({ id: 'missing-customer' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow();
  });

  it('renders an unavailable state instead of not found for a customer API failure', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) =>
      href.includes('/admin/customers/customer-1?')
        ? { data: null, ok: false, status: 500 }
        : successfulResult(fallback),
    );

    const page = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-1' }),
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Customer detail unavailable');
    expect(markup).not.toContain('No open action');
  });

  it('keeps customer details visible when only wallet data is unavailable', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href === '/admin/customers/customer-1?includeDiagnostics=false') {
        return successfulResult(customerDetail());
      }
      if (href.includes('/wallet-ledger?')) {
        return { data: fallback, ok: false, status: 500 };
      }
      return successfulResult(fallback);
    });

    const page = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-1' }),
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Smoke Customer');
    expect(markup).toContain('Wallet data unavailable');
    expect(markup).toContain('wallet check incomplete');
    expect(markup).not.toContain('Wallet transaction history');
  });

  it('keeps customer archive and support copy operator-facing', () => {
    expect(customerDetailSource).toContain('Customer app notifications');
    expect(customerDetailSource).toContain('System audit records');
    expect(customerDetailSource).toContain('System audit evidence');
    expect(customerDetailSource).toContain('Chat and system evidence');
    expect(customerDetailSource).not.toContain('Archived evidence summary');
    expect(customerDetailSource).not.toContain('Load record archive');
    expect(customerDetailSource).toContain('Selected service address');
    expect(customerDetailSource).not.toContain('setup checks');
    expect(customerDetailSource).not.toContain('Notification and audit trace');
    expect(customerDetailSource).not.toContain('Record archive loaded on demand');
    expect(customerDetailSource).not.toContain('Address snapshot metadata missing');
    expect(customerDetailSource).not.toContain("label: 'Address snapshots'");
  });

  it('renders the same customer app notifications and an individual push form', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href === '/admin/customers/customer-1?includeDiagnostics=false') {
        return successfulResult(customerDetail({
          user: {
            ...customerDetail().user,
            notifications: [
              {
                body: '100,000 VND was added to your HANDS wallet.',
                createdAt: '2026-07-17T08:00:00.000Z',
                deliveries: [{ attemptedAt: '2026-07-17T08:00:01.000Z', provider: 'FCM', status: 'SENT' }],
                id: 'notification-1',
                readAt: null,
                title: 'Wallet credited',
                type: 'customer.wallet.manual_adjustment',
              },
            ],
            pushDevices: [
              {
                enabled: true,
                id: 'push-device-1',
                platform: 'android',
                role: 'CUSTOMER',
              },
            ],
          },
        }));
      }
      return successfulResult(fallback);
    });

    const page = await CustomerDetailPage({
      params: Promise.resolve({ id: 'customer-1' }),
      searchParams: Promise.resolve({ action: 'message' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Wallet credited');
    expect(markup).toContain('100,000 VND was added to your HANDS wallet.');
    expect(markup).toContain('name="targetUserId" value="user-1"');
    expect(markup).toContain('Send to customer');
    expect(markup).toContain('Push ready');
    expect(markup).not.toContain('payment.updated');
  });

  it('uses shared Vuexy status badge atoms instead of raw customer detail pill markup', () => {
    expect(customerDetailSource).not.toContain('AdminTraceSummary');
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

  it('uses the shared native details surface for customer chat history rooms', () => {
    expect(customerDetailSource).toContain('AdminDetails');
    expect(customerDetailSource).toContain('name="customer-chat-history"');
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

  it('keeps account timestamps in profile facts and removes the usage summary timestamp card', () => {
    expect(customerDetailSource).toContain("valueDateTimeFallback: 'Unknown'");
    expect(customerDetailSource).toContain('valueDateTimeValue: customer.user?.createdAt');
    expect(customerDetailSource).toContain('<DateTimeText value={latestSession.lastSeenAt} />');
    expect(customerDetailSource).not.toContain('Usage and region summary');
    expect(customerDetailSource).not.toContain("valueDateTimeFallback: 'No session'");
    expect(customerDetailSource).toContain("label: 'App reachability'");
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

  it('keeps customer partner overview rails capped to a compact preview', () => {
    expect(customerDetailSource).toContain('const CUSTOMER_OVERVIEW_PARTNER_PREVIEW_LIMIT = 4;');
    expect(customerDetailSource.match(/\.slice\(0, CUSTOMER_OVERVIEW_PARTNER_PREVIEW_LIMIT\)/g)).toHaveLength(
      3,
    );
  });

  it('uses the shared DateTimeText atom for selected location address labels', () => {
    expect(customerDetailSource).toContain('labelNode?: ReactNode;');
    expect(customerDetailSource).toContain('label: address.labelNode ?? address.label,');
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
    expect(customerDetailSource).not.toContain(
      'value: <MoneyText amount={allTimeActivity.customerWalletBalance}',
    );
    expect(customerDetailSource).toContain(
      '<MoneyText amount={customerWalletLedger.summary.balance} />',
    );
    expect(customerDetailSource).toContain('<MoneyText amount={allTimeActivity.capturedSpend} />');
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

  it('uses all-time exception counts for the customer command queue', () => {
    expect(customerDetailSource).toContain('detailNode?: ReactNode;');
    expect(customerDetailSource).toContain('{command.detailNode ?? command.detail}');
    expect(customerDetailSource).toContain('activitySummary.paymentIssueCount > 0');
    expect(customerDetailSource).toContain('activitySummary.refundRequestCount > 0');
    expect(customerDetailSource).toContain('activitySummary.reportedReviewCount > 0');
    expect(customerDetailSource).not.toContain('formatMoney(paymentAmount, paymentCurrency)');
    expect(customerDetailSource).not.toContain(
      '} / ${formatMoney(Number(paymentIssueBooking.payment?.amount ?? 0))}`',
    );
  });

  it('keeps stale session and unread notifications out of the needs-action queue', () => {
    expect(customerDetailSource).toContain('<MoneyText amount={wallet.refundAmount} />');
    expect(customerDetailSource).not.toContain('joinCustomerActivityFacts(activityFacts)');
    expect(customerDetailSource).not.toContain('No customer booking activity yet.');
    expect(customerDetailSource).not.toContain("id: 'session-stale'");
    expect(customerDetailSource).not.toContain("id: 'unread-notifications'");
    expect(customerDetailSource).not.toContain(
      'wallet.refundAmount > 0 ? `${formatMoney(wallet.refundAmount)} refund record(s)`',
    );
    expect(customerDetailSource).not.toContain('`Last seen ${formatDate(latestSession.lastSeenAt)} on ${');
  });
});

function customerDetail(overrides: Partial<AdminCustomerDetail> = {}): AdminCustomerDetail {
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
    ...overrides,
  } as unknown as AdminCustomerDetail;
}

function customerBooking(id: string): AdminBookingDetail {
  return {
    createdAt: '2026-08-05T11:48:00.000Z',
    id,
    payment: { amount: 300000, currency: 'VND', method: 'CASH', status: 'RELEASED' },
    services: [],
    status: 'CANCELLED',
    statusChangedAt: '2026-08-05T12:00:00.000Z',
    updatedAt: '2026-08-05T12:00:00.000Z',
  } as unknown as AdminBookingDetail;
}
