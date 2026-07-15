import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet, type AdminOperationalPolicySetting } from '../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import OperationsPolicyPage from './page';

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
const mockedGetAccess = vi.mocked(getCurrentAdminOperatorAccess);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const globalCss = readFileSync('app/globals.css', 'utf8');

describe('OperationsPolicyPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
    mockedGetAccess.mockReset();
    mockedGetAccess.mockResolvedValue(null);
  });

  it('renders default policy page sections on shared Vuexy section surfaces', async () => {
    const page = await OperationsPolicyPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('admin-page-header admin-page-header-toolbar');
    expect(markup).toContain('Live matching policy');
    expect(markup).not.toContain('Diagnostics loaded on demand');
    expect(markup).toContain('Operator decisions');
    expect(markup).not.toContain(
      '<section class="card admin-mb-16"><div class="ops-section-header"><div><h2>Live matching policy',
    );
    expect(markup).not.toContain(
      '<section class="card admin-mb-16"><div class="ops-section-header"><div><h2>Diagnostics loaded on demand',
    );
    expect(markup).not.toContain(
      '<section class="card admin-mb-16"><div class="ops-section-header"><div><h2>Operator decisions',
    );
  });

  it('keeps decision policy editors out of the compact summary payload', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/operational-policy') {
        return [
          operationPolicySetting({
            category: 'Matching',
            key: 'matching.provider_response_window_minutes',
            label: 'First-pick Partner response window',
            value: 10,
          }),
          operationPolicySetting({
            category: 'Decision',
            key: 'matching.preferred_accept_mode',
            label: 'First-pick acceptance contract',
            options: [
              {
                label: 'Preferred first',
                tradeoff: 'Keep preferred partner priority before marketplace fallback.',
                value: 'preferred_first',
              },
            ],
            value: 'preferred_first',
          }),
        ] satisfies AdminOperationalPolicySetting[];
      }

      return fallback;
    });

    const page = await OperationsPolicyPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('First-pick Partner response window');
    expect(markup).not.toContain('First-pick acceptance contract');
    expect(markup).not.toContain('Load decision editor');
    expect(markup).not.toContain('/operations-policy?details=all');
    expect(markup).not.toContain('Related booking records');
    expect(markup).not.toContain('Before saving this policy');
    expect((markup.match(/<form/g) ?? []).length).toBe(1);
  });

  it('does not expose the Developer/System setup route to ordinary operators when policies are missing', async () => {
    const page = await OperationsPolicyPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('No matching policies loaded');
    expect(markup).not.toContain('/setup');
    expect(markup).not.toContain('Open setup checks');
    expect(markup).not.toContain('API setup');
  });

  it('keeps setup checks available to Master Admins when policies are missing', async () => {
    mockedGetAccess.mockResolvedValue({
      categories: [],
      email: 'master@example.com',
      fullName: 'Master Admin',
      id: 'master-1',
      phone: null,
      roles: ['ADMIN', 'MASTER_ADMIN'],
      updatedAt: null,
    });

    const page = await OperationsPolicyPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('/setup');
    expect(markup).toContain('Open setup checks');
  });

  it('renders decision policy editors only in the decision review workspace', async () => {
    mockedGetAccess.mockResolvedValue({
      categories: [],
      email: 'master@example.com',
      fullName: 'Master Admin',
      id: 'master-1',
      phone: null,
      roles: ['ADMIN', 'MASTER_ADMIN'],
      updatedAt: null,
    });
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/operational-policy') {
        return [
          operationPolicySetting({
            category: 'Matching',
            key: 'matching.provider_response_window_minutes',
            label: 'First-pick Partner response window',
            value: 10,
          }),
          operationPolicySetting({
            category: 'Decision',
            key: 'matching.preferred_accept_mode',
            label: 'First-pick acceptance contract',
            options: [
              {
                label: 'Preferred first',
                tradeoff: 'Keep preferred partner priority before marketplace fallback.',
                value: 'preferred_first',
              },
            ],
            value: 'preferred_first',
          }),
        ] satisfies AdminOperationalPolicySetting[];
      }

      return fallback;
    });

    const page = await OperationsPolicyPage({ searchParams: Promise.resolve({ details: 'decisions' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('First-pick Partner response window');
    expect(markup).toContain('First-pick acceptance contract');
    expect(markup).toContain('Decision editor');
    expect(markup).not.toContain('Owner decision backlog');
    expect(markup).not.toContain('Current decision pressure');
    expect(mockedAdminGet.mock.calls.map(([href]) => href)).not.toContain(
      '/admin/operations-policy/providers?take=20',
    );
    expect((markup.match(/<form/g) ?? []).length).toBe(2);
  });

  it('loads the bounded Partner sample only in the decision evidence workspace', async () => {
    mockedGetAccess.mockResolvedValue({
      categories: [],
      email: 'master@example.com',
      fullName: 'Master Admin',
      id: 'master-1',
      phone: null,
      roles: ['ADMIN', 'MASTER_ADMIN'],
      updatedAt: null,
    });

    const page = await OperationsPolicyPage({
      searchParams: Promise.resolve({ details: 'decisions', decision: 'evidence' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Live evidence');
    expect(markup).toContain('Owner decision backlog');
    expect(markup).toContain('Current decision pressure');
    expect(markup).toContain('Open decision editor');
    expect(mockedAdminGet.mock.calls.map(([href]) => href)).toContain(
      '/admin/operations-policy/providers?take=20',
    );
  });

  it('loads matching Partner samples only in supply and simulation workspaces', async () => {
    mockedGetAccess.mockResolvedValue({
      categories: [],
      email: 'master@example.com',
      fullName: 'Master Admin',
      id: 'master-1',
      phone: null,
      roles: ['ADMIN', 'MASTER_ADMIN'],
      updatedAt: null,
    });

    const policyPage = await OperationsPolicyPage({
      searchParams: Promise.resolve({ details: 'matching' }),
    });
    const policyMarkup = renderToStaticMarkup(policyPage);

    expect(policyMarkup).toContain('Matching workspace');
    expect(policyMarkup).toContain('Policy editor');
    expect(policyMarkup).toContain('Booking matching playbook');
    expect(policyMarkup).not.toContain('Policy sensitivity preview');
    expect(mockedAdminGet.mock.calls.map(([href]) => href)).not.toContain(
      '/admin/operations-policy/providers?take=30',
    );

    mockedAdminGet.mockClear();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const supplyPage = await OperationsPolicyPage({
      searchParams: Promise.resolve({ details: 'matching', matching: 'supply' }),
    });
    const supplyMarkup = renderToStaticMarkup(supplyPage);

    expect(supplyMarkup).toContain('Supply evidence');
    expect(supplyMarkup).toContain('Policy sensitivity preview');
    expect(supplyMarkup).toContain('Read-only evidence');
    expect(supplyMarkup).not.toContain('Live policy simulator');
    expect(mockedAdminGet.mock.calls.map(([href]) => href)).toContain(
      '/admin/operations-policy/providers?take=30',
    );

    mockedAdminGet.mockClear();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    const simulationPage = await OperationsPolicyPage({
      searchParams: Promise.resolve({ details: 'matching', matching: 'simulation' }),
    });
    const simulationMarkup = renderToStaticMarkup(simulationPage);

    expect(simulationMarkup).toContain('Simulation');
    expect(simulationMarkup).toContain('Live policy simulator');
    expect(simulationMarkup).toContain('Policy change impact');
    expect(simulationMarkup).not.toContain('Policy sensitivity preview');
    expect(mockedAdminGet.mock.calls.map(([href]) => href)).toContain(
      '/admin/operations-policy/providers?take=30',
    );
  });

  it('keeps details=all as a bounded workspace index for Master Admins', async () => {
    mockedGetAccess.mockResolvedValue({
      categories: [],
      email: 'master@example.com',
      fullName: 'Master Admin',
      id: 'master-1',
      phone: null,
      roles: ['ADMIN', 'MASTER_ADMIN'],
      updatedAt: null,
    });

    const page = await OperationsPolicyPage({ searchParams: Promise.resolve({ details: 'all' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Choose workspace');
    expect(markup).toContain('/operations-policy?details=matching');
    expect(markup).toContain('/operations-policy?details=decisions');
    expect(markup).toContain('/operations-policy?details=audit');
    expect(markup).not.toContain('Policy sensitivity preview');
    expect(markup).not.toContain('Policy audit trail');
  });

  it('uses shared Vuexy badge atoms for page header counters', () => {
    expect(pageSource).toContain('AdminNoticeCard');
    expect(pageSource).toContain('StatusBadge');
    expect(pageSource).toContain('tone={notice.tone === \'success\' ? \'success\' : \'danger\'}');
    expect(pageSource).not.toContain('<span className="pill pill-success">{matchingSettings.length} enforced policy</span>');
    expect(pageSource).not.toContain('<span className="pill pill-info">{decisionSettings.length} decision item(s)</span>');
    expect(pageSource).not.toContain('<span className="pill pill-info">{savedCount} saved override(s)</span>');
    expect(pageSource).not.toContain("notice.tone === 'success' ? 'admin-notice-success' : 'admin-notice-danger'");
  });

  it('uses the shared AdminFormControlLink atom for page-level actions', () => {
    expect(pageSource).toContain('AdminFormControlLink');
    expect(pageSource).not.toContain('<Link className="button button-secondary"');
  });

  it('routes full diagnostics loading through Developer/System access', () => {
    expect(pageSource).toContain('getCurrentAdminOperatorAccess');
    expect(pageSource).toContain('canViewAdminDeveloperSystem');
    expect(pageSource).toContain('allowFullDiagnostics: canLoadFullDiagnostics');
  });

  it('keeps compact policy page copy free of developer verification wording', () => {
    expect(pageSource).not.toContain('loaded on demand');
    expect(pageSource).not.toContain('Load full diagnostics');
    expect(pageSource).not.toContain('full diagnostics view');
  });

  it('uses the shared Vuexy detail grid for policy form groups', () => {
    expect(pageSource).toContain('AdminDetailGrid');
    expect(pageSource).not.toContain('<div className="grid">');
  });

  it('uses the shared empty-state atom for missing policy setup copy', () => {
    expect(pageSource).toContain('AdminNotePanel');
    expect(pageSource).toContain('AdminEmptyState');
    expect(pageSource).not.toContain('<div className="ops-task-note admin-m-0">');
    expect(pageSource).not.toContain('<h3>No matching policies loaded</h3>');
    expect(pageSource).not.toContain('<p className="muted">\n                Seed operational policies');
  });

  it('scopes operations policy header overflow rules to direct page cards', () => {
    expect(globalCss).toContain('.operations-policy-page > .card > .ops-section-header > div,');
    expect(globalCss).toContain('.operations-policy-page > .card > .ops-section-header > .pill,');
    expect(globalCss).toContain('.operations-policy-page > .card > .ops-section-header > .signal,');
    expect(globalCss).not.toContain('.operations-policy-page .ops-section-header > div,');
    expect(globalCss).not.toContain('.operations-policy-page .ops-section-header > .pill,');
    expect(globalCss).not.toContain('.operations-policy-page .ops-section-header > .signal,');
  });
});

function operationPolicySetting(
  overrides: Partial<AdminOperationalPolicySetting> & Pick<AdminOperationalPolicySetting, 'category' | 'key' | 'label'>,
): AdminOperationalPolicySetting {
  return {
    category: overrides.category,
    description: `${overrides.label} description`,
    enforced: true,
    key: overrides.key,
    label: overrides.label,
    max: null,
    min: null,
    options: overrides.options ?? null,
    recommendedValue: overrides.recommendedValue ?? overrides.value ?? 10,
    unit: null,
    updatedAt: null,
    updatedBy: null,
    value: overrides.value ?? 10,
  };
}
