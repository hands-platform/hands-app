import Link from 'next/link';
import {
  AdminProvider,
  adminGet,
  providerDocumentLabel,
  providerDocumentReviewHint,
} from '../../lib/admin-api';
import {
  approveProvider,
  approveProviderBankAccount,
  approveProviderDocument,
  approveProviderKyc,
  approveProviderTaxProfile,
  blockProviderAccount,
  enablePushDevice,
  rejectProvider,
  rejectProviderBankAccount,
  rejectProviderDocument,
  rejectProviderKyc,
  rejectProviderTaxProfile,
  syncSupabaseProviderRole,
  unblockProviderAccount,
} from './actions';

type AdminPushDevice = NonNullable<NonNullable<AdminProvider['user']>['pushDevices']>[number];
type ProviderLocationState = 'recent' | 'stale' | 'expired' | 'missing';
type ProviderSecurityState = 'clear' | 'account-blocked' | 'blocked' | 'suspicious' | 'shared' | 'missing';
type ProviderFilters = {
  q: string;
  verification: string;
  providerStatus: string;
  kyc: string;
  location: string;
  security: string;
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
  const priorityLane = buildProviderPriorityLane(providers);
  const activeFilters = buildProviderActiveFilters(filters);

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
              <option value="SUBMITTED">Submitted</option>
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
            Security
            <select name="security" defaultValue={filters.security}>
              <option value="">All</option>
              <option value="account-blocked">Account blocked</option>
              <option value="blocked">Blocked device</option>
              <option value="suspicious">Suspicious session</option>
              <option value="shared">Shared device</option>
              <option value="missing">No app device</option>
              <option value="clear">Clear</option>
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
              <option value="security">Device/session risk</option>
              <option value="risk">Reports/sanctions</option>
              <option value="blocked">Account blocks</option>
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
          {activeFilters.length > 0 ? (
            <div className="full-span">
              <div className="participant-list">
                <span className="pill pill-info">Active filters</span>
                {activeFilters.map((filter) => (
                  <span className="pill pill-warn" key={`${filter.kind}-${filter.value}`}>
                    {filter.label}
                  </span>
                ))}
              </div>
              <p className="muted" style={{ marginTop: 8 }}>
                {activeFilters.map((filter) => filter.description).join(' ')}
              </p>
            </div>
          ) : (
            <p className="muted full-span">No provider filter is active. Showing the full operator queue.</p>
          )}
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
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Provider priority lane</h2>
            <p className="muted">
              The next operators should open these provider profiles first. This is derived from profile, KYC,
              document, bank, tax, location, and push readiness.
            </p>
          </div>
          <span className={`pill ${priorityLane.blockedCount === 0 ? 'pill-success' : 'pill-danger'}`}>
            {priorityLane.blockedCount} blocked
          </span>
        </div>
        <div className="setup-stage-list">
          {priorityLane.items.map((item) => (
            <div className="setup-stage-item" key={item.provider.id}>
              <span>{item.action.status}</span>
              <div>
                <strong>
                  <Link className="text-link" href={`/providers/${item.provider.id}`}>
                    {providerDisplayName(item.provider)}
                  </Link>
                </strong>
                <p className="muted">{item.action.detail}</p>
                <p className="muted">{item.action.operatorAction}</p>
              </div>
              <small>
                {item.action.tone === 'done' ? 'OK' : item.action.tone === 'blocked' ? 'Fix' : 'Watch'}
              </small>
            </div>
          ))}
          {priorityLane.items.length === 0 ? (
            <div className="setup-stage-item">
              <span>OK</span>
              <div>
                <strong>No providers need immediate attention</strong>
                <p className="muted">The current filtered list has no blocking provider operation items.</p>
              </div>
              <small>Clear</small>
            </div>
          ) : null}
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
              <th>Device Risk</th>
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
                  {provider.blockedAt ? (
                    <p className="muted" style={{ marginTop: 4 }}>
                      Account blocked: {provider.blockedReason ?? 'No reason saved'}
                    </p>
                  ) : null}
                </td>
                <td>
                  <ProviderOnboardingCell provider={provider} fileReadUrls={fileReadUrls} />
                </td>
                <td>
                  <ProviderNextActionCell provider={provider} />
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
                    <span
                      className={`pill ${hasOpenProviderRisk(provider) ? 'pill-danger' : 'pill-success'}`}
                    >
                      {hasOpenProviderRisk(provider) ? 'Risk open' : 'Risk clear'}
                    </span>
                  </div>
                  <ProviderIssuePills provider={provider} />
                  <p className="muted">{providerActionHint(provider)}</p>
                  {hasOpenProviderRisk(provider) ? (
                    <Link className="text-link" href={`/provider-risk?q=${encodeURIComponent(provider.id)}`}>
                      Open risk desk
                    </Link>
                  ) : null}
                </td>
                <td>
                  <ProviderLocationCell provider={provider} />
                </td>
                <td>
                  <ProviderSecurityCell provider={provider} />
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
                      <input
                        name="reason"
                        placeholder="Provider rejection reason"
                        required
                        minLength={12}
                        maxLength={500}
                      />
                      <button type="submit">Reject</button>
                    </form>
                    <form action={syncSupabaseProviderRole}>
                      <input type="hidden" name="providerId" value={provider.id} />
                      <button type="submit" disabled={provider.verification?.status !== 'APPROVED'}>
                        Sync Supabase role
                      </button>
                    </form>
                    {provider.blockedAt ? (
                      <form action={unblockProviderAccount}>
                        <input type="hidden" name="providerId" value={provider.id} />
                        <button type="submit">Unblock account</button>
                      </form>
                    ) : (
                      <form action={blockProviderAccount}>
                        <input type="hidden" name="providerId" value={provider.id} />
                        <input
                          name="reason"
                          placeholder="Account block reason"
                          required
                          minLength={12}
                          maxLength={500}
                        />
                        <button type="submit">Block account</button>
                      </form>
                    )}
                    <Link className="text-link" href={`/providers/${provider.id}`}>
                      Open detail
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {providers.length === 0 && (
              <tr>
                <td colSpan={10}>{emptyProviderMessage(activeFilters)}</td>
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
  const canApproveKyc = hasApprovedRequiredKycDocuments(provider);
  const taxNeedsReview = providerTaxNeedsReview(provider);
  const taxStatus = provider.taxProfile?.status ?? (taxNeedsReview ? 'MISSING' : 'DEFERRED');

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
        <span className={`pill ${providerTaxPillClass(provider)}`}>Tax {taxStatus}</span>
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
                <span className="pill pill-info">{providerDocumentLabel(document.type)}</span>
                <span className={`pill ${document.status === 'APPROVED' ? 'pill-success' : 'pill-warn'}`}>
                  {document.status}
                </span>
              </div>
              <p className="muted" style={{ marginBottom: 6 }}>
                {providerDocumentReviewHint(document.type)}
              </p>
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
                  <input type="hidden" name="providerId" value={provider.id} />
                  <input type="hidden" name="documentId" value={document.id} />
                  <button type="submit" disabled={document.status === 'APPROVED'}>
                    Approve doc
                  </button>
                </form>
                <form action={rejectProviderDocument}>
                  <input type="hidden" name="providerId" value={provider.id} />
                  <input type="hidden" name="documentId" value={document.id} />
                  <input
                    name="reason"
                    placeholder="Document rejection reason"
                    required
                    minLength={12}
                    maxLength={500}
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
          No typed provider documents yet.
        </p>
      )}
      <div className="actions">
        <form action={approveProviderKyc}>
          <input type="hidden" name="providerId" value={provider.id} />
          <button type="submit" disabled={provider.kyc?.status === 'APPROVED' || !canApproveKyc}>
            Approve KYC
          </button>
        </form>
        <form action={rejectProviderKyc}>
          <input type="hidden" name="providerId" value={provider.id} />
          <input name="reason" placeholder="KYC rejection reason" required minLength={12} maxLength={500} />
          <button type="submit" disabled={!provider.kyc || provider.kyc.status === 'REJECTED'}>
            Reject KYC
          </button>
        </form>
        {primaryBank ? (
          <>
            <form action={approveProviderBankAccount}>
              <input type="hidden" name="providerId" value={provider.id} />
              <input type="hidden" name="bankAccountId" value={primaryBank.id} />
              <button type="submit" disabled={primaryBank.status === 'APPROVED'}>
                Approve bank
              </button>
            </form>
            <form action={rejectProviderBankAccount}>
              <input type="hidden" name="providerId" value={provider.id} />
              <input type="hidden" name="bankAccountId" value={primaryBank.id} />
              <input
                name="reason"
                placeholder="Bank rejection reason"
                required
                minLength={12}
                maxLength={500}
              />
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
              <input
                name="reason"
                placeholder="Tax rejection reason"
                required
                minLength={12}
                maxLength={500}
              />
              <button type="submit" disabled={provider.taxProfile.status === 'REJECTED'}>
                Reject tax
              </button>
            </form>
          </>
        ) : null}
      </div>
      {!canApproveKyc ? (
        <p className="muted" style={{ marginTop: 8 }}>
          KYC approval unlocks after CCCD front, CCCD back, and selfie documents are approved.
        </p>
      ) : null}
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

type ProviderListAction = {
  status: string;
  detail: string;
  operatorAction: string;
  tone: 'done' | 'pending' | 'blocked';
  priority: number;
};

function ProviderNextActionCell({ provider }: { provider: AdminProvider }) {
  const action = nextProviderListAction(provider);
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="participant-list" style={{ marginBottom: 6 }}>
        <span className={`pill ${providerListActionPillClass(action.tone)}`}>{action.status}</span>
      </div>
      <p className="muted" style={{ marginBottom: 4 }}>
        {action.detail}
      </p>
      <p className="muted" style={{ marginBottom: 8 }}>
        {action.operatorAction}
      </p>
    </div>
  );
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

function buildProviderPriorityLane(providers: AdminProvider[]) {
  const ranked = providers
    .map((provider) => ({ provider, action: nextProviderListAction(provider) }))
    .filter((item) => item.action.tone !== 'done')
    .sort((left, right) => {
      if (left.action.priority !== right.action.priority) {
        return right.action.priority - left.action.priority;
      }
      return providerDisplayName(left.provider).localeCompare(providerDisplayName(right.provider));
    });

  return {
    items: ranked.slice(0, 6),
    blockedCount: ranked.filter((item) => item.action.tone === 'blocked').length,
  };
}

function nextProviderListAction(provider: AdminProvider): ProviderListAction {
  const missingDocuments = missingApprovedRequiredKycDocuments(provider);
  const primaryBank = provider.bankAccounts?.[0];
  const completedServiceSignal =
    provider.level === 'LEVEL_3_PAYOUT_ENABLED' || provider.level === 'LEVEL_4_TRUSTED';
  const agreementsAccepted = provider.agreements?.length ?? 0;
  const locationState = providerLocationStatus(provider);
  const securityState = providerSecurityStatus(provider);

  if (provider.blockedAt) {
    return {
      status: 'ACCOUNT',
      detail: `Provider account is blocked${provider.blockedReason ? `: ${provider.blockedReason}` : '.'}`,
      operatorAction: 'Unblock only after identity, safety, payout, or policy issue is resolved.',
      tone: 'blocked',
      priority: 120,
    };
  }
  if (!provider.displayName?.trim() || !provider.legalName?.trim() || !provider.residentialAddress?.trim()) {
    return {
      status: 'PROFILE',
      detail: 'Basic profile is incomplete.',
      operatorAction: 'Ask provider to complete name, legal name, and address before approval.',
      tone: 'blocked',
      priority: 100,
    };
  }
  if (missingDocuments.length > 0) {
    return {
      status: 'DOCUMENTS',
      detail: `Missing or unapproved: ${missingDocuments.map(providerDocumentLabel).join(', ')}.`,
      operatorAction: 'Open detail and review each typed KYC document.',
      tone: 'blocked',
      priority: 95,
    };
  }
  if (provider.kyc?.status !== 'APPROVED') {
    return {
      status: 'KYC',
      detail: `KYC status is ${provider.kyc?.status ?? 'MISSING'}.`,
      operatorAction: 'Approve or reject KYC with a clear reason.',
      tone: 'blocked',
      priority: provider.kyc?.status === 'REJECTED' ? 92 : 90,
    };
  }
  if (provider.verification?.status !== 'APPROVED') {
    return {
      status: 'VERIFY',
      detail: `Provider verification is ${provider.verification?.status ?? 'DRAFT'}.`,
      operatorAction: 'Approve provider verification when identity review is complete.',
      tone: 'blocked',
      priority: 86,
    };
  }
  if (primaryBank?.status !== 'APPROVED') {
    return {
      status: 'BANK',
      detail: `Primary bank account is ${primaryBank?.status ?? 'missing'}.`,
      operatorAction: 'Approve or reject bank details before payout readiness.',
      tone: 'blocked',
      priority: primaryBank?.status === 'REJECTED' ? 82 : 80,
    };
  }
  if (completedServiceSignal && provider.taxProfile?.status !== 'APPROVED') {
    return {
      status: 'TAX',
      detail: `Provider has payout-level signal, but tax profile is ${provider.taxProfile?.status ?? 'missing'}.`,
      operatorAction: 'Approve/reject tax profile before withdrawal.',
      tone: 'blocked',
      priority: provider.taxProfile?.status === 'REJECTED' ? 76 : 74,
    };
  }
  if (completedServiceSignal && agreementsAccepted < 5) {
    return {
      status: 'TERMS',
      detail: `Payout agreements are ${agreementsAccepted}/5.`,
      operatorAction: 'Ask provider to accept missing payout/tax/location agreements.',
      tone: 'blocked',
      priority: 70,
    };
  }
  if (securityState === 'account-blocked') {
    return {
      status: 'ACCOUNT',
      detail: 'The provider account is blocked by admin policy.',
      operatorAction: 'Open provider detail and unblock only after the recorded issue is resolved.',
      tone: 'blocked',
      priority: 69,
    };
  }
  if (securityState === 'blocked') {
    return {
      status: 'DEVICE',
      detail: 'At least one provider app device is blocked.',
      operatorAction: 'Open provider detail and decide whether to unblock or keep the device blocked.',
      tone: 'blocked',
      priority: 68,
    };
  }
  if (securityState === 'suspicious' || securityState === 'shared') {
    return {
      status: 'SECURITY',
      detail:
        securityState === 'shared'
          ? 'A device appears on more than one provider profile.'
          : 'Recent provider session has a suspicious risk flag.',
      operatorAction: 'Review device/session history before relying on this provider for dispatch.',
      tone: 'blocked',
      priority: 67,
    };
  }
  if (locationState !== 'recent') {
    return {
      status: 'LOCATION',
      detail: providerLocationAgeLabel(provider.currentLocationUpdatedAt),
      operatorAction: 'Ask provider to open the app and refresh current location.',
      tone: locationState === 'missing' ? 'blocked' : 'pending',
      priority: locationState === 'missing' ? 66 : 58,
    };
  }
  if (!hasHealthyPush(provider)) {
    return {
      status: 'PUSH',
      detail: 'No enabled push device is available for request alerts.',
      operatorAction: 'Ask provider to reopen the app and register alerts.',
      tone: 'pending',
      priority: 54,
    };
  }
  if (!provider.user?.supabaseUserId) {
    return {
      status: 'SUPABASE',
      detail: 'Provider is still on Nest auth only.',
      operatorAction: 'Sync/link Supabase role after Supabase OTP login is active.',
      tone: 'pending',
      priority: 35,
    };
  }
  return {
    status: 'CLEAR',
    detail: 'No provider operation blocker is visible.',
    operatorAction: 'Monitor dispatch and service quality.',
    tone: 'done',
    priority: 0,
  };
}

function missingApprovedRequiredKycDocuments(provider: AdminProvider) {
  const requiredDocuments = ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE'];
  const approvedDocuments = new Set(
    (provider.documents ?? [])
      .filter((document) => document.status === 'APPROVED')
      .map((document) => document.type),
  );
  return requiredDocuments.filter((type) => !approvedDocuments.has(type));
}

function providerListActionPillClass(tone: ProviderListAction['tone']) {
  if (tone === 'done') return 'pill-success';
  if (tone === 'blocked') return 'pill-danger';
  return 'pill-warn';
}

function providerDisplayName(provider: AdminProvider) {
  return provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id;
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

function ProviderSecurityCell({ provider }: { provider: AdminProvider }) {
  const status = providerSecurityStatus(provider);
  const blockedDevices = (provider.devices ?? []).filter((device) => Boolean(device.blockedAt));
  const suspiciousSessions = (provider.sessions ?? []).filter((session) => session.suspicious);
  const sharedDevices = sharedDeviceIds(provider);
  const latestDevice = provider.devices?.[0];
  const latestSession = provider.sessions?.[0];

  return (
    <div>
      <div className="participant-list" style={{ marginBottom: 8 }}>
        <span className={`pill ${providerSecurityPillClass(status)}`}>{providerSecurityLabel(status)}</span>
      </div>
      <p className="muted" style={{ marginBottom: 4 }}>
        {latestDevice
          ? `Last app device: ${maskToken(latestDevice.deviceId)} / ${latestDevice.platform ?? 'unknown'}`
          : 'No provider app device recorded yet.'}
      </p>
      {provider.blockedAt ? (
        <p className="muted" style={{ marginBottom: 4 }}>
          Account block: {provider.blockedReason ?? 'No reason saved'} / {formatDate(provider.blockedAt)}
        </p>
      ) : null}
      {latestSession ? (
        <p className="muted" style={{ marginBottom: 4 }}>
          Last session: {latestSession.ipAddress ?? 'no IP'} / {formatDate(latestSession.lastSeenAt)}
        </p>
      ) : null}
      {blockedDevices.length ? <p className="muted">{blockedDevices.length} blocked device(s)</p> : null}
      {suspiciousSessions.length ? (
        <p className="muted">{suspiciousSessions.length} suspicious session(s)</p>
      ) : null}
      {sharedDevices.size ? <p className="muted">{sharedDevices.size} shared device id(s)</p> : null}
      <Link className="text-link" href={`/providers/${provider.id}`}>
        Review security
      </Link>
    </div>
  );
}

function providerActionHint(provider: AdminProvider) {
  if (provider.blockedAt) {
    return 'This provider account is blocked and cannot go online, update location, or appear to customers.';
  }
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
  const securityState = providerSecurityStatus(provider);
  if (securityState !== 'clear') {
    return 'Therapist has a device/session security item. Review it before dispatching high-risk bookings.';
  }
  if (!provider.user?.supabaseUserId) {
    return 'Therapist is operational in Nest auth. Supabase role sync will become available after Supabase OTP login links this phone.';
  }
  return 'Therapist is ready for direct requests and fallback matching.';
}

function hasApprovedRequiredKycDocuments(provider: AdminProvider) {
  return missingApprovedRequiredKycDocuments(provider).length === 0;
}

function buildProviderSummary(providers: AdminProvider[]) {
  const accountBlocked = providers.filter((provider) => Boolean(provider.blockedAt)).length;
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
  const openRisk = providers.filter((provider) => hasOpenProviderRisk(provider)).length;
  const deviceRisk = providers.filter((provider) =>
    ['account-blocked', 'blocked', 'suspicious', 'shared'].includes(providerSecurityStatus(provider)),
  ).length;
  const readyNow = providers.filter(
    (provider) =>
      provider.verification?.status === 'APPROVED' &&
      !provider.blockedAt &&
      provider.status === 'ONLINE_AVAILABLE' &&
      providerLocationStatus(provider) === 'recent' &&
      providerSecurityStatus(provider) === 'clear' &&
      hasHealthyPush(provider),
  ).length;

  return [
    ['Total therapists', providers.length.toString()],
    ['Account blocked', accountBlocked.toString()],
    ['Approved', approved.toString()],
    ['Online now', online.toString()],
    ['Recent location', recentLocation.toString()],
    ['Location needs review', staleLocation.toString()],
    ['Push ready', pushReady.toString()],
    ['Push needs review', pushDisabled.toString()],
    ['Open risk', openRisk.toString()],
    ['Device risk', deviceRisk.toString()],
    ['Ready for dispatch', readyNow.toString()],
  ] as const;
}

function buildProviderReviewQueue(providers: AdminProvider[]) {
  const accountBlocks = providers.filter((provider) => Boolean(provider.blockedAt)).length;
  const kycNeedsReview = providers.filter((provider) =>
    ['PENDING', 'REJECTED'].includes(provider.kyc?.status ?? 'MISSING'),
  ).length;
  const documentNeedsReview = providers.filter((provider) =>
    (provider.documents ?? []).some((document) => ['PENDING_REVIEW', 'REJECTED'].includes(document.status)),
  ).length;
  const bankNeedsReview = providers.filter((provider) =>
    (provider.bankAccounts ?? []).some((account) => ['PENDING_REVIEW', 'REJECTED'].includes(account.status)),
  ).length;
  const taxNeedsReview = providers.filter(providerTaxNeedsReview).length;
  const locationNeedsReview = providers.filter((provider) =>
    ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider)),
  ).length;
  const pushNeedsReview = providers.filter((provider) => !hasHealthyPush(provider)).length;
  const securityNeedsReview = providers.filter((provider) =>
    ['account-blocked', 'blocked', 'suspicious', 'shared'].includes(providerSecurityStatus(provider)),
  ).length;
  const riskNeedsReview = providers.filter((provider) => hasOpenProviderRisk(provider)).length;
  const readyForDispatch = providers.filter(
    (provider) =>
      provider.verification?.status === 'APPROVED' &&
      !provider.blockedAt &&
      provider.status === 'ONLINE_AVAILABLE' &&
      providerLocationStatus(provider) === 'recent' &&
      providerSecurityStatus(provider) === 'clear' &&
      hasHealthyPush(provider),
  ).length;

  const items = [
    {
      label: 'Account blocks',
      count: accountBlocks,
      href: '/providers?review=blocked',
      detail:
        'Providers blocked by admin cannot go online, refresh location, or appear in customer discovery.',
    },
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
      label: 'Device/session risk',
      count: securityNeedsReview,
      href: '/providers?review=security',
      detail: 'Blocked, shared, or suspicious provider app devices need operator review.',
    },
    {
      label: 'Reports and sanctions',
      count: riskNeedsReview,
      href: '/providers?review=risk',
      detail: 'Open reports or active sanctions should be reviewed before dispatch and trust badge changes.',
    },
    {
      label: 'Location freshness',
      count: locationNeedsReview,
      href: '/providers?review=location',
      detail:
        'Providers with missing, stale, or expired locations should reopen the Provider app before dispatch.',
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

function providerTaxNeedsReview(provider: AdminProvider) {
  const taxStatus = provider.taxProfile?.status ?? 'MISSING';
  if (['PENDING_REVIEW', 'REJECTED'].includes(taxStatus)) {
    return true;
  }

  const payoutLevelReached =
    provider.level === 'LEVEL_3_PAYOUT_ENABLED' || provider.level === 'LEVEL_4_TRUSTED';
  return payoutLevelReached && taxStatus !== 'APPROVED';
}

function providerTaxPillClass(provider: AdminProvider) {
  if (provider.taxProfile?.status === 'APPROVED') {
    return 'pill-success';
  }
  if (providerTaxNeedsReview(provider)) {
    return provider.taxProfile?.status === 'REJECTED' ? 'pill-danger' : 'pill-warn';
  }
  return 'pill-neutral';
}

function providerReviewIssues(provider: AdminProvider) {
  const issues: Array<{ label: string; severity: 'high' | 'medium' }> = [];
  const kycStatus = provider.kyc?.status ?? 'MISSING';
  const bankStatus = provider.bankAccounts?.[0]?.status ?? 'MISSING';
  const taxStatus = provider.taxProfile?.status ?? 'MISSING';

  if (provider.blockedAt) {
    issues.push({ label: 'account blocked', severity: 'high' });
  }
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
  if (providerTaxNeedsReview(provider)) {
    issues.push({ label: `tax ${taxStatus}`, severity: taxStatus === 'REJECTED' ? 'high' : 'medium' });
  }
  const locationState = providerLocationStatus(provider);
  if (locationState !== 'recent') {
    issues.push({
      label: `location ${locationState}`,
      severity: locationState === 'missing' ? 'high' : 'medium',
    });
  }
  const securityState = providerSecurityStatus(provider);
  if (securityState === 'blocked') {
    issues.push({ label: 'device blocked', severity: 'high' });
  } else if (securityState === 'suspicious') {
    issues.push({ label: 'session suspicious', severity: 'high' });
  } else if (securityState === 'shared') {
    issues.push({ label: 'shared device', severity: 'high' });
  } else if (securityState === 'missing') {
    issues.push({ label: 'device missing', severity: 'medium' });
  }
  if (!hasHealthyPush(provider)) {
    issues.push({ label: 'push missing', severity: 'medium' });
  }
  if (!provider.user?.supabaseUserId) {
    issues.push({ label: 'Supabase role pending', severity: 'medium' });
  }
  const openReports = (provider.reports ?? []).filter((report) =>
    ['OPEN', 'INVESTIGATING'].includes(report.status),
  ).length;
  const activeSanctions = (provider.sanctions ?? []).filter(
    (sanction) => sanction.status === 'ACTIVE',
  ).length;
  if (openReports > 0) {
    issues.push({ label: `${openReports} open report(s)`, severity: 'high' });
  }
  if (activeSanctions > 0) {
    issues.push({ label: `${activeSanctions} active sanction(s)`, severity: 'high' });
  }

  return issues;
}

function hasOpenProviderRisk(provider: AdminProvider) {
  return (
    (provider.reports ?? []).some((report) => ['OPEN', 'INVESTIGATING'].includes(report.status)) ||
    (provider.sanctions ?? []).some((sanction) => sanction.status === 'ACTIVE')
  );
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
    security: readParam(params.security),
    readiness: readParam(params.readiness),
    review: readParam(params.review),
  };
}

function buildProviderActiveFilters(filters: ProviderFilters) {
  return [
    filters.q
      ? {
          kind: 'search',
          value: filters.q,
          label: `Search: ${filters.q}`,
          description: 'Provider list is narrowed by name, phone, location, service, or risk text.',
        }
      : null,
    filters.verification
      ? {
          kind: 'verification',
          value: filters.verification,
          label: `Verification: ${filters.verification}`,
          description: providerFilterDescription('verification', filters.verification),
        }
      : null,
    filters.providerStatus
      ? {
          kind: 'providerStatus',
          value: filters.providerStatus,
          label: `Status: ${filters.providerStatus}`,
          description: providerFilterDescription('providerStatus', filters.providerStatus),
        }
      : null,
    filters.kyc
      ? {
          kind: 'kyc',
          value: filters.kyc,
          label: `KYC: ${filters.kyc}`,
          description: providerFilterDescription('kyc', filters.kyc),
        }
      : null,
    filters.location
      ? {
          kind: 'location',
          value: filters.location,
          label: `Location: ${filters.location}`,
          description: providerFilterDescription('location', filters.location),
        }
      : null,
    filters.security
      ? {
          kind: 'security',
          value: filters.security,
          label: `Security: ${filters.security}`,
          description: providerFilterDescription('security', filters.security),
        }
      : null,
    filters.readiness
      ? {
          kind: 'readiness',
          value: filters.readiness,
          label: `Readiness: ${filters.readiness}`,
          description: providerFilterDescription('readiness', filters.readiness),
        }
      : null,
    filters.review
      ? {
          kind: 'review',
          value: filters.review,
          label: `Review: ${filters.review}`,
          description: providerFilterDescription('review', filters.review),
        }
      : null,
  ].filter(Boolean) as Array<{ kind: string; value: string; label: string; description: string }>;
}

function providerFilterDescription(kind: string, value: string) {
  if (kind === 'verification' && value === 'SUBMITTED') {
    return 'Submitted identity files are waiting for admin approval or rejection.';
  }
  if (kind === 'verification' && value === 'APPROVED') {
    return 'Approved providers can progress toward dispatch if other readiness checks pass.';
  }
  if (kind === 'verification' && value === 'BLOCKED') {
    return 'Blocked provider accounts cannot receive customer requests.';
  }
  if (kind === 'providerStatus') {
    return 'Provider availability is narrowed to the selected online/offline state.';
  }
  if (kind === 'kyc') {
    return 'KYC review is narrowed to the selected identity state.';
  }
  if (kind === 'location') {
    return 'Location freshness is narrowed so dispatch can check stale or missing provider pins.';
  }
  if (kind === 'security') {
    return 'Security review is narrowed to device, session, or account risk state.';
  }
  if (kind === 'readiness') {
    return 'Readiness shows whether a provider can safely appear in customer discovery and dispatch.';
  }
  if (kind === 'review' && value === 'push') {
    return 'Push readiness highlights providers whose devices cannot reliably receive booking alerts.';
  }
  if (kind === 'review' && value === 'risk') {
    return 'Risk review highlights providers with open reports or active sanctions.';
  }
  if (kind === 'review') {
    return 'Review queue focuses the table on one operational approval lane.';
  }
  return 'Provider list is narrowed by the active filter.';
}

function emptyProviderMessage(activeFilters: Array<{ description: string }>) {
  if (activeFilters.length === 0) {
    return 'No providers loaded. Start the API and seed data to populate this table.';
  }
  return 'No providers match the active filters. Clear filters or switch to another review lane.';
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
    if (filters.verification === 'BLOCKED') {
      if (!provider.blockedAt) return false;
    } else if (filters.verification && (provider.verification?.status ?? 'DRAFT') !== filters.verification) {
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
    if (filters.security && providerSecurityStatus(provider) !== filters.security) {
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
  if (review === 'blocked') {
    return Boolean(provider.blockedAt);
  }
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
    return providerTaxNeedsReview(provider);
  }
  if (review === 'security') {
    return ['account-blocked', 'blocked', 'suspicious', 'shared'].includes(providerSecurityStatus(provider));
  }
  if (review === 'risk') {
    return hasOpenProviderRisk(provider);
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
    provider.blockedReason,
    provider.user?.fullName,
    provider.user?.phone,
    provider.devices?.map((device) => device.deviceId).join(' '),
    provider.sessions?.map((session) => `${session.deviceId ?? ''} ${session.ipAddress ?? ''}`).join(' '),
    provider.reports
      ?.map((report) => `${report.category} ${report.summary} ${report.details ?? ''}`)
      .join(' '),
    provider.sanctions?.map((sanction) => `${sanction.type} ${sanction.reason}`).join(' '),
    provider.services?.map((item) => item.service?.name).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function providerReadiness(provider: AdminProvider) {
  if (provider.blockedAt) {
    return 'needs-review';
  }
  if (
    provider.verification?.status === 'APPROVED' &&
    provider.status === 'ONLINE_AVAILABLE' &&
    providerLocationStatus(provider) === 'recent' &&
    providerSecurityStatus(provider) === 'clear' &&
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
  if (provider.blockedAt) {
    return 0;
  }
  if (['account-blocked', 'blocked', 'suspicious', 'shared'].includes(providerSecurityStatus(provider))) {
    return 0;
  }
  if (
    provider.verification?.status === 'APPROVED' &&
    provider.status === 'ONLINE_AVAILABLE' &&
    providerLocationStatus(provider) === 'recent' &&
    providerSecurityStatus(provider) === 'clear' &&
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

function providerSecurityStatus(provider: AdminProvider): ProviderSecurityState {
  if (provider.blockedAt) {
    return 'account-blocked';
  }
  if ((provider.devices ?? []).some((device) => Boolean(device.blockedAt))) {
    return 'blocked';
  }
  if ((provider.sessions ?? []).some((session) => session.suspicious)) {
    return 'suspicious';
  }
  if (sharedDeviceIds(provider).size > 0) {
    return 'shared';
  }
  if (!(provider.devices ?? []).length && !(provider.sessions ?? []).length) {
    return 'missing';
  }
  return 'clear';
}

function sharedDeviceIds(provider: AdminProvider) {
  return new Set((provider.sharedDeviceMatches ?? []).map((match) => match.deviceId).filter(Boolean));
}

function providerSecurityLabel(status: ProviderSecurityState) {
  if (status === 'account-blocked') return 'Account blocked';
  if (status === 'blocked') return 'Device blocked';
  if (status === 'suspicious') return 'Suspicious session';
  if (status === 'shared') return 'Shared device';
  if (status === 'missing') return 'No app device';
  return 'Security clear';
}

function providerSecurityPillClass(status: ProviderSecurityState) {
  if (status === 'clear') return 'pill-success';
  if (status === 'missing') return 'pill-neutral';
  return 'pill-danger';
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

function formatDate(value?: string | null) {
  if (!value) {
    return 'not recorded';
  }
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return 'invalid time';
  }
  return new Date(timestamp).toLocaleString();
}
