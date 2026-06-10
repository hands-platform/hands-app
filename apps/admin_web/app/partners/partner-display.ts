import type { AdminProvider } from '../../lib/admin-api';
import { marketplaceDisplayText } from '../../lib/admin-copy';

export function providerDisplayName(provider: AdminProvider) {
  return marketplaceDisplayText(
    provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id,
  );
}
