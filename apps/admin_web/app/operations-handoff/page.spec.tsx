import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import OperationsHandoffPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

vi.mock('../../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn(),
}));

const mockedAdminGet = vi.mocked(adminGet);
const mockedGetCurrentAdminOperatorAccess = vi.mocked(getCurrentAdminOperatorAccess);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const globalCss = readFileSync('app/globals.css', 'utf8');

describe('OperationsHandoffPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
    mockedGetCurrentAdminOperatorAccess.mockReset();
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: ['BOOKINGS_REALTIME'],
      email: 'ops@example.com',
      fullName: 'Ops',
      id: 'ops-1',
      phone: null,
      roles: ['ADMIN'],
      updatedAt: null,
    });
  });

  it('renders Operations History as a past-operations review page', async () => {
    const page = await OperationsHandoffPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('toolbar admin-page-header');
    expect(markup).toContain('<h1>Operations History</h1>');
    expect(markup).toContain('Review past operations');
    expect(markup).toContain('href="/"');
    expect(markup).toContain('Start Shift');
    expect(markup).toContain('href="/operations-handoff?details=all&amp;range=7d"');
    expect(markup).toContain('Full history');
    expect(markup).toContain('Open review checks');
    expect(markup).toContain('Booking rows');
    expect(markup).toContain('Failed alerts');
    expect(markup).toContain('Cash debt partners');
    expect(markup).toContain('Finance rows');
    expect(markup).toContain('id="operations-handoff-review-order"');
    expect(markup).toContain('Start with these history lanes before opening Full history tables.');
    expect(markup.indexOf('id="operations-handoff-review-order"')).toBeLessThan(
      markup.indexOf('id="operations-handoff-review-checklist"'),
    );
    expect(markup).toContain('href="/operations-handoff#operations-handoff-review-checklist"');
    expect(markup).toContain('id="operations-handoff-review-checklist"');
    expect(markup).toContain('Detailed history lists');
    expect(markup).toContain('card admin-section admin-mb-16 operations-handoff-full-details-card');
    expect(markup).toContain('admin-form-control-link button button-secondary');
    expect(markup).toContain('/operations-handoff?details=all');
    expect(markup).not.toContain('href="/chat-archive"');
  });

  it('lets operators return from full history details to the compact summary', async () => {
    const page = await OperationsHandoffPage({
      searchParams: Promise.resolve({ details: 'all', range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('<h1>Operations History</h1>');
    expect(markup).toContain('href="/operations-handoff?range=today"');
    expect(markup).toContain('Summary view');
    expect(markup).toContain('href="/operations-handoff?details=all&amp;range=today#operations-handoff-review-checklist"');
    expect(markup).toContain('href="/operations-handoff?details=all&amp;range=today#operations-handoff-booking-history"');
    expect(markup).toContain('href="/operations-handoff?details=all&amp;range=today#operations-handoff-finance-closeout"');
    expect(markup).toContain('Review order');
    expect(markup).toContain('id="operations-handoff-review-order"');
    expect(markup).toContain('Unified activity stream');
    expect(markup).toContain('id="operations-handoff-activity-stream"');
    expect(markup).toContain('Booking history queue');
    expect(markup).toContain('id="operations-handoff-booking-history"');
    expect(markup).toContain('Finance and chat closeout');
    expect(markup).toContain('id="operations-handoff-finance-closeout"');
  });

  it('keeps Start Shift live KPI metrics out of the handoff board', async () => {
    const page = await OperationsHandoffPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Operations review checklist');
    expect(markup).toContain('Operations history notes');
    expect(markup).not.toContain('Customer app online');
    expect(markup).not.toContain('Partner app online');
    expect(markup).not.toContain('Chat rooms');
    expect(markup).not.toContain('Recent FCM sent');
    expect(markup).not.toContain('/app-sessions');
    expect(mockedAdminGet).not.toHaveBeenCalledWith('/admin/app-sessions/summary', null);
  });

  it('uses the shared Vuexy detail grid atom for brief and note panels', () => {
    expect(pageSource).toContain('AdminDetailGrid');
    expect(pageSource).not.toContain('<section className="detail-grid admin-mb-16"');
  });

  it('scopes handoff toolbar styling to direct page and detail grid cards', () => {
    expect(globalCss).toContain('.operations-handoff-page > .card > .toolbar,');
    expect(globalCss).toContain('.operations-handoff-page > .detail-grid > .card > .toolbar {');
    expect(globalCss).toContain('.operations-handoff-page > .card > .toolbar h2,');
    expect(globalCss).toContain('.operations-handoff-page > .detail-grid > .card > .toolbar h2 {');
    expect(globalCss).not.toContain('.operations-handoff-page .card .toolbar');
  });
});
