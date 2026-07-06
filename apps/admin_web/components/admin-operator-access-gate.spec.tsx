import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { headers } from 'next/headers';

import { getAdminOperatorPageAccess } from '../lib/admin-operator-access';
import { AdminOperatorAccessGate } from './admin-operator-access-gate';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('../lib/admin-operator-access', () => ({
  getAdminOperatorPageAccess: vi.fn(),
}));

const mockedHeaders = vi.mocked(headers);
const mockedGetAccess = vi.mocked(getAdminOperatorPageAccess);
const gateSource = readFileSync('components/admin-operator-access-gate.tsx', 'utf8');

describe('AdminOperatorAccessGate', () => {
  beforeEach(() => {
    mockedHeaders.mockReset();
    mockedGetAccess.mockReset();
  });

  it('renders denied access on a shared Vuexy error state surface', async () => {
    mockedHeaders.mockResolvedValue(new Headers({ 'x-admin-pathname': '/finance-tax' }));
    mockedGetAccess.mockResolvedValue({
      allowed: false,
      access: null,
      category: 'FINANCE',
    });

    const gate = await AdminOperatorAccessGate({ children: <div>Hidden finance page</div> });
    const markup = renderToStaticMarkup(gate);

    expect(markup).toContain('admin-state admin-error-state admin-state-danger admin-operator-access-denied-card');
    expect(markup).not.toContain('card admin-section admin-operator-access-denied-card');
    expect(markup).not.toContain('card admin-filter-panel admin-operator-access-denied-card');
    expect(markup).toContain('Access restricted');
    expect(markup).toContain('Page content is hidden.');
    expect(markup).toContain('FINANCE');
    expect(markup).not.toContain('Hidden finance page');
  });

  it('passes through public pages without an access lookup', async () => {
    mockedHeaders.mockResolvedValue(new Headers({ 'x-admin-pathname': '/login' }));

    const gate = await AdminOperatorAccessGate({ children: <div>Login page</div> });
    const markup = renderToStaticMarkup(gate);

    expect(markup).toContain('Login page');
    expect(mockedGetAccess).not.toHaveBeenCalled();
  });

  it('uses the shared Vuexy form control link for denied-page actions', () => {
    expect(gateSource).toContain('AdminFormControlLink');
    expect(gateSource).toContain('AdminErrorState');
    expect(gateSource).not.toContain('<Link className="button button-secondary"');
  });
});
