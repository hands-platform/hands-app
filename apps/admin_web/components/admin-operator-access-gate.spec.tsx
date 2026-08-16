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

    expect(markup).toContain(
      'admin-state admin-error-state admin-state-danger admin-operator-access-denied-card',
    );
    expect(markup).not.toContain('card admin-section admin-operator-access-denied-card');
    expect(markup).not.toContain('card admin-filter-panel admin-operator-access-denied-card');
    expect(markup).toContain('Access restricted');
    expect(markup).toContain('Page content is hidden.');
    expect(markup).not.toContain('FINANCE');
    expect(markup).not.toContain('Hidden finance page');
  });

  it('separates an unavailable access API from a permission denial', async () => {
    mockedHeaders.mockResolvedValue(new Headers({ 'x-admin-pathname': '/admin-operators' }));

    const markup = renderToStaticMarkup(
      await AdminOperatorAccessGate({
        children: <div>Hidden operator directory</div>,
        operatorAccess: null,
        operatorAccessAvailable: false,
      }),
    );

    expect(markup).toContain('Operator access unavailable');
    expect(markup).toContain('No access denial was inferred.');
    expect(markup).toContain('Retry');
    expect(markup).not.toContain('Access restricted');
    expect(markup).not.toContain('Hidden operator directory');
    expect(mockedGetAccess).not.toHaveBeenCalled();
  });

  it('uses the registry label and a safe customer return path for denied customer detail', async () => {
    mockedHeaders.mockResolvedValue(
      new Headers({
        'x-admin-pathname': '/customers/customer-1?returnTo=%2Fcustomers%3Fview%3Dall%26sort%3Dname',
      }),
    );
    mockedGetAccess.mockResolvedValue({
      allowed: false,
      access: null,
      category: 'CUSTOMERS_DETAIL',
    });

    const markup = renderToStaticMarkup(
      await AdminOperatorAccessGate({ children: <div>Hidden customer profile</div> }),
    );

    expect(markup).toContain('Customer detail access required');
    expect(markup).toContain('Back to customers');
    expect(markup).toContain('/customers?view=all&amp;sort=name');
    expect(markup).toContain('<title>Access restricted | HANDS Admin</title>');
    expect(markup).not.toContain('CUSTOMERS_DETAIL');
  });

  it('rejects an external customer return path', async () => {
    mockedHeaders.mockResolvedValue(
      new Headers({ 'x-admin-pathname': '/customers/customer-1?returnTo=https%3A%2F%2Fevil.example' }),
    );
    mockedGetAccess.mockResolvedValue({ allowed: false, access: null, category: 'CUSTOMERS_DETAIL' });

    const markup = renderToStaticMarkup(
      await AdminOperatorAccessGate({ children: <div>Hidden customer profile</div> }),
    );

    expect(markup).toContain('href="/customers"');
    expect(markup).not.toContain('evil.example');
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
