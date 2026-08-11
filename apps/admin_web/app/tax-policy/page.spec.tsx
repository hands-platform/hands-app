import { readFileSync } from 'node:fs';
import { vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { adminGet, type AdminTaxPolicyVersion } from '../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import TaxPolicyPage from './page';

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
const pageSource = readFileSync('app/tax-policy/page.tsx', 'utf8');
const globalCss = readFileSync('app/globals.css', 'utf8');

describe('TaxPolicyPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      id: 'admin-current',
      roles: ['ADMIN'],
    } as never);
  });

  it('loads the unified tax policy page from bounded data sources', async () => {
    await TaxPolicyPage({
      searchParams: Promise.resolve({}),
    });

    const hrefs = mockedAdminGet.mock.calls.map(([href]) => href);

    expect(hrefs).toEqual([
      '/admin/tax-policy-versions?take=20',
      '/admin/audit-logs?q=tax_&take=8',
      '/admin/earnings?range=30d&take=8',
      '/admin/users?take=50&role=ADMIN&view=finance-approver-directory',
    ]);
  });

  it('keeps legacy workspace URLs compatible with the unified data plan', async () => {
    await TaxPolicyPage({ searchParams: Promise.resolve({ details: 'audit' }) });
    expect(mockedAdminGet.mock.calls.map(([href]) => href)).toEqual([
      '/admin/tax-policy-versions?take=20',
      '/admin/audit-logs?q=tax_&take=8',
      '/admin/earnings?range=30d&take=8',
      '/admin/users?take=50&role=ADMIN&view=finance-approver-directory',
    ]);
  });

  it('uses shared admin form atoms for policy creation', async () => {
    const page = await TaxPolicyPage({
      searchParams: Promise.resolve({ details: 'editor' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('admin-form-select');
    expect(markup).toContain('admin-form-control-button');
    expect(markup).toContain('Separate Finance approver');
    expect(markup).toContain('Approval evidence');
    expect(markup).toContain('admin-form-input admin-form-control-labeled admin-form-control-fluid');
    expect(markup).toContain('admin-form-select admin-form-control-labeled admin-form-control-fluid');
    expect(markup).toContain('admin-form-input admin-form-control-labeled admin-form-control-fluid admin-grid-span-2');
    expect(markup).not.toContain('tax-policy-form-field');
    expect(markup).not.toContain('calendar-field');
    expect(markup).not.toContain('class="form-grid"><label>');
    expect(markup).not.toContain('<div class="calendar-field"><span>');
    expect(markup).not.toContain('<div class="calendar-field full-span"><span>');
    expect(pageSource).not.toContain('className="calendar-field');
    expect(pageSource).not.toContain('tax-policy-form-field');
  });

  it('uses shared admin form atoms for policy and rule edit forms', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/tax-policy-versions')) {
        return [taxPolicyFixture()];
      }
      return fallback;
    });

    const page = await TaxPolicyPage({
      searchParams: Promise.resolve({ details: 'editor' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Update policy');
    expect(markup).toContain('Update rule');
    expect(markup).toContain('Add rule');
    expect(markup).toContain('admin-form-checkbox');
    expect(markup).not.toContain('<label>Status<select');
    expect(markup).not.toContain('<label>Scope<select');
    expect(markup).not.toContain('<label>Service type<input');
    expect(markup).not.toContain('<label>Rate bps<input');
    expect(markup).not.toContain('<input name="active" type="checkbox"');
    expect(markup).not.toContain('<div class="calendar-field"><span>');
    expect(markup).not.toContain('<div class="calendar-field full-span"><span>');
  });

  it('renders one selected policy editor while keeping every loaded version in the index', async () => {
    const activePolicy = taxPolicyFixture();
    const inactivePolicy = {
      ...taxPolicyFixture(),
      id: 'tax-policy-2',
      name: 'Previous withholding policy',
      status: 'INACTIVE',
    } satisfies AdminTaxPolicyVersion;
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/tax-policy-versions')) {
        return [activePolicy, inactivePolicy];
      }
      return fallback;
    });

    const defaultMarkup = renderToStaticMarkup(
      await TaxPolicyPage({ searchParams: Promise.resolve({ details: 'editor' }) }),
    );
    const inactiveMarkup = renderToStaticMarkup(
      await TaxPolicyPage({
        searchParams: Promise.resolve({ details: 'editor', policyId: inactivePolicy.id }),
      }),
    );

    expect(defaultMarkup).toContain('Previous withholding policy');
    expect(defaultMarkup.match(/Update policy/g)).toHaveLength(1);
    expect(defaultMarkup).toContain('/tax-policy?policyId=tax-policy-2#tax-policy-editor');
    expect(inactiveMarkup.match(/Update policy/g)).toHaveLength(1);
    expect(inactiveMarkup).toContain('Editing');
  });

  it('renders the complete tax policy operation surface on the default route', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/tax-policy-versions')) {
        return [taxPolicyFixture()];
      }
      return fallback;
    });

    const summaryMarkup = renderToStaticMarkup(
      await TaxPolicyPage({ searchParams: Promise.resolve({}) }),
    );
    expect(summaryMarkup).toContain('admin-page-header admin-page-header-toolbar');
    expect(summaryMarkup).toContain('card admin-section admin-mb-16 tax-policy-checklist-card');
    expect(summaryMarkup).toContain('card admin-section admin-mb-16 tax-policy-withholding-preview-card');
    expect(summaryMarkup).not.toContain('tax-policy-workspace-index-card');
    expect(summaryMarkup).toContain('card admin-section admin-mb-16 tax-policy-create-policy-card');
    expect(summaryMarkup).toContain('card admin-card tax-policy-version-card');
    expect(summaryMarkup).toContain('card admin-section admin-mt-16 tax-policy-audit-summary-card');
    expect(summaryMarkup).toContain('card admin-section admin-mt-16 tax-policy-snapshot-consistency-card');
    expect(summaryMarkup).toContain('Open monthly close');
    expect(summaryMarkup).toContain('Open withholding');
    expect(summaryMarkup).toContain('ops-section-header');
    expect(summaryMarkup).not.toContain('toolbar admin-mb-12');
  });

  it('uses the shared detail grid surface for policy version cards', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/tax-policy-versions')) {
        return [taxPolicyFixture()];
      }
      return fallback;
    });

    const page = await TaxPolicyPage({
      searchParams: Promise.resolve({ details: 'editor' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('detail-grid tax-policy-version-grid');
    expect(pageSource).toContain('AdminDetailGrid');
    expect(pageSource).not.toContain('<section className="grid tax-policy-version-grid">');
  });

  it('uses shared Vuexy empty-state atoms for tax evidence fallbacks', () => {
    expect(pageSource).toContain('AdminEmptyState');
    expect(pageSource).toContain('AdminInlineFallback');
    expect(pageSource).not.toContain('<strong>No recent tax policy audit entries</strong>');
    expect(pageSource).not.toContain('<strong>No recent earning tax snapshots</strong>');
    expect(pageSource).not.toContain('<span className="muted">No rules yet.</span>');
  });

  it('uses the shared Vuexy stage item atom for tax policy row surfaces', () => {
    expect(pageSource).toContain('AdminStageItem');
    expect(pageSource).toContain('AdminStageList');
    expect(pageSource).not.toContain('<div className="setup-stage-list');
    expect(pageSource).not.toContain('bodyClassName="setup-stage-list');
    expect(pageSource).not.toContain('className="setup-stage-item"');
  });

  it('scopes tax policy header overflow rules to concrete page surfaces', () => {
    expect(globalCss).toContain('.tax-policy-page > .card > .ops-section-header > div,');
    expect(globalCss).toContain('.tax-policy-page .tax-policy-version-card > .ops-section-header > div {');
    expect(globalCss).not.toContain('.tax-policy-page .ops-section-header > div,');
    expect(globalCss).not.toContain('.tax-policy-page .toolbar > div');
  });

  it('uses the shared DateTimeText atom for visible tax policy timestamps', () => {
    expect(pageSource).toContain('DateTimeText');
    expect(pageSource).not.toContain("`Effective from ${formatDateTime(preview.policy.effectiveFrom, 'No date')}`");
    expect(pageSource).not.toContain("{formatDateTime(policy.effectiveFrom, 'No date')}");
    expect(pageSource).not.toContain("` - ${formatDateTime(policy.effectiveTo, 'No date')}`");
    expect(pageSource).not.toContain("formatDateTime(row.createdAt, 'Unknown time')");
  });

  it('uses shared Vuexy badge atoms instead of raw tax policy pill spans', () => {
    expect(pageSource).toContain('AdminNoticeCard');
    expect(pageSource).toContain('AdminSignal');
    expect(pageSource).toContain('StatusBadgeFromPillClass');
    expect(pageSource).not.toContain('statusBadgeToneFromPillClass');
    expect(pageSource).not.toContain('PillClassBadge');
    expect(pageSource).toContain('StatusBadge');
    expect(pageSource).not.toContain('<span className={`signal ${activePolicies.length === 1 ? \'signal-ok\' : \'signal-warn\'}`}>');
    expect(pageSource).not.toContain('<span className="pill pill-info">{ruleCount} rule(s)</span>');
    expect(pageSource).not.toContain('<span className={`pill ${notice.tone === \'success\' ? \'pill-success\' : \'pill-danger\'}`}>');
    expect(pageSource).not.toContain("notice.tone === 'success' ? 'admin-notice-success' : 'admin-notice-danger'");
    expect(pageSource).not.toContain('<span className={`pill ${healthItems.every((item) => item.ok) ? \'pill-success\' : \'pill-warn\'}`}>');
    expect(pageSource).not.toContain('<span className={`pill ${preview.policy ? \'pill-success\' : \'pill-warn\'}`}>');
    expect(pageSource).not.toContain('<span className={`pill ${policy.status === \'ACTIVE\' ? \'pill-success\' : \'pill-neutral\'}`}>');
    expect(pageSource).not.toContain('<span className="pill pill-info">{auditSummary.totalChangeCount} recent</span>');
    expect(pageSource).not.toContain('<span className={`pill ${row.toneClassName}`}>{row.actionLabel.split(\' \')[0].toUpperCase()}</span>');
    expect(pageSource).not.toContain('<span className={snapshotConsistency.warningCount ? \'pill pill-warn\' : \'pill pill-neutral\'}>');
    expect(pageSource).not.toContain('<span className={`pill ${row.toneClassName}`}>{row.statusLabel}</span>');
  });

  it('uses the shared Vuexy text link atom for tax policy drill-down links', () => {
    expect(pageSource).toContain('AdminTextLink');
    expect(pageSource).not.toContain('className="text-link"');
  });

  it('uses the shared money atom for visible tax policy amounts', () => {
    expect(pageSource).toContain('MoneyText');
    expect(pageSource).toContain('function TaxPolicyAmountBandLabel');
    expect(pageSource).toContain('<TaxPolicyAmountBandLabel rule={rule} />');
    expect(pageSource).toContain('<TaxPolicyAmountBandLabel rule={overlap.left} />');
    expect(pageSource).toContain('<TaxPolicyAmountBandLabel rule={overlap.right} />');
    expect(pageSource).not.toContain('`${formatBps(preview.rule.rateBps)} plus ${formatMoney(');
    expect(pageSource).not.toContain('<strong>{formatMoney(preview.withholdingAmount)} withholding</strong>');
    expect(pageSource).not.toContain('Gross {formatMoney(preview.grossAmount)} / service type');
    expect(pageSource).not.toContain('{rule.fixedAmount ? ` + ${formatMoney(rule.fixedAmount)}` : \'\'}');
    expect(pageSource).not.toContain(
      '? ` / ${formatMoney(rule.minGrossAmount ?? 0)}-${rule.maxGrossAmount ? formatMoney(rule.maxGrossAmount) : \'no max\'}`',
    );
    expect(pageSource).not.toContain('formatMoney(rule.minGrossAmount ?? 0)');
  });
});

function taxPolicyFixture(): AdminTaxPolicyVersion {
  return {
    effectiveFrom: '2026-06-01T00:00:00.000Z',
    effectiveTo: null,
    id: 'tax-policy-1',
    name: 'Vietnam freelance withholding 2026',
    notes: 'Operator approved policy',
    rules: [
      {
        active: true,
        fixedAmount: 0,
        id: 'tax-rule-1',
        maxGrossAmount: null,
        minGrossAmount: null,
        policyVersionId: 'tax-policy-1',
        rateBps: 500,
        scope: 'DEFAULT',
        serviceType: null,
      },
    ],
    status: 'ACTIVE',
  };
}
