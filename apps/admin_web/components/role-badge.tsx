import { Bot, HeartHandshake, ShieldCheck, UserRound } from 'lucide-react';

type RoleBadgeProps = {
  readonly role: string | null | undefined;
};

export function displayRoleLabel(role: string | null | undefined) {
  if (!role) return 'Unknown';
  const normalized = role.toUpperCase();

  if (normalized === 'PROVIDER' || normalized === 'PARTNER') return 'Partner';
  if (normalized === 'CUSTOMER') return 'Customer';
  if (normalized === 'ADMIN') return 'Admin';
  if (normalized === 'SYSTEM') return 'System';

  return role;
}

export function roleBadgeClassName(role: string | null | undefined) {
  const normalized = role?.toUpperCase();

  if (normalized === 'PROVIDER' || normalized === 'PARTNER') return 'role-badge role-partner';
  if (normalized === 'CUSTOMER') return 'role-badge role-customer';
  if (normalized === 'ADMIN') return 'role-badge role-admin';
  if (normalized === 'SYSTEM') return 'role-badge role-system';

  return 'role-badge';
}

function roleIcon(role: string | null | undefined) {
  const normalized = role?.toUpperCase();

  if (normalized === 'PROVIDER' || normalized === 'PARTNER') return HeartHandshake;
  if (normalized === 'CUSTOMER') return UserRound;
  if (normalized === 'ADMIN') return ShieldCheck;
  if (normalized === 'SYSTEM') return Bot;

  return UserRound;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const Icon = roleIcon(role);

  return (
    <span className={roleBadgeClassName(role)}>
      <Icon aria-hidden="true" size={14} strokeWidth={2.2} />
      {displayRoleLabel(role)}
    </span>
  );
}
