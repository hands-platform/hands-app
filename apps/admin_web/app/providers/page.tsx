import Link from 'next/link';
import { AdminProvider, adminGet } from '../../lib/admin-api';
import {
  approveProvider,
  approveProviderBankAccount,
  approveProviderDocument,
  approveProviderKyc,
  approveProviderTaxProfile,
  enablePushDevice,
  rejectProvider,
  rejectProviderBankAccount,
  rejectProviderDocument,
  rejectProviderKyc,
  rejectProviderTaxProfile,
  syncSupabaseProviderRole,
} from './actions';

type AdminPushDevice = NonNullable<NonNullable<AdminProvider['user']>['pushDevices']>[number];
type ProviderLocationState = 'recent' | 'stale' | 'expired' | 'missing';
type ProviderFilters = {
  q: string;
  verification: string;
  providerStatus: string;
  kyc: string;
  location: string;
  readiness: string;
  review: string;
};
type ProvidersPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const STALE_LOCATION_MINUTES = 30;
const EXPIRED_LOCATION_HOURS = 24;

export default async function ProvidersPage({ searchParams }: { searchParams?: ProvidersPageSearchParams }) {
  const filters = buildProviderFilters(searchParams ? await searchParams : {});
  const allProviders = sortProviders(await adminGet<AdminProvider[]>('/admin/providers', []));
  const providers = filterProviders(allProviders, filters);
  const fileReadUrls = new Map<string, string>();
  await Promise.all(
    providers.flatMap((provider) =>
      [
        ...(provider.verification?.files ?? []),
        ...(provider.documents ?? []).map((document) => document.fileAsset).filter(Boolean),
      ].map(async (file) => {
        if (!file?.id) return;
        const result = await adminGet<{ read?: { url?: string } }>(`/files/${file.id}/read-url`, {});
        if (result.read?.url) {
          fileReadUrls.set(file.id, result.read.url);
        }
      }),
    ),
  );
  const summary = buildProviderSummary(providers);
  const reviewQueue = buildProviderReviewQueue(providers);

  return (
    <>
      <h1>Provider Verification</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <form className="form-grid" action="/providers">
          <label>
            Search
            <input name="q" defaultValue={filters.q} placeholder="Name, phone, city, provider id" />
          </label>
          <label>
            Verification
            <select name="verification" defaultValue={filters.verification}>
              <option value="">All</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </label>
          <label>
            Provider status
            <select name="providerStatus" defaultValue={filters.providerStatus}>
              <option value="">All</option>
              <option value="ONLINE_AVAILABLE">Online available</option>
              <option value="ONLINE_BUSY">Online busy</option>
              <option value="ONLINE_AVAILABLE_SOON">Available soon</option>
              <option value="OFFLINE">Offline</option>
            </select>
          </label>
          <label>
            KYC
            <select name="kyc" defaultValue={filters.kyc}>
              <option value="">All</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
              <option value="DRAFT">Draft</option>
              <option value="MISSING">Missing</option>
            </select>
          </label>
          <label>
            Location
            <select name="location" defaultValue={filters.location}>
              <option value="">All</option>
              <option value="recent">Recent</option>
              <option value="stale">Stale</option>
              <option value="expired">Expired</option>
              <option value="missing">Missing</option>
            </select>
          </label>
          <label>
            Readiness
            <select name="readiness" defaultValue={filters.readiness}>
              <option value="">All</option>
              <option value="ready">Ready for dispatch</option>
              <option value="needs-review">Needs review</option>
              <option value="approved-offline">Approved but offline</option>
              <option value="push-missing">Push missing</option>
            </select>
          </label>
          <label>
            Review queue
            <select name="review" defaultValue={filters.review}>
              <option value="">All</option>
              <option value="kyc">KYC updates</option>
              <option value="documents">Document review</option>
              <option value="bank">Bank payout review</option>
              <option value="tax">Tax profile review</option>
              <option value="location">Location freshness</option>
              <option value="push">Push alert readiness</option>
            </select>
          </label>
          <div className="actions full-span">
            <button type="submit">Apply filters</button>
            <Link className="text-link" href="/providers">
              Clear filters
            </Link>
            <span className="muted">
              Showing {providers.length} of {allProviders.length} therapists
            </span>
          </div>
        </form>
      </div>
      <div className="grid" style={{ marginBottom: 16 }}>
        {summary.map(([label, value]) => (
          <div className="card" key={label}>
            <p>{label}</p>
            <h2>{value}</h2>
          </div>
        ))}
      </div>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Review queue</h2>
            <p className="muted">
              Prioritized provider issues for KYC, documents, payout readiness, device alerts, and dispatch
              location freshness.
            </p>
          </div>
          <span className={`pill ${reviewQueue.totalOpen === 0 ? 'pill-success' : 'pill-warn'}`}>
            {reviewQueue.totalOpen} open item(s)
          </span>
        </div>
        <div className="setup-stage-list">
          {reviewQueue.items.map((item) => (
            <div className="setup-stage-item" key={item.label}>
              <span>{item.count ? 'CHECK' : 'OK'}</span>
              <div>
                <strong>{item.label}</strong>
                <p className="muted">{item.detail}</p>
              </div>
              {item.href ? (
                <Link className="text-link" href={item.href}>
                  {item.count}
                </Link>
              ) : (
                <small>{item.count}</small>
              )}
            </div>
          ))}
        </div>
      </section>
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
              <tr id={`provider-${provider.id}`} key={provider.id}>
                <td>
                  <Link className="text-link" href={`/providers/${provider.id}`}>
                    {provider.displayName || provider.user?.fullName || provider.user?.phone}
                  </Link>
                  <p className="muted">{provider.user?.phone ?? provider.id}</p>
                </td>
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
                  <ProviderOnboardingCell provider={provider} fileReadUrls={fileReadUrls} />
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
                  <ProviderIssuePills provider={provider} />
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
                    <Link className="text-link" href={`/providers/${provider.id}`}>
                      Open detail
                    </Link>
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

function ProviderOnboardingCell({
  provider,
  fileReadUrls,
}: {
  provider: AdminProvider;
  fileReadUrls: Map<string, string>;
}) {
  const primaryBank = provider.bankAccounts?.[0];
  const missingAgreements = 5 - (provider.agreements?.length ?? 0);
  const documents = provider.documents ?? [];

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
      {documents.length ? (
        <div style={{ marginBottom: 10 }}>
          <p className="muted" style={{ marginBottom: 6 }}>
            Typed documents
          </p>
          {documents.map((document) => (
            <div key={document.id} className="provider-file-row">
              <div className="participant-list" style={{ marginBottom: 6 }}>
                <span className="pill pill-info">{document.type}</span>
                <span className={`pill ${document.status === 'APPROVED' ? 'pill-success' : 'pill-warn'}`}>
                  {document.status}
                </span>
              </div>
              <p className="muted" style={{ marginBottom: 6 }}>
                {document.fileAsset?.contentType ?? 'unknown file'}
                {document.fileAsset?.sizeBytes ? ` / ${formatBytes(document.fileAsset.sizeBytes)}` : ''}
                {document.fileAsset?.uploadedAt
                  ? ` / uploaded ${new Date(document.fileAsset.uploadedAt).toLocaleString()}`
                  : ''}
              </p>
              <p className="muted" style={{ marginBottom: 6 }}>
                {document.fileAsset?.id && fileReadUrls.get(document.fileAsset.id) ? (
                  <a href={fileReadUrls.get(document.fileAsset.id)} target="_blank" rel="noreferrer">
                    {document.fileAsset.key}
                  </a>
                ) : (
                  (document.fileAsset?.key ?? 'No file key')
                )}
              </p>
              <div className="actions">
                <form action={approveProviderDocument}>
                  <input type="hidden" name="documentId" value={document.id} />
                  <button type="submit" disabled={document.status === 'APPROVED'}>
                    Approve doc
                  </button>
                </form>
                <form action={rejectProviderDocument}>
                  <input type="hidden" name="documentId" value={document.id} />
                  <input
                    type="hidden"
                    name="reason"
                    value="Provider document rejected from admin dashboard"
                  />
                  <button type="submit" disabled={document.status === 'REJECTED'}>
                    Reject doc
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ marginBottom: 8 }}>
          No typed KYC documents yet.
        </p>
      )}
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

function ProviderIssuePills({ provider }: { provider: AdminProvider }) {
  const issues = providerReviewIssues(provider);
  if (!issues.length) {
    return (
      <div className="participant-list" style={{ marginBottom: 8 }}>
        <span className="pill pill-success">No blocking issues</span>
      </div>
    );
  }

  return (
    <div className="participant-list" style={{ marginBottom: 8 }}>
      {issues.slice(0, 5).map((issue) => (
        <span className={`pill ${issue.severity === 'high' ? 'pill-danger' : 'pill-warn'}`} key={issue.label}>
          {issue.label}
        </span>
      ))}
      {issues.length > 5 ? <span className="pill pill-info">+{issues.length - 5} more</span> : null}
    </div>
  );
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

function buildProviderReviewQueue(providers: AdminProvider[]) {
  const kycNeedsReview = providers.filter((provider) =>
    ['PENDING', 'REJECTED'].includes(provider.kyc?.status ?? 'MISSING'),
  ).length;
  const documentNeedsReview = providers.filter((provider) =>
    (provider.documents ?? []).some((document) => ['PENDING_REVIEW', 'REJECTED'].includes(document.status)),
  ).length;
  const bankNeedsReview = providers.filter((provider) =>
    (provider.bankAccounts ?? []).some((account) => ['PENDING_REVIEW', 'REJECTED'].includes(account.status)),
  ).length;
  const taxNeedsReview = providers.filter((provider) =>
    ['PENDING_REVIEW', 'REJECTED'].includes(provider.taxProfile?.status ?? 'MISSING'),
  ).length;
  const locationNeedsReview = providers.filter((provider) =>
    ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider)),
  ).length;
  const pushNeedsReview = providers.filter((provider) => !hasHealthyPush(provider)).length;
  const readyForDispatch = providers.filter(
    (provider) =>
      provider.verification?.status === 'APPROVED' &&
      provider.status === 'ONLINE_AVAILABLE' &&
      providerLocationStatus(provider) === 'recent' &&
      hasHealthyPush(provider),
  ).length;

  const items = [
    {
      label: 'KYC updates',
      count: kycNeedsReview,
      href: '/providers?review=kyc',
      detail: 'Providers with pending or rejected identity verification need admin review or resubmission.',
    },
    {
      label: 'Document review',
      count: documentNeedsReview,
      href: '/providers?review=documents',
      detail: 'Typed CCCD, selfie, or portfolio documents are waiting for approval or rejection handling.',
    },
    {
      label: 'Bank payout review',
      count: bankNeedsReview,
      href: '/providers?review=bank',
      detail: 'Bank accounts must be approved before providers can move toward payout readiness.',
    },
    {
      label: 'Tax profile review',
      count: taxNeedsReview,
      href: '/providers?review=tax',
      detail: 'Freelance tax profiles should be approved only after MST and registered address are checked.',
    },
    {
      label: 'Location freshness',
      count: locationNeedsReview,
      href: '/providers?review=location',
      detail: 'Providers with missing, stale, or expired locations should reopen the Provider app before dispatch.',
    },
    {
      label: 'Push alert readiness',
      count: pushNeedsReview,
      href: '/providers?review=push',
      detail: 'Providers without enabled push devices may miss direct requests and backup matching alerts.',
    },
    {
      label: 'Ready for dispatch',
      count: readyForDispatch,
      href: '/providers?readiness=ready',
      detail: 'Approved, online providers with recent location and push registration.',
    },
  ];

  const totalOpen = items
    .filter((item) => item.label !== 'Ready for dispatch')
    .reduce((sum, item) => sum + item.count, 0);

  return { items, totalOpen };
}

function providerReviewIssues(provider: AdminProvider) {
  const issues: Array<{ label: string; severity: 'high' | 'medium' }> = [];
  const kycStatus = provider.kyc?.status ?? 'MISSING';
  const bankStatus = provider.bankAccounts?.[0]?.status ?? 'MISSING';
  const taxStatus = provider.taxProfile?.status ?? 'MISSING';

  if (provider.verification?.status !== 'APPROVED') {
    issues.push({ label: 'verification review', severity: 'high' });
  }
  if (kycStatus !== 'APPROVED') {
    issues.push({ label: `KYC ${kycStatus}`, severity: kycStatus === 'REJECTED' ? 'high' : 'medium' });
  }
  if ((provider.documents ?? []).some((document) => document.status === 'REJECTED')) {
    issues.push({ label: 'document rejected', severity: 'high' });
  } else if ((provider.documents ?? []).some((document) => document.status === 'PENDING_REVIEW')) {
    issues.push({ label: 'document pending', severity: 'medium' });
  }
  if (bankStatus !== 'APPROVED') {
    issues.push({
      label: `bank ${bankStatus}`,
      severity: bankStatus === 'REJECTED' ? 'high' : 'medium',
    });
  }
  if (taxStatus !== 'APPROVED') {
    issues.push({ label: `tax ${taxStatus}`, severity: taxStatus === 'REJECTED' ? 'high' : 'medium' });
  }
  const locationState = providerLocationStatus(provider);
  if (locationState !== 'recent') {
    issues.push({ label: `location ${locationState}`, severity: locationState === 'missing' ? 'high' : 'medium' });
  }
  if (!hasHealthyPush(provider)) {
    issues.push({ label: 'push missing', severity: 'medium' });
  }
  if (!provider.user?.supabaseUserId) {
    issues.push({ label: 'Supabase role pending', severity: 'medium' });
  }

  return issues;
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

function buildProviderFilters(params: Record<string, string | string[] | undefined>): ProviderFilters {
  return {
    q: readParam(params.q),
    verification: readParam(params.verification),
    providerStatus: readParam(params.providerStatus),
    kyc: readParam(params.kyc),
    location: readParam(params.location),
    readiness: readParam(params.readiness),
    review: readParam(params.review),
  };
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '').trim() : (value ?? '').trim();
}

function filterProviders(providers: AdminProvider[], filters: ProviderFilters) {
  const search = filters.q.toLowerCase();

  return providers.filter((provider) => {
    if (search && !providerSearchText(provider).includes(search)) {
      return false;
    }
    if (filters.verification && (provider.verification?.status ?? 'DRAFT') !== filters.verification) {
      return false;
    }
    if (filters.providerStatus && provider.status !== filters.providerStatus) {
      return false;
    }
    if (filters.kyc && (provider.kyc?.status ?? 'MISSING') !== filters.kyc) {
      return false;
    }
    if (filters.location && providerLocationStatus(provider) !== filters.location) {
      return false;
    }
    if (filters.readiness && providerReadiness(provider) !== filters.readiness) {
      return false;
    }
    if (filters.review && !providerMatchesReviewQueue(provider, filters.review)) {
      return false;
    }
    return true;
  });
}

function providerMatchesReviewQueue(provider: AdminProvider, review: string) {
  if (review === 'kyc') {
    return ['PENDING', 'REJECTED'].includes(provider.kyc?.status ?? 'MISSING');
  }
  if (review === 'documents') {
    return (provider.documents ?? []).some((document) =>
      ['PENDING_REVIEW', 'REJECTED'].includes(document.status),
    );
  }
  if (review === 'bank') {
    return (provider.bankAccounts ?? []).some((account) =>
      ['PENDING_REVIEW', 'REJECTED'].includes(account.status),
    );
  }
  if (review === 'tax') {
    return ['PENDING_REVIEW', 'REJECTED'].includes(provider.taxProfile?.status ?? 'MISSING');
  }
  if (review === 'location') {
    return ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider));
  }
  if (review === 'push') {
    return !hasHealthyPush(provider);
  }
  return true;
}

function providerSearchText(provider: AdminProvider) {
  return [
    provider.id,
    provider.displayName,
    provider.legalName,
    provider.city,
    provider.residentialAddress,
    provider.user?.fullName,
    provider.user?.phone,
    provider.services?.map((item) => item.service?.name).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function providerReadiness(provider: AdminProvider) {
  if (
    provider.verification?.status === 'APPROVED' &&
    provider.status === 'ONLINE_AVAILABLE' &&
    providerLocationStatus(provider) === 'recent' &&
    hasHealthyPush(provider)
  ) {
    return 'ready';
  }
  if (provider.verification?.status === 'APPROVED' && provider.status !== 'ONLINE_AVAILABLE') {
    return 'approved-offline';
  }
  if (provider.verification?.status === 'APPROVED' && !hasHealthyPush(provider)) {
    return 'push-missing';
  }
  return 'needs-review';
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
