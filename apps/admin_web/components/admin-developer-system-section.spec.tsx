import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { getCurrentAdminOperatorAccess } from '../lib/admin-operator-access';
import { AdminDeveloperSystemSection } from './admin-developer-system-section';

vi.mock('../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn(),
}));

const mockedGetAccess = vi.mocked(getCurrentAdminOperatorAccess);

describe('AdminDeveloperSystemSection', () => {
  beforeEach(() => {
    mockedGetAccess.mockReset();
  });

  it('hides diagnostics from ordinary operators without Developer/System access', async () => {
    mockedGetAccess.mockResolvedValue({
      categories: ['BOOKINGS_DETAIL'],
      email: 'ops@example.com',
      fullName: 'Ops',
      id: 'ops-1',
      phone: null,
      roles: ['ADMIN'],
      updatedAt: null,
    });

    const section = await AdminDeveloperSystemSection({
      children: <div>Developer diagnostics</div>,
    });

    expect(renderToStaticMarkup(section)).not.toContain('Developer diagnostics');
  });

  it('shows diagnostics to Master Admin without explicit category setup', async () => {
    mockedGetAccess.mockResolvedValue({
      categories: [],
      email: 'master@example.com',
      fullName: 'Master Admin',
      id: 'master-1',
      phone: null,
      roles: ['ADMIN', 'MASTER_ADMIN'],
      updatedAt: null,
    });

    const section = await AdminDeveloperSystemSection({
      children: <div>Developer diagnostics</div>,
    });

    expect(renderToStaticMarkup(section)).toContain('Developer diagnostics');
  });

  it('shows diagnostics to operators with a Developer/System category', async () => {
    mockedGetAccess.mockResolvedValue({
      categories: ['DEVELOPER_HEALTH'],
      email: 'developer@example.com',
      fullName: 'Developer',
      id: 'developer-1',
      phone: null,
      roles: ['ADMIN'],
      updatedAt: null,
    });

    const section = await AdminDeveloperSystemSection({
      children: <div>Developer diagnostics</div>,
    });

    expect(renderToStaticMarkup(section)).toContain('Developer diagnostics');
  });
});
