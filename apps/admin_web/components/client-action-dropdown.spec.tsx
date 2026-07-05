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
