import { AdminProvider, adminGet } from '../../lib/admin-api';
import {
  approveProvider,
  approveProviderBankAccount,
  approveProviderKyc,
  approveProviderTaxProfile,
  enablePushDevice,
  rejectProvider,
  rejectProviderBankAccount,
  rejectProviderKyc,
  rejectProviderTaxProfile,
  syncSupabaseProviderRole,
} from './actions';

type AdminPushDevice = NonNullable<NonNullable<AdminProvider['user']>['pushDevices']>[number];
type ProviderLocationState = 'recent' | 'stale' | 'expired' | 'missing';

const STALE_LOCATION_MINUTES = 30;
const EXPIRED_LOCATION_HOURS = 24;

export default async function ProvidersPage() {
  const providers = sortProviders(await adminGet<AdminProvider[]>('/admin/providers', []));
  const fileReadUrls = new Map<string, string>();
  await Promise.all(
    providers.flatMap((provider) =>
      (provider.verification?.files ?? []).map(async (file) => {
        const result = await adminGet<{ read?: { url?: string } }>(`/files/${file.id}/read-url`, {});
        if (result.read?.url) {
          fileReadUrls.set(file.id, result.read.url);
        }
      }),
    ),
  );
  const summary = buildProviderSummary(providers);

  return (
    <>
      <h1>Provider Verification</h1>
      <div className="grid" style={{ marginBottom: 16 }}>
        {summary.map(([label, value]) => (
          <div className="card" key={label}>
            <p>{label}</p>
            <h2>{value}</h2>
          </div>
        ))}
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Status</th>
              <th>Onboarding</th>
              <th>Ops readiness</th>
              <th>Location</th>
              <th>Push Devices</th>
              <th>Files</th>
              <th>Services</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((provider) => (
              <tr key={provider.id}>
                <td>{provider.displayName || provider.user?.fullName || provider.user?.phone}</td>
                <td>
                  {provider.verification?.status ?? 'DRAFT'}
                  {provider.verification?.rejectionReason ? (
                    <p className="muted">{provider.verification.rejectionReason}</p>
                  ) : null}
                  <p className="muted" style={{ marginTop: 4 }}>
                    Queue status: {provider.status}
                  </p>
                </td>
                <td>
                  <ProviderOnboardingCell provider={provider} />
                </td>
                <td>
                  <div className="participant-list" style={{ marginBottom: 8 }}>
                    <span
                      className={`pill ${provider.verification?.status === 'APPROVED' ? 'pill-success' : 'pill-warn'}`}
                    >
                      {provider.verification?.status === 'APPROVED' ? 'Verified' : 'Needs review'}
                    </span>
                    <span
                      className={`pill ${provider.status === 'ONLINE_AVAILABLE' ? 'pill-success' : 'pill-neutral'}`}
                    >
                      {provider.status === 'ONLINE_AVAILABLE' ? 'Online now' : 'Not live'}
                    </span>
                    <span className={`pill ${hasHealthyPush(provider) ? 'pill-success' : 'pill-info'}`}>
                      {hasHealthyPush(provider) ? 'Push ready' : 'Push missing'}
                    </span>
                    <span
                      className={`pill ${provider.user?.supabaseUserId ? 'pill-success' : 'pill-neutral'}`}
                    >
                      {provider.user?.supabaseUserId ? 'Supabase linked' : 'Nest auth only'}
                    </span>
                  </div>
                  <p className="muted">{providerActionHint(provider)}</p>
                </td>
                <td>
                  <ProviderLocationCell provider={provider} />
                </td>
                <td>
                  {provider.user?.pushDevices?.length
                    ? provider.user.pushDevices.map((device) => (
                        <div key={device.id} style={{ marginBottom: 8 }}>
                          <p className="muted" style={{ marginBottom: 4 }}>
                            {device.platform} / {device.enabled ? 'enabled' : 'disabled'} /{' '}
                            {maskToken(device.token)}
                          </p>
                          {!device.enabled ? (
                            <p className="muted" style={{ marginBottom: 4 }}>
                              Last failure: {readFailureCode(device) ?? 'Unknown'} /{' '}
                              {readFailureStatus(device) ?? 'FAILED'}
                            </p>
                          ) : null}
                          {readLastAttempt(device) ? (
                            <p className="muted" style={{ marginBottom: 4 }}>
                              Last attempt: {new Date(readLastAttempt(device) as string).toLocaleString()}
                            </p>
                          ) : null}
                          {!device.enabled ? (
                            <form action={enablePushDevice}>
                              <input type="hidden" name="pushDeviceId" value={device.id} />
                              <button type="submit">Re-enable</button>
                            </form>
                          ) : null}
                        </div>
                      ))
                    : 'None'}
                </td>
                <td>
                  {provider.verification?.files?.length
                    ? provider.verification.files.map((file) => (
                        <div key={file.id} className="provider-file-row">
                          <div className="participant-list" style={{ marginBottom: 6 }}>
                            <span className="pill pill-info">{file.purpose ?? 'PROVIDER_VERIFICATION'}</span>
                            <span
                              className={`pill ${
                                file.uploadStatus === 'UPLOADED' ? 'pill-success' : 'pill-warn'
                              }`}
                            >
                              {file.uploadStatus ?? 'PENDING'}
                            </span>
                          </div>
                          <p className="muted">
                            {file.contentType}
                            {file.sizeBytes ? ` / ${formatBytes(file.sizeBytes)}` : ''}
                            {file.uploadedAt
                              ? ` / uploaded ${new Date(file.uploadedAt).toLocaleString()}`
                              : ''}
                          </p>
                          <p className="muted">
                            {fileReadUrls.get(file.id) ? (
                              <a href={fileReadUrls.get(file.id)} target="_blank" rel="noreferrer">
                                {file.key}
                              </a>
                            ) : (
                              file.key
                            )}
                          </p>
                        </div>
                      ))
                    : 'None'}
                </td>
                <td>
                  {provider.services
                    ?.map((item) => item.service?.name)
                    .filter(Boolean)
                    .join(', ') || 'None'}
                </td>
                <td>
                  <div className="actions">
                    <form action={approveProvider}>
                      <input type="hidden" name="providerId" value={provider.id} />
                      <button type="submit">Approve</button>
                    </form>
                    <form action={rejectProvider}>
                      <input type="hidden" name="providerId" value={provider.id} />
                      <input type="hidden" name="reason" value="Rejected from admin dashboard" />
                      <button type="submit">Reject</button>
                    </form>
                    <form action={syncSupabaseProviderRole}>
                      <input type="hidden" name="providerId" value={provider.id} />
                      <button type="submit" disabled={provider.verification?.status !== 'APPROVED'}>
                        Sync Supabase role
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {providers.length === 0 && (
              <tr>
                <td colSpan={9}>No providers loaded. Start the API and seed data to populate this table.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProviderOnboardingCell({ provider }: { provider: AdminProvider }) {
  const primaryBank = provider.bankAccounts?.[0];
  const missingAgreements = 5 - (provider.agreements?.length ?? 0);

  return (
    <div>
      <div className="participant-list" style={{ marginBottom: 8 }}>
        <span className="pill pill-info">{provider.level ?? 'LEVEL_1_SIGNUP'}</span>
        <span className={`pill ${provider.kyc?.status === 'APPROVED' ? 'pill-success' : 'pill-warn'}`}>
          KYC {provider.kyc?.status ?? 'DRAFT'}
        </span>
        <span className={`pill ${primaryBank?.status === 'APPROVED' ? 'pill-success' : 'pill-neutral'}`}>
          Bank {primaryBank?.status ?? 'MISSING'}
        </span>
        <span
          className={`pill ${provider.taxProfile?.status === 'APPROVED' ? 'pill-success' : 'pill-neutral'}`}
        >
          Tax {provider.taxProfile?.status ?? 'MISSING'}
        </span>
      </div>
      <p className="muted" style={{ marginBottom: 8 }}>
        {provider.legalName ? `Legal: ${provider.legalName}` : 'Legal name not saved'}
        {provider.kyc?.cccdNumberLast4 ? ` / CCCD ****${provider.kyc.cccdNumberLast4}` : ''}
      </p>
      <p className="muted" style={{ marginBottom: 8 }}>
        Agreements: {provider.agreements?.length ?? 0}/5
        {missingAgreements > 0 ? ` (${missingAgreements} missing)` : ''}
      </p>
      {primaryBank ? (
        <p className="muted" style={{ marginBottom: 8 }}>
          {primaryBank.bankName} / {primaryBank.accountNumberMasked ?? 'no account'} /{' '}
          {primaryBank.accountHolderName}
        </p>
      ) : null}
      {provider.taxProfile ? (
        <p className="muted" style={{ marginBottom: 8 }}>
          Tax code ****{provider.taxProfile.taxCodeLast4 ?? '----'} / {provider.taxProfile.registeredAddress}
        </p>
      ) : null}
      <div className="actions">
        <form action={approveProviderKyc}>
          <input type="hidden" name="providerId" value={provider.id} />
          <button type="submit" disabled={provider.kyc?.status === 'APPROVED'}>
            Approve KYC
          </button>
        </form>
        <form action={rejectProviderKyc}>
          <input type="hidden" name="providerId" value={provider.id} />
          <input type="hidden" name="reason" value="KYC rejected from admin dashboard" />
          <button type="submit" disabled={!provider.kyc || provider.kyc.status === 'REJECTED'}>
            Reject KYC
          </button>
        </form>
        {primaryBank ? (
          <>
            <form action={approveProviderBankAccount}>
              <input type="hidden" name="bankAccountId" value={primaryBank.id} />
              <button type="submit" disabled={primaryBank.status === 'APPROVED'}>
                Approve bank
              </button>
            </form>
            <form action={rejectProviderBankAccount}>
              <input type="hidden" name="bankAccountId" value={primaryBank.id} />
              <input type="hidden" name="reason" value="Bank account rejected from admin dashboard" />
              <button type="submit" disabled={primaryBank.status === 'REJECTED'}>
                Reject bank
              </button>
            </form>
          </>
        ) : null}
        {provider.taxProfile ? (
          <>
            <form action={approveProviderTaxProfile}>
              <input type="hidden" name="providerId" value={provider.id} />
              <button type="submit" disabled={provider.taxProfile.status === 'APPROVED'}>
                Approve tax
              </button>
            </form>
            <form action={rejectProviderTaxProfile}>
              <input type="hidden" name="providerId" value={provider.id} />
              <input type="hidden" name="reason" value="Tax profile rejected from admin dashboard" />
              <button type="submit" disabled={provider.taxProfile.status === 'REJECTED'}>
                Reject tax
              </button>
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
}

function maskToken(token: string) {
  if (token.length <= 10) {
    return token;
  }
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function readFailureCode(device: AdminPushDevice) {
  return device.deliveries?.[0]?.response?.body?.error?.details?.[0]?.errorCode;
}

function readFailureStatus(device: AdminPushDevice) {
  return device.deliveries?.[0]?.status;
}

function readLastAttempt(device: AdminPushDevice) {
  return device.deliveries?.[0]?.attemptedAt;
}

function hasHealthyPush(provider: AdminProvider) {
  return (provider.user?.pushDevices ?? []).some((device) => device.enabled);
}

function ProviderLocationCell({ provider }: { provider: AdminProvider }) {
  const status = providerLocationStatus(provider);
  const hasCoordinate = hasProviderCoordinate(provider);

  return (
    <div>
      <div className="participant-list" style={{ marginBottom: 8 }}>
        <span className={`pill ${providerLocationPillClass(status)}`}>{providerLocationLabel(status)}</span>
      </div>
      <p className="muted" style={{ marginBottom: 4 }}>
        {providerLocationAgeLabel(provider.currentLocationUpdatedAt)}
      </p>
      {hasCoordinate ? (
        <p className="muted">
          {Number(provider.currentLat).toFixed(4)}, {Number(provider.currentLng).toFixed(4)}
        </p>
      ) : (
        <p className="muted">No saved coordinates yet.</p>
      )}
    </div>
  );
}

function providerActionHint(provider: AdminProvider) {
  if (provider.verification?.status !== 'APPROVED') {
    return 'Review verification before this therapist can safely take customer requests.';
  }
  if (provider.status !== 'ONLINE_AVAILABLE') {
    return 'Therapist is approved but not currently online for direct or backup requests.';
  }
  const locationState = providerLocationStatus(provider);
  if (locationState === 'missing') {
    return 'Therapist is online, but no location has been saved yet. Ask them to reopen the Provider app.';
  }
  if (locationState === 'expired') {
    return 'Therapist has an old saved location. They should go online again before dispatch.';
  }
  if (locationState === 'stale') {
    return 'Therapist is live, but the last location is older than 30 minutes. Confirm before dispatch.';
  }
  if (!hasHealthyPush(provider)) {
    return 'Therapist is live, but push registration should be checked before relying on alerts.';
  }
  if (!provider.user?.supabaseUserId) {
    return 'Therapist is operational in Nest auth. Supabase role sync will become available after Supabase OTP login links this phone.';
  }
  return 'Therapist is ready for direct requests and fallback matching.';
}

function buildProviderSummary(providers: AdminProvider[]) {
  const approved = providers.filter((provider) => provider.verification?.status === 'APPROVED').length;
  const online = providers.filter((provider) => provider.status === 'ONLINE_AVAILABLE').length;
  const recentLocation = providers.filter((provider) => providerLocationStatus(provider) === 'recent').length;
  const staleLocation = providers.filter((provider) =>
    ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider)),
  ).length;
  const pushReady = providers.filter((provider) => hasHealthyPush(provider)).length;
  const pushDisabled = providers.filter((provider) =>
    (provider.user?.pushDevices ?? []).some((device) => !device.enabled),
  ).length;
  const readyNow = providers.filter(
    (provider) =>
      provider.verification?.status === 'APPROVED' &&
      provider.status === 'ONLINE_AVAILABLE' &&
      providerLocationStatus(provider) === 'recent' &&
      hasHealthyPush(provider),
  ).length;

  return [
    ['Total therapists', providers.length.toString()],
    ['Approved', approved.toString()],
    ['Online now', online.toString()],
    ['Recent location', recentLocation.toString()],
    ['Location needs review', staleLocation.toString()],
    ['Push ready', pushReady.toString()],
    ['Push needs review', pushDisabled.toString()],
    ['Ready for dispatch', readyNow.toString()],
  ] as const;
}

function sortProviders(providers: AdminProvider[]) {
  return [...providers].sort((left, right) => {
    const leftScore = providerPriority(left);
    const rightScore = providerPriority(right);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return (left.displayName || left.user?.fullName || left.user?.phone || '').localeCompare(
      right.displayName || right.user?.fullName || right.user?.phone || '',
    );
  });
}

function providerPriority(provider: AdminProvider) {
  if (
    provider.verification?.status === 'APPROVED' &&
    provider.status === 'ONLINE_AVAILABLE' &&
    providerLocationStatus(provider) === 'recent' &&
    hasHealthyPush(provider)
  ) {
    return 4;
  }
  if (provider.verification?.status === 'APPROVED' && provider.status === 'ONLINE_AVAILABLE') {
    return 3;
  }
  if (provider.verification?.status === 'APPROVED') {
    return 2;
  }
  return 1;
}

function providerLocationStatus(provider: AdminProvider): ProviderLocationState {
  if (!hasProviderCoordinate(provider) || !provider.currentLocationUpdatedAt) {
    return 'missing';
  }

  const updatedAt = new Date(provider.currentLocationUpdatedAt).getTime();
  if (!Number.isFinite(updatedAt)) {
    return 'missing';
  }

  const ageMs = Date.now() - updatedAt;
  if (ageMs > EXPIRED_LOCATION_HOURS * 60 * 60_000) {
    return 'expired';
  }
  if (ageMs > STALE_LOCATION_MINUTES * 60_000) {
    return 'stale';
  }
  return 'recent';
}

function hasProviderCoordinate(provider: AdminProvider) {
  if (provider.currentLat === null || provider.currentLat === undefined) {
    return false;
  }
  if (provider.currentLng === null || provider.currentLng === undefined) {
    return false;
  }
  return Number.isFinite(Number(provider.currentLat)) && Number.isFinite(Number(provider.currentLng));
}

function providerLocationLabel(status: ProviderLocationState) {
  if (status === 'recent') {
    return 'Location recent';
  }
  if (status === 'stale') {
    return 'Location stale';
  }
  if (status === 'expired') {
    return 'Too old';
  }
  return 'No location';
}

function providerLocationPillClass(status: ProviderLocationState) {
  if (status === 'recent') {
    return 'pill-success';
  }
  if (status === 'stale') {
    return 'pill-warn';
  }
  if (status === 'expired') {
    return 'pill-info';
  }
  return 'pill-neutral';
}

function providerLocationAgeLabel(value?: string | null) {
  if (!value) {
    return 'Provider app has not shared a location.';
  }

  const updatedAt = new Date(value).getTime();
  if (!Number.isFinite(updatedAt)) {
    return 'Saved location time is invalid.';
  }

  const ageMinutes = Math.max(0, Math.round((Date.now() - updatedAt) / 60_000));
  if (ageMinutes < 1) {
    return 'Updated just now.';
  }
  if (ageMinutes < 60) {
    return `Updated ${ageMinutes}m ago.`;
  }

  const ageHours = Math.round(ageMinutes / 60);
  return `Updated ${ageHours}h ago.`;
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
