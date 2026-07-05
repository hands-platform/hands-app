import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { Eye } from 'lucide-react';

import { ClientActionDropdown } from './client-action-dropdown';

const source = readFileSync('components/client-action-dropdown.tsx', 'utf8');

describe('ClientActionDropdown', () => {
  it('uses the shared Vuexy button atom for client dropdown item actions', () => {
    expect(source).toContain('AdminFormControlButton');
    expect(source).not.toContain('<button\n      className={className}');
  });

  it('keeps duplicate client dropdown labels on unique React keys', () => {
    expect(source).toContain('actions.map((item, itemIndex) => (');
    expect(source).toContain('key={`${item.label}:${itemIndex}`}');
    expect(source).not.toContain('actions.map((item) => (');
    expect(source).not.toContain('key={item.label}');
  });

  it('dedupes repeated Vuexy dropdown class tokens from page hooks', () => {
    const html = renderToStaticMarkup(
      <ClientActionDropdown
        actions={[]}
        className="admin-action-dropdown customer-client-actions"
        label="Customer actions"
        menuClassName="admin-action-menu customer-client-menu"
        triggerClassName="admin-action-trigger customer-client-trigger"
      />,
    );

    expect(html).toContain('class="admin-action-dropdown customer-client-actions"');
    expect(html).toContain('class="admin-action-trigger customer-client-trigger"');
    expect(html).not.toContain('admin-action-dropdown admin-action-dropdown');
    expect(html).not.toContain('admin-action-trigger admin-action-trigger');
  });

  it('renders a closed Vuexy-style client action trigger by default', () => {
    const html = renderToStaticMarkup(
      <ClientActionDropdown
        actions={[
          {
            description: 'Open the customer profile.',
            href: '/customers/customer-1',
            icon: Eye,
            label: 'View profile',
            tone: 'info',
          },
        ]}
        className="customer-client-actions"
        itemClassName={(item) => `customer-client-action is-${item.tone}`}
        label="Customer actions"
        menuClassName="customer-client-menu"
        triggerClassName="customer-client-trigger"
      />,
    );

    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Customer actions');
    expect(html).toContain('admin-action-dropdown customer-client-actions');
    expect(html).toContain('admin-action-trigger customer-client-trigger');
    expect(html).not.toContain('role="menu"');
  });
});
