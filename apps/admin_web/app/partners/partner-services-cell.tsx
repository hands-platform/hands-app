import type { AdminProvider } from '../../lib/admin-api';

type PartnerServicesCellProps = {
  readonly provider: AdminProvider;
};

export function PartnerServicesCell({ provider }: PartnerServicesCellProps) {
  return <>{provider.services?.map((item) => item.service?.name).filter(Boolean).join(', ') || 'None'}</>;
}
