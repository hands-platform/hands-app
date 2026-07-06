import type { ReactNode } from 'react';

import { Grid2x2, MessageSquareText, ScrollText, UserRound, Wallet } from 'lucide-react';

import { AdminRowLink, AdminSection } from '../../../components/admin-surface';
import { StatusBadge } from '../../../components/status-badge';

export type CustomerDetailShortcut = {
  readonly detail: string;
  readonly href: string;
  readonly label: string;
  readonly value: string;
};

type CustomerDetailShortcutStripProps = {
  readonly items: readonly CustomerDetailShortcut[];
};

type CustomerDetailSectionBandProps = {
  readonly children: ReactNode;
  readonly description: ReactNode;
  readonly eyebrow: string;
  readonly id?: string;
  readonly status?: ReactNode;
  readonly title: string;
};

export function CustomerDetailShortcutStrip({ items }: CustomerDetailShortcutStripProps) {
  return (
    <AdminSection
      bodyClassName="customer-detail-shortcut-grid admin-mt-14"
      className="customer-detail-shortcut-strip admin-mb-16"
      description="Jump between the same factual areas without scrolling through the full record from the top each time."
      status={<StatusBadge tone="info">{items.length} lanes</StatusBadge>}
      title="Customer workspace"
    >
      {items.map((item) => (
        <AdminRowLink className="customer-detail-shortcut-link" href={item.href} key={item.label}>
          <span className="customer-detail-shortcut-icon" aria-hidden="true">
            {shortcutIcon(item.label)}
          </span>
          <div>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </div>
          <em>{item.value}</em>
        </AdminRowLink>
      ))}
    </AdminSection>
  );
}

export function CustomerDetailSectionBand({
  children,
  description,
  eyebrow,
  id,
  status,
  title,
}: CustomerDetailSectionBandProps) {
  return (
    <AdminSection
      actions={status}
      bodyClassName="customer-detail-section-band-body"
      className="customer-detail-section-band admin-mb-16"
      description={description}
      eyebrow={eyebrow}
      headerClassName="customer-detail-section-band-header"
      id={id}
      title={title}
    >
      {children}
    </AdminSection>
  );
}

function shortcutIcon(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes('account') || normalized.includes('customer')) {
    return <UserRound size={16} />;
  }
  if (normalized.includes('payment') || normalized.includes('wallet')) {
    return <Wallet size={16} />;
  }
  if (normalized.includes('chat')) {
    return <MessageSquareText size={16} />;
  }
  if (normalized.includes('activity') || normalized.includes('timeline')) {
    return <ScrollText size={16} />;
  }

  return <Grid2x2 size={16} />;
}
