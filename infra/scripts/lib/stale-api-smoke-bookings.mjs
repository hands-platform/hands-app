export const STALE_API_SMOKE_ADDRESS_SUFFIX = ' smoke flow';
export const STALE_REALTIME_SMOKE_ADDRESS_PREFIX = 'Realtime smoke ';

export function createApiSmokeBookingTracker() {
  const bookingIds = new Set();

  return {
    has(bookingId) {
      return bookingIds.has(bookingId);
    },
    record(path, response) {
      if (path !== '/customer/bookings') return false;
      const bookingId = response?.id;
      if (typeof bookingId !== 'string' || !bookingId.trim()) return false;
      bookingIds.add(bookingId);
      return true;
    },
    snapshot() {
      return [...bookingIds];
    },
  };
}

export function installApiSmokeProcessFailureHandlers({
  cleanup,
  exit,
  processTarget,
  report,
}) {
  let started = false;

  const handle = async (origin, error, exitCode) => {
    if (started) return;
    started = true;
    let cleanupResult;
    let cleanupError;
    try {
      cleanupResult = await cleanup(origin);
    } catch (caught) {
      cleanupError = caught instanceof Error ? caught.message : String(caught);
    }
    report({
      cleanup: cleanupResult,
      cleanupError,
      error: error instanceof Error ? error.message : String(error),
      ok: false,
      origin,
    });
    exit(exitCode);
  };

  processTarget.once('uncaughtException', (error) => {
    void handle('uncaughtException', error, 1);
  });
  processTarget.once('unhandledRejection', (error) => {
    void handle('unhandledRejection', error, 1);
  });
  processTarget.once('SIGINT', () => {
    void handle('SIGINT', new Error('API smoke interrupted'), 130);
  });
  processTarget.once('SIGTERM', () => {
    void handle('SIGTERM', new Error('API smoke terminated'), 143);
  });

  return handle;
}

export function isStaleApiSmokeAddress(value) {
  const address = value?.trim();
  if (!address) return false;
  const normalized = address.toLowerCase();
  return (
    normalized.endsWith(STALE_API_SMOKE_ADDRESS_SUFFIX) ||
    normalized.startsWith(STALE_REALTIME_SMOKE_ADDRESS_PREFIX.toLowerCase())
  );
}

export function isLegacyApiSmokeCustomer(user, expectedPhone) {
  return Boolean(
    expectedPhone &&
      user?.fullName?.trim() === 'Demo Customer' &&
      user?.phone?.trim() === expectedPhone.trim(),
  );
}

export function summarizeStaleApiSmokeBookings(rows) {
  const byAddress = new Map();
  const byStatus = new Map();
  const providerIds = new Set();
  const sources = new Map();

  for (const row of rows) {
    const address = row.addressSnapshot?.addressText?.trim() || 'Unknown smoke address';
    byAddress.set(address, (byAddress.get(address) ?? 0) + 1);
    byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
    if (row.selectedProviderId) providerIds.add(row.selectedProviderId);
    const source = row.cleanupSource ?? 'explicit_smoke_address';
    sources.set(source, (sources.get(source) ?? 0) + 1);
  }

  const orderedCounts = (source) =>
    [...source.entries()]
      .map(([label, count]) => ({ count, label }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

  return {
    addresses: orderedCounts(byAddress),
    affectedProviderCount: providerIds.size,
    sources: orderedCounts(sources),
    statuses: orderedCounts(byStatus),
    total: rows.length,
  };
}
