import { RoleBadge, displayRoleLabel, roleBadgeClassName } from './role-badge';

describe('RoleBadge', () => {
  it('maps provider-compatible roles to visible Partner copy', () => {
    expect(displayRoleLabel('PROVIDER')).toBe('Partner');
    expect(displayRoleLabel('PARTNER')).toBe('Partner');
    expect(roleBadgeClassName('PROVIDER')).toBe('role-badge role-partner');
  });

  it('maps customer, admin, system, and unknown roles to stable badge classes', () => {
    expect(roleBadgeClassName('CUSTOMER')).toBe('role-badge role-customer');
    expect(roleBadgeClassName('ADMIN')).toBe('role-badge role-admin');
    expect(roleBadgeClassName('SYSTEM')).toBe('role-badge role-system');
    expect(roleBadgeClassName(null)).toBe('role-badge');
  });

  it('renders an icon badge with display text', () => {
    const badge = RoleBadge({ role: 'CUSTOMER' });

    expect(badge.type).toBe('span');
    expect(badge.props.className).toBe('role-badge role-customer');
    expect(badge.props.children[1]).toBe('Customer');
  });
});
