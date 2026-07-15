import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import PartnerControlsPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const partnerControlsSource = readFileSync('app/partner-controls/page.tsx', 'utf8');

describe('PartnerControlsPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('renders each Partner control workspace on shared Vuexy section surfaces', async () => {
    const summaryMarkup = renderToStaticMarkup(
      await PartnerControlsPage({ searchParams: Promise.resolve({}) }),
    );
    const controlsMarkup = renderToStaticMarkup(
      await PartnerControlsPage({ searchParams: Promise.resolve({ details: 'controls' }) }),
    );
    const reportsMarkup = renderToStaticMarkup(
      await PartnerControlsPage({ searchParams: Promise.resolve({ details: 'reports' }) }),
    );
    const sanctionsMarkup = renderToStaticMarkup(
      await PartnerControlsPage({ searchParams: Promise.resolve({ details: 'sanctions' }) }),
    );

    expect(summaryMarkup).toContain('id="partner-control-command-center"');
    expect(summaryMarkup).toContain('id="partner-control-next-actions"');
    expect(summaryMarkup).toContain('Partner control workspaces');
    expect(summaryMarkup).not.toContain('id="partner-control-board"');

    expect(controlsMarkup).toContain('id="partner-control-board"');
    expect(controlsMarkup).toContain('id="partner-control-unblock-board"');
    expect(controlsMarkup).toContain('id="partner-control-unblock-playbook"');
    expect(controlsMarkup).toContain('id="partner-control-block-matrix"');
    expect(controlsMarkup).toContain('id="partner-control-checklist"');
    expect(controlsMarkup).not.toContain('id="partner-control-reports"');

    expect(reportsMarkup).toContain('id="partner-control-filters"');
    expect(reportsMarkup).toContain('id="partner-control-create-report"');
    expect(reportsMarkup).toContain('id="partner-control-reports"');
    expect(reportsMarkup).not.toContain('id="partner-control-account-controls"');

    expect(sanctionsMarkup).toContain('id="partner-control-filters"');
    expect(sanctionsMarkup).toContain('id="partner-control-account-controls"');
    expect(sanctionsMarkup).not.toContain('id="partner-control-create-report"');
  });

  it('uses shared Vuexy status badge atoms instead of raw partner control pill markup', () => {
    expect(partnerControlsSource).toContain("from '../../components/status-badge'");
    expect(partnerControlsSource).toContain('AdminFilterChipGroup');
    expect(partnerControlsSource).toContain('AdminFilterSummary');
    expect(partnerControlsSource).toContain('StatusBadge');
    expect(partnerControlsSource).toContain('StatusBadgeFromPillClass');
    expect(partnerControlsSource).not.toContain('statusBadgeToneFromPillClass');
    expect(partnerControlsSource).not.toContain('function PartnerControlStatusBadge');
    expect(partnerControlsSource).not.toContain('partnerControlStatusBadgeExtraClassName');
    expect(partnerControlsSource).not.toContain('PillClassBadge');
    expect(partnerControlsSource).not.toContain('<div className="participant-list');
    expect(partnerControlsSource).not.toContain('<span className="pill');
    expect(partnerControlsSource).not.toContain('<span className={`pill');
  });

  it('uses the shared Vuexy text link atom for inline navigation', () => {
    expect(partnerControlsSource).toContain('AdminTextLink');
    expect(partnerControlsSource).not.toContain('className="text-link"');
  });

  it('uses the shared Vuexy stage item atom for partner control row surfaces', () => {
    expect(partnerControlsSource).toContain('AdminStageItem');
    expect(partnerControlsSource).toContain('AdminStageList');
    expect(partnerControlsSource).not.toContain('<div className="setup-stage-list admin-mt-12">');
    expect(partnerControlsSource).not.toContain('className="setup-stage-item"');
  });

  it('keeps Partner control command cards on shared Vuexy task surfaces', () => {
    expect(partnerControlsSource).toContain('AdminActionCard');
    expect(partnerControlsSource).toContain('AdminTaskBreakdown');
    expect(partnerControlsSource).toContain('AdminTaskCard');
    expect(partnerControlsSource).toContain('AdminTaskGrid');
    expect(partnerControlsSource).not.toContain('<div className="ops-task-breakdown">');
    expect(partnerControlsSource).not.toContain('<div className="ops-task-grid admin-mt-12">');
    expect(partnerControlsSource).not.toContain('className={`ops-task-card');
    expect(partnerControlsSource).not.toContain('className={`ops-task-breakdown-item');
    expect(partnerControlsSource).not.toContain('className="ops-task-card"');
    expect(partnerControlsSource).not.toContain('ops-task-card-action');
  });

  it('uses the shared Vuexy money atom for visible wallet amounts', () => {
    expect(partnerControlsSource).toContain('MoneyText');
    expect(partnerControlsSource).not.toContain('helper={`Wallet ${formatMoney(item.walletBalance)}');
    expect(partnerControlsSource).not.toContain('<strong>{formatMoney(item.walletBalance)}</strong>');
    expect(partnerControlsSource).not.toContain("metric(\n          'Debt',\n          formatMoney");
    expect(partnerControlsSource).toContain('reason: <><MoneyText amount={Math.abs(item.walletBalance)} /> cash/company fee debt is still open.</>');
    expect(partnerControlsSource).toContain('detail: <><MoneyText amount={Math.abs(item.walletBalance)} /> must be settled or offset before final acceptance, service start, or payout release.</>');
    expect(partnerControlsSource).not.toContain('reason: `${formatMoney(Math.abs(item.walletBalance))} cash/company fee debt is still open.`');
    expect(partnerControlsSource).not.toContain('detail: `${formatMoney(Math.abs(item.walletBalance))} must be settled or offset before final acceptance, service start, or payout release.`');
  });

  it('uses the shared Vuexy date atom for visible report and account-control timestamps', () => {
    expect(partnerControlsSource).toContain('DateTimeText');
    expect(partnerControlsSource).not.toContain('formatDateTime,');
    expect(partnerControlsSource).not.toContain('function formatDate(value?: string | null)');
    expect(partnerControlsSource).not.toContain('{report.category} / {report.source} / {formatDate(report.createdAt)}');
    expect(partnerControlsSource).not.toContain('Started: {formatDate(sanction.startsAt)}');
    expect(partnerControlsSource).not.toContain('Expires: {formatDate(sanction.expiresAt)}');
    expect(partnerControlsSource).not.toContain('Lifted: {formatDate(sanction.liftedAt)}');
  });

  it('uses shared labeled form atoms for partner control forms', async () => {
    const page = await PartnerControlsPage({ searchParams: Promise.resolve({ details: 'reports' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('admin-form-control-labeled admin-form-control-fluid');
    expect(markup).toContain('admin-grid-span-2');
    expect(markup).not.toContain('partner-control-form-field');
    expect(markup).not.toContain('calendar-field');
    expect(partnerControlsSource).not.toContain('partner-control-form-field');
    expect(partnerControlsSource).not.toContain('<div className="calendar-field');
  });

  it('renders active partner control filters through the shared filter summary atom', async () => {
    const page = await PartnerControlsPage({
      searchParams: Promise.resolve({ q: 'cash', sanction: 'ACTIVE', status: 'OPEN' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('aria-label="Active partner control filters"');
    expect(markup).toContain('class="admin-filter-summary full-span"');
    expect(markup).toContain('Search: cash');
    expect(markup).toContain('Report: OPEN');
    expect(markup).toContain('Control: ACTIVE');
  });

  it('uses the shared table pagination footer for reports and account controls', () => {
    expect(partnerControlsSource).toContain('AdminTablePaginationFooter');
    expect(partnerControlsSource).toContain('className="vuexy-partner-table-footer"');
    expect(partnerControlsSource).not.toContain('<AdminTableFooter');
    expect(partnerControlsSource).not.toContain('partnerControlPagedListFooterLabel(');
  });

  it('does not link ordinary Partner control tasks to Developer/System app session diagnostics', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/partner-controls/providers')) {
        return [
          {
            id: 'partner-device-gap',
            displayName: 'Device Gap Partner',
            status: 'OFFLINE',
            user: {
              fullName: 'Device Gap Partner',
              phone: '+84000000001',
              pushDevices: [],
            },
            activitySummary: {
              walletBalance: 0,
            },
          },
        ];
      }

      return fallback;
    });

    const page = await PartnerControlsPage({ searchParams: Promise.resolve({ details: 'controls' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Push/contact readiness');
    expect(markup).not.toContain('href="/app-sessions');
  });
});
