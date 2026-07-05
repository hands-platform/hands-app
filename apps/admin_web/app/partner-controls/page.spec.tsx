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

  it('renders top partner control boards with the shared Vuexy section surface', async () => {
    const page = await PartnerControlsPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('id="partner-control-command-center"');
    expect(markup).toContain('id="partner-control-next-actions"');
    expect(markup).toContain('id="partner-control-board"');
    expect(markup).toContain('id="partner-control-unblock-board"');
    expect(markup).toContain('id="partner-control-unblock-playbook"');
    expect(markup).toContain('id="partner-control-block-matrix"');
    expect(markup).toContain('id="partner-control-filters"');
    expect(markup).toContain('id="partner-control-checklist"');
    expect(markup).toContain('id="partner-control-create-report"');
    expect(markup).toContain('id="partner-control-reports"');
    expect(markup).toContain('id="partner-control-account-controls"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-command-center"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-next-actions"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-board"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-unblock-board"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-unblock-playbook"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-block-matrix"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-filters"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-checklist"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-create-report"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-reports"');
    expect(markup).toContain('class="card admin-section" id="partner-control-account-controls"');
  });

  it('uses shared Vuexy status badge atoms instead of raw partner control pill markup', () => {
    expect(partnerControlsSource).toContain("from '../../components/status-badge'");
    expect(partnerControlsSource).toContain('StatusBadge');
    expect(partnerControlsSource).toContain('statusBadgeToneFromPillClass');
    expect(partnerControlsSource).not.toContain('PillClassBadge');
    expect(partnerControlsSource).not.toContain('<span className="pill');
    expect(partnerControlsSource).not.toContain('<span className={`pill');
  });

  it('keeps Partner control command cards on shared Vuexy task surfaces', () => {
    expect(partnerControlsSource).toContain('AdminActionCard');
    expect(partnerControlsSource).toContain('AdminTaskCard');
    expect(partnerControlsSource).not.toContain('className={`ops-task-card');
    expect(partnerControlsSource).not.toContain('className="ops-task-card"');
    expect(partnerControlsSource).not.toContain('ops-task-card-action');
  });

  it('uses the shared Vuexy money atom for visible wallet amounts', () => {
    expect(partnerControlsSource).toContain('MoneyText');
    expect(partnerControlsSource).not.toContain('helper={`Wallet ${formatMoney(item.walletBalance)}');
    expect(partnerControlsSource).not.toContain('<strong>{formatMoney(item.walletBalance)}</strong>');
    expect(partnerControlsSource).not.toContain("metric(\n          'Debt',\n          formatMoney");
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
    const page = await PartnerControlsPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('admin-form-control-labeled admin-form-control-fluid');
    expect(markup).toContain('admin-grid-span-2');
    expect(markup).not.toContain('partner-control-form-field');
    expect(markup).not.toContain('calendar-field');
    expect(partnerControlsSource).not.toContain('partner-control-form-field');
    expect(partnerControlsSource).not.toContain('<div className="calendar-field');
  });

  it('uses the shared table pagination footer for reports and account controls', () => {
    expect(partnerControlsSource).toContain('AdminTablePaginationFooter');
    expect(partnerControlsSource).toContain('className="vuexy-partner-table-footer"');
    expect(partnerControlsSource).not.toContain('<AdminTableFooter');
    expect(partnerControlsSource).not.toContain('partnerControlPagedListFooterLabel(');
  });
});
