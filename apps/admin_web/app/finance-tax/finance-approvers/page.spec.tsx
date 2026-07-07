import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import FinanceApproversPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('FinanceApproversPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockResolvedValue([
      {
        id: 'finance-admin-1',
        roles: ['ADMIN', 'FINANCE_APPROVER'],
        fullName: 'Finance Admin',
        phone: '+84900000001',
        appSessions: [],
        pushDevices: [],
      },
      {
        id: 'support-admin-1',
        roles: ['ADMIN'],
        fullName: 'Support Admin',
        phone: '+84900000002',
        appSessions: [],
        pushDevices: [],
      },
      {
        id: 'customer-user-1',
        roles: ['CUSTOMER'],
        fullName: 'Customer User',
        phone: '+84900000003',
        appSessions: [],
        pushDevices: [],
      },
    ]);
  });

  it('keeps the approver role form on shared AdminForm atoms and only lists admin users', async () => {
    const page = await FinanceApproversPage({ searchParams: Promise.resolve({ roleNotice: 'updated' }) });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/users?take=100', []);
    expect(markup).toContain('Finance approver role was updated');
    expect(markup).toContain('Approver command board');
    expect(markup).toContain('Approver coverage');
    expect(markup).toContain('Dual-control guard');
    expect(markup).toContain('Finance approver operating rule');
    expect(markup).toContain('Finance approver directory');
    expect(markup).toContain('Finance Admin');
    expect(markup).toContain('Support Admin');
    expect(markup).not.toContain('Customer User');
    expect(markup).toContain('card admin-filter-panel');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
    expect(markup).toContain('admin-form-input admin-form-control-labeled');
    expect(markup).toContain('admin-form-label');
    expect(markup).toContain('admin-form-control-button');
    expect(markup).toContain('admin-form-control-button button button-outline');
    expect(markup).toContain('admin-form-control-button button button-primary');
    expect(markup).not.toContain('card admin-card-scroll');
    expect(markup).not.toContain('class="form-input"');
  });

  it('keeps the approver directory compact by avoiding duplicated page-template metrics', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/finance-approvers/page.tsx'), 'utf8');

    expect(source).toContain('<FinanceListCommandBoard ariaLabel="Approver command board">');
    expect(source).not.toContain('metrics={[');
  });

  it('uses the shared status badge for role chips', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/finance-approvers/page.tsx'), 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('AdminFilterChipGroup');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="participant-list">');
    expect(source).not.toContain(
      "<span className={`pill ${role === FINANCE_APPROVER_ROLE ? 'pill-success' : 'pill-neutral'}`} key={role}>",
    );
  });

  it('uses the shared DateTimeText atom for latest session timestamps', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/finance-approvers/page.tsx'), 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('return latest?.lastSeenAt ? formatDateTime(latest.lastSeenAt) :');
  });

  it('uses shared inline fallback atoms for missing approver session fields', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/finance-approvers/page.tsx'), 'utf8');

    expect(source).toContain('AdminInlineFallback');
    expect(source).not.toContain("'No recent session'");
    expect(source).not.toContain("<div className=\"muted\">{user.appSessions?.[0]?.platform ?? 'No platform'}</div>");
  });

  it('uses Vuexy button tone classes without legacy btn aliases', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/finance-approvers/page.tsx'), 'utf8');

    expect(source).toContain("className={enabled ? 'button-outline' : 'button-primary'}");
    expect(source).not.toContain('className={`btn ${enabled ?');
    expect(source).not.toContain('btn-outline');
    expect(source).not.toContain('btn-primary');
  });
});
