import Link from 'next/link';
import {
  AdminProvider,
  AdminOperationalPolicySetting,
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
  approvePublicProviderMedia,
  blockProviderAccount,
  enablePushDevice,
  rejectProvider,
  rejectProviderBankAccount,
  rejectProviderDocument,
  rejectProviderKyc,
  rejectProviderTaxProfile,
  rejectPublicProviderMedia,
  syncSupabaseProviderRole,
  unblockProviderAccount,
} from './actions';

type AdminPushDevice = NonNullable<NonNullable<AdminProvider['user']>['pushDevices']>[number];
type AdminProviderPublicMedia = NonNullable<NonNullable<AdminProvider['user']>['fileAssets']>[number];
type ProviderLocationState = 'recent' | 'stale' | 'expired' | 'missing';
type ProviderSecurityState = 'clear' | 'account-blocked' | 'blocked' | 'suspicious' | 'shared' | 'missing';
type ProviderCommandLane = {
  title: string;
  status: string;
  tone: 'ok' | 'info' | 'warn' | 'danger';
  detail: string;
  href: string;
  metrics: Array<{ label: string; value: string }>;
};
type PartnerDispatchForecast = {
  totals: Array<{
    label: string;
    value: string;
    detail: string;
    tone: ProviderCommandLane['tone'];
    href: string;
  }>;
  blockers: Array<{
    label: string;
    count: number;
    detail: string;
    href: string;
    tone: ProviderCommandLane['tone'];
  }>;
  supplyLanes: Array<{
    city: string;
    total: number;
    ready: number;
    online: number;
    locationNeedsRefresh: number;
    blocked: number;
  }>;
};
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
type ProviderOpsPolicy = {
  staleLocationMinutes: number;
  expiredLocationHours: number;
  backupRadiusMeters: number;
  responseWindowMinutes: number;
};

const MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES_KEY =
  'matching.backup_provider_location_max_age_minutes';
const MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY = 'matching.backup_provider_radius_meters';
const MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY = 'matching.provider_response_window_minutes';
const DEFAULT_PROVIDER_OPS_POLICY: ProviderOpsPolicy = {
  staleLocationMinutes: 30,
  expiredLocationHours: 24,
  backupRadiusMeters: 10000,
  responseWindowMinutes: 10,
};
const PROVIDER_LIST_RENDER_LIMIT = 40;

export default async function ProvidersPage({ searchParams }: { searchParams?: ProvidersPageSearchParams }) {
  const filters = buildProviderFilters(searchParams ? await searchParams : {});
  const [rawProviders, operationalPolicies] = await Promise.all([
    adminGet<AdminProvider[]>('/admin/providers', []),
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
  ]);
  const opsPolicy = buildProviderOpsPolicy(operationalPolicies);
  const allProviders = sortProviders(rawProviders, opsPolicy);
  const providers = filterProviders(allProviders, filters, opsPolicy);
  const visibleProviders = providers.slice(0, PROVIDER_LIST_RENDER_LIMIT);
  const hiddenProviderCount = Math.max(providers.length - visibleProviders.length, 0);
  const summary = buildProviderSummary(providers, opsPolicy);
  const commandCenter = buildProviderCommandCenter(providers, opsPolicy);
  const reviewQueue = buildProviderReviewQueue(providers, opsPolicy);
  const priorityLane = buildProviderPriorityLane(providers, opsPolicy);
  const dispatchForecast = buildPartnerDispatchForecast(providers, opsPolicy);
  const activeFilters = buildProviderActiveFilters(filters);

  return (
    <>
      <h1>Partner Verification</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <form className="form-grid" action="/partners">
          <label>
            Search
            <input name="q" defaultValue={filters.q} placeholder="Name, phone, city, partner id" />
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
            Partner status
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
              <option value="public-media">Public media review</option>
              <option value="bank">Bank payout review</option>
              <option value="payout-setup">First earning payout setup</option>
              <option value="cash-debt">Cash fee debt</option>
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
            <Link className="text-link" href="/partners">
              Clear filters
            </Link>
            <span className="muted">
              Showing {visibleProviders.length} of {providers.length} matching partners
              {providers.length !== allProviders.length ? ` (${allProviders.length} total)` : ''}
            </span>
            <Link className="text-link" href="/operations-policy">
              Location freshness: {opsPolicy.staleLocationMinutes}m
            </Link>
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
            <p className="muted full-span">
              No partner filter is active. Showing the first {PROVIDER_LIST_RENDER_LIMIT} rows from the
              operator queue for faster loading.
            </p>
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
            <h2>Partner command center</h2>
            <p className="muted">
              Operator overview across onboarding, dispatch readiness, payout/tax readiness, and trust risk.
            </p>
          </div>
          <span className="pill pill-info">Daily control view</span>
        </div>
        <div className="grid" style={{ marginTop: 12 }}>
          {commandCenter.map((lane) => (
            <Link className="card" href={lane.href} key={lane.title}>
              <p>{lane.title}</p>
              <h2>{lane.status}</h2>
              <span className={`signal ${providerCommandToneClass(lane.tone)}`}>
                {providerCommandToneLabel(lane.tone)}
              </span>
              <p className="muted" style={{ marginTop: 8 }}>
                {lane.detail}
              </p>
              <div className="participant-list" style={{ marginTop: 10 }}>
                {lane.metrics.map((item) => (
                  <span className="pill" key={item.label}>
                    {item.label}: {item.value}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Dispatch capacity forecast</h2>
            <p className="muted">
              Converts the filtered partner list into dispatch capacity, recovery work, and city-level supply
              signals for direct requests and 10km backup matching.
            </p>
          </div>
          <Link className="text-link" href="/operations-policy">
            Policy: fresh location {'<='} {opsPolicy.staleLocationMinutes}m
          </Link>
        </div>
        <div className="grid" style={{ marginTop: 12 }}>
          {dispatchForecast.totals.map((item) => (
            <Link className="card" href={item.href} key={item.label}>
              <p>{item.label}</p>
              <h2>{item.value}</h2>
              <span className={`signal ${providerCommandToneClass(item.tone)}`}>
                {providerCommandToneLabel(item.tone)}
              </span>
              <p className="muted" style={{ marginTop: 8 }}>
                {item.detail}
              </p>
            </Link>
          ))}
        </div>
        <div className="grid" style={{ marginTop: 12 }}>
          <div className="card">
            <h3>Dispatch blockers</h3>
            <div className="setup-stage-list" style={{ marginTop: 12 }}>
              {dispatchForecast.blockers.map((item) => (
                <div className="setup-stage-item" key={item.label}>
                  <span>{item.count ? 'FIX' : 'OK'}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <p className="muted">{item.detail}</p>
                  </div>
                  <Link className="text-link" href={item.href}>
                    {item.count}
                  </Link>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3>City supply lanes</h3>
            <p className="muted">
              Use this to decide where partner onboarding, location refresh, or push registration should be
              pushed first.
            </p>
            <div className="setup-stage-list" style={{ marginTop: 12 }}>
              {dispatchForecast.supplyLanes.map((lane) => (
                <div className="setup-stage-item" key={lane.city}>
                  <span>{lane.ready ? 'LIVE' : 'WATCH'}</span>
                  <div>
                    <strong>{lane.city}</strong>
                    <p className="muted">
                      {lane.ready}/{lane.total} ready, {lane.online} online, {lane.locationNeedsRefresh}{' '}
                      need location refresh, {lane.blocked} blocked.
                    </p>
                  </div>
                  <Link className="text-link" href={`/partners?q=${encodeURIComponent(lane.city)}`}>
                    Open
                  </Link>
                </div>
              ))}
              {dispatchForecast.supplyLanes.length === 0 ? (
                <div className="setup-stage-item">
                  <span>EMPTY</span>
                  <div>
                    <strong>No city signal yet</strong>
                    <p className="muted">Partner city data will appear here once profiles are filled.</p>
                  </div>
                  <small>0</small>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Review queue</h2>
            <p className="muted">
              Prioritized partner issues for KYC, documents, payout readiness, device alerts, and dispatch
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
            <h2>Partner priority lane</h2>
            <p className="muted">
              The next operators should open these partner profiles first. This is derived from profile, KYC,
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
                  <Link className="text-link" href={`/partners/${item.provider.id}`}>
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
                <strong>No partners need immediate attention</strong>
                <p className="muted">The current filtered list has no blocking partner operation items.</p>
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
              <th>Partner</th>
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
            {visibleProviders.map((provider) => (
              <tr id={`provider-${provider.id}`} key={provider.id}>
                <td>
                  <Link className="text-link" href={`/partners/${provider.id}`}>
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
                  <ProviderOnboardingCell provider={provider} />
                </td>
                <td>
                  <ProviderNextActionCell provider={provider} opsPolicy={opsPolicy} />
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
                  <ProviderIssuePills provider={provider} opsPolicy={opsPolicy} />
                  <p className="muted">{providerActionHint(provider, opsPolicy)}</p>
                  <PartnerBackupEligibilityCell provider={provider} opsPolicy={opsPolicy} />
                  {hasOpenProviderRisk(provider) ? (
                    <Link className="text-link" href={`/partner-risk?q=${encodeURIComponent(provider.id)}`}>
                      Open risk desk
                    </Link>
                  ) : null}
                </td>
                <td>
                  <ProviderLocationCell provider={provider} opsPolicy={opsPolicy} />
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
                  {provider.verification?.files?.length ? (
                    provider.verification.files.map((file) => (
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
                          {file.uploadedAt ? ` / uploaded ${new Date(file.uploadedAt).toLocaleString()}` : ''}
                        </p>
                        <p className="muted">
                          {file.key}
                          {' / '}
                          <Link className="text-link" href={`/partners/${provider.id}`}>
                            open detail to view
                          </Link>
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No private verification files.</p>
                  )}
                  <ProviderPublicMediaQueueCell provider={provider} />
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
                        placeholder="Partner rejection reason"
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
                    <Link className="text-link" href={`/partners/${provider.id}`}>
                      Open detail
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {hiddenProviderCount > 0 ? (
              <tr>
                <td colSpan={10}>
                  <p className="muted">
                    {hiddenProviderCount} more partner row(s) are hidden for page speed. Use filters or search
                    to narrow the queue.
                  </p>
                </td>
              </tr>
            ) : null}
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

function ProviderOnboardingCell({ provider }: { provider: AdminProvider }) {
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
                {document.fileAsset?.key ?? 'No file key'}
                {document.fileAsset?.id ? (
                  <>
                    {' / '}
                    <Link className="text-link" href={`/partners/${provider.id}`}>
                      open detail to view
                    </Link>
                  </>
                ) : null}
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
          No typed partner documents yet.
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

function ProviderPublicMediaQueueCell({ provider }: { provider: AdminProvider }) {
  const media = providerPublicMedia(provider);
  if (!media.length) {
    return (
      <p className="muted" style={{ marginTop: 8 }}>
        No public profile media uploaded.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      <p className="muted" style={{ marginBottom: 6 }}>
        Public media review
      </p>
      {media.slice(0, 4).map((file) => (
        <div key={file.id} className="provider-file-row">
          <div className="participant-list" style={{ marginBottom: 6 }}>
            <span className="pill pill-info">{file.purpose}</span>
            <span className={`pill ${publicMediaReviewPillClass(file.reviewStatus)}`}>
              {file.reviewStatus ?? 'PENDING_REVIEW'}
            </span>
          </div>
          <p className="muted" style={{ marginBottom: 6 }}>
            {file.contentType}
            {file.sizeBytes ? ` / ${formatBytes(file.sizeBytes)}` : ''}
            {file.uploadedAt ? ` / uploaded ${new Date(file.uploadedAt).toLocaleString()}` : ''}
          </p>
          <p className="muted" style={{ marginBottom: 6 }}>
            {file.url ? (
              <a href={file.url} target="_blank" rel="noreferrer">
                {file.key}
              </a>
            ) : (
              file.key
            )}
          </p>
          {file.reviewReason ? (
            <p className="muted" style={{ marginBottom: 6 }}>
              Reason: {file.reviewReason}
            </p>
          ) : null}
          <div className="actions">
            <form action={approvePublicProviderMedia}>
              <input type="hidden" name="providerId" value={provider.id} />
              <input type="hidden" name="fileId" value={file.id} />
              <button type="submit" disabled={file.reviewStatus === 'APPROVED'}>
                Approve media
              </button>
            </form>
            <form action={rejectPublicProviderMedia}>
              <input type="hidden" name="providerId" value={provider.id} />
              <input type="hidden" name="fileId" value={file.id} />
              <input
                name="reason"
                placeholder="Media rejection reason"
                required
                minLength={12}
                maxLength={500}
              />
              <button type="submit" disabled={file.reviewStatus === 'REJECTED'}>
                Reject media
              </button>
            </form>
          </div>
        </div>
      ))}
      {media.length > 4 ? (
        <Link className="text-link" href={`/partners/${provider.id}`}>
          Review {media.length - 4} more media item(s)
        </Link>
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

function providerPublicMedia(provider: AdminProvider): AdminProviderPublicMedia[] {
  return provider.user?.fileAssets ?? [];
}

function providerPublicMediaNeedsReview(provider: AdminProvider) {
  return providerPublicMedia(provider).some((file) =>
    ['PENDING_REVIEW', 'REJECTED'].includes(file.reviewStatus ?? 'PENDING_REVIEW'),
  );
}

function publicMediaReviewPillClass(status?: string) {
  if (status === 'APPROVED') return 'pill-success';
  if (status === 'REJECTED') return 'pill-danger';
  return 'pill-warn';
}

type ProviderListAction = {
  status: string;
  detail: string;
  operatorAction: string;
  tone: 'done' | 'pending' | 'blocked';
  priority: number;
};

function ProviderNextActionCell({
  provider,
  opsPolicy,
}: {
  provider: AdminProvider;
  opsPolicy: ProviderOpsPolicy;
}) {
  const action = nextProviderListAction(provider, opsPolicy);
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

function ProviderIssuePills({
  provider,
  opsPolicy,
}: {
  provider: AdminProvider;
  opsPolicy: ProviderOpsPolicy;
}) {
  const issues = providerReviewIssues(provider, opsPolicy);
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

function PartnerBackupEligibilityCell({
  provider,
  opsPolicy,
}: {
  provider: AdminProvider;
  opsPolicy: ProviderOpsPolicy;
}) {
  const eligibility = partnerBackupMatchingEligibility(provider, opsPolicy);

  return (
    <div className="card" style={{ marginTop: 10, padding: 12 }}>
      <div className="risk-watch-header">
        <div>
          <strong>Backup matching eligibility</strong>
          <p className="muted">
            {eligibility.detail}
          </p>
        </div>
        <span className={`pill ${eligibility.eligible ? 'pill-success' : 'pill-warn'}`}>
          {eligibility.eligible ? 'Candidate ready' : 'Excluded'}
        </span>
      </div>
      <div className="participant-list" style={{ marginTop: 8 }}>
        <span className="pill pill-info">
          Radius: {formatDistanceMeters(opsPolicy.backupRadiusMeters)}
        </span>
        <span className="pill pill-info">First window: {opsPolicy.responseWindowMinutes}m</span>
        <span className="pill pill-info">Location: {opsPolicy.staleLocationMinutes}m fresh</span>
      </div>
      {eligibility.blockers.length ? (
        <div className="participant-list" style={{ marginTop: 8 }}>
          {eligibility.blockers.map((blocker) => (
            <span className={`pill ${blocker.severity === 'hard' ? 'pill-danger' : 'pill-warn'}`} key={blocker.label}>
              {blocker.label}
            </span>
          ))}
        </div>
      ) : null}
      <p className="muted" style={{ marginTop: 8 }}>
        {eligibility.operatorAction}
      </p>
    </div>
  );
}

function buildProviderPriorityLane(providers: AdminProvider[], opsPolicy: ProviderOpsPolicy) {
  const ranked = providers
    .map((provider) => ({ provider, action: nextProviderListAction(provider, opsPolicy) }))
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

function nextProviderListAction(provider: AdminProvider, opsPolicy = DEFAULT_PROVIDER_OPS_POLICY): ProviderListAction {
  const missingDocuments = missingApprovedRequiredKycDocuments(provider);
  const primaryBank = provider.bankAccounts?.[0];
  const firstRevenueSignal = providerHasFirstRevenueSignal(provider);
  const agreementsAccepted = provider.agreements?.length ?? 0;
  const locationState = providerLocationStatus(provider, opsPolicy);
  const securityState = providerSecurityStatus(provider);
  const walletBalance = providerUnsettledWalletBalance(provider);

  if (provider.blockedAt) {
    return {
      status: 'ACCOUNT',
      detail: `Partner account is blocked${provider.blockedReason ? `: ${provider.blockedReason}` : '.'}`,
      operatorAction: 'Unblock only after identity, safety, payout, or policy issue is resolved.',
      tone: 'blocked',
      priority: 120,
    };
  }
  if (!provider.displayName?.trim() || !provider.legalName?.trim()) {
    return {
      status: 'PROFILE',
      detail: 'Basic profile is incomplete.',
      operatorAction: 'Ask partner to complete display name and legal name before approval.',
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
      detail: `Partner verification is ${provider.verification?.status ?? 'DRAFT'}.`,
      operatorAction: 'Approve partner verification when identity review is complete.',
      tone: 'blocked',
      priority: 86,
    };
  }
  if (walletBalance < 0) {
    return {
      status: 'CASH DEBT',
      detail: `Wallet is negative by ${formatProviderMoney(Math.abs(walletBalance))}.`,
      operatorAction: 'Confirm partner fee deposit or settle the cash fee debt from Earnings.',
      tone: 'blocked',
      priority: 85,
    };
  }
  if (providerPublicMediaNeedsReview(provider)) {
    return {
      status: 'MEDIA',
      detail: 'Public profile or gallery media is waiting for admin review.',
      operatorAction: 'Approve safe, original public media or reject unclear uploads with a reason.',
      tone: 'pending',
      priority: 84,
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
  if (firstRevenueSignal && provider.taxProfile?.status !== 'APPROVED') {
    return {
      status: 'TAX',
      detail: `Partner has first earning, but tax profile is ${provider.taxProfile?.status ?? 'missing'}.`,
      operatorAction: 'Approve/reject freelance tax profile before the partner can withdraw earnings.',
      tone: 'blocked',
      priority: provider.taxProfile?.status === 'REJECTED' ? 76 : 74,
    };
  }
  if (firstRevenueSignal && !provider.residentialAddress?.trim()) {
    return {
      status: 'TAX ADDRESS',
      detail: 'Partner has first earning, but residential/tax address is missing.',
      operatorAction: 'Ask partner to add the address needed for tax and payout records.',
      tone: 'blocked',
      priority: 72,
    };
  }
  if (firstRevenueSignal && agreementsAccepted < 5) {
    return {
      status: 'TERMS',
      detail: `Payout agreements are ${agreementsAccepted}/5.`,
      operatorAction: 'Ask partner to accept missing payout/tax/location agreements.',
      tone: 'blocked',
      priority: 70,
    };
  }
  if (securityState === 'account-blocked') {
    return {
      status: 'ACCOUNT',
      detail: 'The partner account is blocked by admin policy.',
      operatorAction: 'Open partner detail and unblock only after the recorded issue is resolved.',
      tone: 'blocked',
      priority: 69,
    };
  }
  if (securityState === 'blocked') {
    return {
      status: 'DEVICE',
      detail: 'At least one partner app device is blocked.',
      operatorAction: 'Open partner detail and decide whether to unblock or keep the device blocked.',
      tone: 'blocked',
      priority: 68,
    };
  }
  if (securityState === 'suspicious' || securityState === 'shared') {
    return {
      status: 'SECURITY',
      detail:
        securityState === 'shared'
          ? 'A device appears on more than one partner profile.'
          : 'Recent partner session has a suspicious risk flag.',
      operatorAction: 'Review device/session history before relying on this partner for dispatch.',
      tone: 'blocked',
      priority: 67,
    };
  }
  if (locationState !== 'recent') {
    return {
      status: 'LOCATION',
      detail: providerLocationAgeLabel(provider.currentLocationUpdatedAt),
      operatorAction: 'Ask partner to open the app and refresh current location.',
      tone: locationState === 'missing' ? 'blocked' : 'pending',
      priority: locationState === 'missing' ? 66 : 58,
    };
  }
  if (!hasHealthyPush(provider)) {
    return {
      status: 'PUSH',
      detail: 'No enabled push device is available for request alerts.',
      operatorAction: 'Ask partner to reopen the app and register alerts.',
      tone: 'pending',
      priority: 54,
    };
  }
  if (!provider.user?.supabaseUserId) {
    return {
      status: 'SUPABASE',
      detail: 'Partner is still on Nest auth only.',
      operatorAction: 'Sync/link Supabase role after Supabase OTP login is active.',
      tone: 'pending',
      priority: 35,
    };
  }
  return {
    status: 'CLEAR',
    detail: 'No partner operation blocker is visible.',
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

function ProviderLocationCell({
  provider,
  opsPolicy,
}: {
  provider: AdminProvider;
  opsPolicy: ProviderOpsPolicy;
}) {
  const status = providerLocationStatus(provider, opsPolicy);
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
          : 'No partner app device recorded yet.'}
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
      <Link className="text-link" href={`/partners/${provider.id}`}>
        Review security
      </Link>
    </div>
  );
}

function providerUnsettledWalletBalance(provider: AdminProvider) {
  return (provider.earnings ?? [])
    .filter((earning) => ['PENDING', 'AVAILABLE'].includes(earning.status) && !earning.payoutBatchId)
    .reduce((sum, earning) => sum + numberValue(earning.netAmount), 0);
}

function providerHasFirstRevenueSignal(provider: AdminProvider) {
  return (provider.earnings ?? []).some((earning) =>
    ['PENDING', 'AVAILABLE', 'PAID'].includes(earning.status),
  );
}

function providerPayoutSetupNeedsReview(provider: AdminProvider) {
  if (!providerHasFirstRevenueSignal(provider)) {
    return false;
  }

  return (
    provider.taxProfile?.status !== 'APPROVED' ||
    !provider.residentialAddress?.trim() ||
    (provider.agreements?.length ?? 0) < 5
  );
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  return 0;
}

function formatProviderMoney(value: number, currency = 'VND') {
  return `${new Intl.NumberFormat('vi-VN').format(value)} ${currency}`;
}

function providerActionHint(provider: AdminProvider, opsPolicy = DEFAULT_PROVIDER_OPS_POLICY) {
  if (provider.blockedAt) {
    return 'This partner account is blocked and cannot go online, update location, or appear to customers.';
  }
  if (provider.verification?.status !== 'APPROVED') {
    return 'Review verification before this partner can safely take customer requests.';
  }
  if (providerPublicMediaNeedsReview(provider)) {
    return 'Approve public profile media before customers can see the latest uploaded images.';
  }
  const walletBalance = providerUnsettledWalletBalance(provider);
  if (walletBalance < 0) {
    return `Partner wallet is negative by ${formatProviderMoney(
      Math.abs(walletBalance),
    )}. New booking acceptance stays blocked until finance settles the cash fee debt.`;
  }
  if (provider.status !== 'ONLINE_AVAILABLE') {
    return 'Partner is approved but not currently online for direct or backup requests.';
  }
  const locationState = providerLocationStatus(provider, opsPolicy);
  if (locationState === 'missing') {
    return 'Partner is online, but no location has been saved yet. Ask them to reopen the Partner app.';
  }
  if (locationState === 'expired') {
    return 'Partner has an old saved location. They should go online again before dispatch.';
  }
  if (locationState === 'stale') {
    return `Partner is live, but the last location is older than ${opsPolicy.staleLocationMinutes} minutes. Confirm before dispatch.`;
  }
  if (!hasHealthyPush(provider)) {
    return 'Partner is live, but push registration should be checked before relying on alerts.';
  }
  const securityState = providerSecurityStatus(provider);
  if (securityState !== 'clear') {
    return 'Partner has a device/session security item. Review it before dispatching high-risk bookings.';
  }
  if (!provider.user?.supabaseUserId) {
    return 'Partner is operational in Nest auth. Supabase role sync will become available after Supabase OTP login links this phone.';
  }
  return 'Partner is ready for direct requests and fallback matching.';
}

function partnerBackupMatchingEligibility(provider: AdminProvider, opsPolicy = DEFAULT_PROVIDER_OPS_POLICY) {
  const blockers: Array<{ label: string; severity: 'hard' | 'soft' }> = [];
  const locationState = providerLocationStatus(provider, opsPolicy);
  const securityState = providerSecurityStatus(provider);
  const walletBalance = providerUnsettledWalletBalance(provider);

  if (provider.blockedAt) {
    blockers.push({ label: 'account blocked', severity: 'hard' });
  }
  if (provider.verification?.status !== 'APPROVED') {
    blockers.push({ label: `verification ${provider.verification?.status ?? 'DRAFT'}`, severity: 'hard' });
  }
  if (walletBalance < 0) {
    blockers.push({ label: 'wallet debt', severity: 'hard' });
  }
  if (provider.status !== 'ONLINE_AVAILABLE') {
    blockers.push({ label: 'not online available', severity: 'soft' });
  }
  if (locationState !== 'recent') {
    blockers.push({ label: `location ${locationState}`, severity: locationState === 'missing' ? 'hard' : 'soft' });
  }
  if (!hasHealthyPush(provider)) {
    blockers.push({ label: 'push missing', severity: 'soft' });
  }
  if (!['clear', 'missing'].includes(securityState)) {
    blockers.push({ label: providerSecurityLabel(securityState).toLowerCase(), severity: 'hard' });
  }

  const eligible = blockers.length === 0;

  return {
    eligible,
    blockers,
    detail: eligible
      ? `Can receive backup alerts and join eligible bookings within ${formatDistanceMeters(
          opsPolicy.backupRadiusMeters,
        )} during the ${opsPolicy.responseWindowMinutes}m first-pick window.`
      : `Not ready for backup matching until blockers are resolved. Distance is still checked per booking within ${formatDistanceMeters(
          opsPolicy.backupRadiusMeters,
        )}.`,
    operatorAction: eligible
      ? 'For a live booking, confirm the booking address is inside radius before asking this partner to join.'
      : 'Fix the listed blockers before relying on this partner for backup participation or customer shortlist recovery.',
  };
}

function hasApprovedRequiredKycDocuments(provider: AdminProvider) {
  return missingApprovedRequiredKycDocuments(provider).length === 0;
}

function buildProviderCommandCenter(
  providers: AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
): ProviderCommandLane[] {
  const verificationReview = providers.filter(
    (provider) => provider.verification?.status !== 'APPROVED',
  ).length;
  const kycReview = providers.filter((provider) =>
    ['PENDING', 'REJECTED', 'MISSING'].includes(provider.kyc?.status ?? 'MISSING'),
  ).length;
  const documentsReview = providers.filter((provider) =>
    (provider.documents ?? []).some((document) => ['PENDING_REVIEW', 'REJECTED'].includes(document.status)),
  ).length;
  const publicMediaReview = providers.filter(providerPublicMediaNeedsReview).length;
  const readyNow = providers.filter((provider) => providerDispatchReady(provider, opsPolicy)).length;
  const online = providers.filter((provider) => provider.status === 'ONLINE_AVAILABLE').length;
  const locationFresh = providers.filter(
    (provider) => providerLocationStatus(provider, opsPolicy) === 'recent',
  ).length;
  const pushReady = providers.filter((provider) => hasHealthyPush(provider)).length;
  const bankReview = providers.filter((provider) =>
    (provider.bankAccounts ?? []).some((account) => ['PENDING_REVIEW', 'REJECTED'].includes(account.status)),
  ).length;
  const payoutSetupReview = providers.filter(providerPayoutSetupNeedsReview).length;
  const taxReview = providers.filter(providerTaxNeedsReview).length;
  const walletDebt = providers.filter((provider) => providerUnsettledWalletBalance(provider) < 0).length;
  const accountBlocks = providers.filter((provider) => Boolean(provider.blockedAt)).length;
  const openRisk = providers.filter((provider) => hasOpenProviderRisk(provider)).length;
  const deviceRisk = providers.filter((provider) =>
    ['account-blocked', 'blocked', 'suspicious', 'shared'].includes(providerSecurityStatus(provider)),
  ).length;
  const supabasePending = providers.filter((provider) => !provider.user?.supabaseUserId).length;

  return [
    {
      title: 'Onboarding pipeline',
      status: verificationReview + kycReview + documentsReview > 0 ? 'Review needed' : 'Clean',
      tone: verificationReview > 0 || kycReview > 0 ? 'warn' : documentsReview > 0 ? 'info' : 'ok',
      detail:
        verificationReview + kycReview + documentsReview > 0
          ? 'Partners are waiting for identity, verification, or document decisions.'
          : 'No filtered partner is blocked by onboarding review.',
      href: verificationReview > 0 ? '/partners?review=kyc' : '/partners?review=documents',
      metrics: [
        providerCommandMetric('verification', verificationReview),
        providerCommandMetric('KYC', kycReview),
        providerCommandMetric('documents', documentsReview),
        providerCommandMetric('media', publicMediaReview),
      ],
    },
    {
      title: 'Dispatch readiness',
      status: `${readyNow}/${providers.length} ready`,
      tone: readyNow === providers.length ? 'ok' : readyNow > 0 ? 'info' : 'warn',
      detail:
        readyNow > 0
          ? 'Some partners can receive requests now; keep location and push freshness high.'
          : 'No partner in this filtered list is fully ready for dispatch.',
      href: readyNow > 0 ? '/partners?readiness=ready' : '/partners?review=location',
      metrics: [
        providerCommandMetric('online', online),
        providerCommandMetric(`fresh <=${opsPolicy.staleLocationMinutes}m`, locationFresh),
        providerCommandMetric('push ready', pushReady),
        providerCommandMetric('Supabase pending', supabasePending),
      ],
    },
    {
      title: 'Payout and tax',
      status: walletDebt > 0 || payoutSetupReview > 0 ? 'Finance action' : 'Stable',
      tone: walletDebt > 0 ? 'danger' : payoutSetupReview > 0 || taxReview > 0 ? 'warn' : 'ok',
      detail:
        walletDebt > 0
          ? 'Cash fee debt can block partners from accepting new bookings.'
          : 'First-earning payout, bank, and freelance tax readiness are under control.',
      href: walletDebt > 0 ? '/partners?review=cash-debt' : '/partners?review=payout-setup',
      metrics: [
        providerCommandMetric('bank', bankReview),
        providerCommandMetric('tax', taxReview),
        providerCommandMetric('first earning', payoutSetupReview),
        providerCommandMetric('wallet debt', walletDebt),
      ],
    },
    {
      title: 'Trust and safety',
      status: accountBlocks > 0 || openRisk > 0 || deviceRisk > 0 ? 'Investigate' : 'Clear',
      tone: accountBlocks > 0 || openRisk > 0 ? 'danger' : deviceRisk > 0 ? 'warn' : 'ok',
      detail:
        accountBlocks > 0 || openRisk > 0
          ? 'Account blocks, reports, or active sanctions need operator attention.'
          : 'No filtered partner has a major trust or device risk signal.',
      href: openRisk > 0 ? '/partner-risk' : '/partners?review=security',
      metrics: [
        providerCommandMetric('blocked', accountBlocks),
        providerCommandMetric('open risk', openRisk),
        providerCommandMetric('device risk', deviceRisk),
        providerCommandMetric(
          'shared device',
          providers.filter((provider) => providerSecurityStatus(provider) === 'shared').length,
        ),
      ],
    },
  ];
}

function providerDispatchReady(provider: AdminProvider, opsPolicy = DEFAULT_PROVIDER_OPS_POLICY) {
  return (
    provider.verification?.status === 'APPROVED' &&
    !provider.blockedAt &&
    provider.status === 'ONLINE_AVAILABLE' &&
    providerLocationStatus(provider, opsPolicy) === 'recent' &&
    providerSecurityStatus(provider) === 'clear' &&
    hasHealthyPush(provider)
  );
}

function providerCommandMetric(label: string, value: number) {
  return { label, value: value.toString() };
}

function providerCommandToneClass(tone: ProviderCommandLane['tone']) {
  if (tone === 'danger' || tone === 'warn') {
    return 'signal-warn';
  }
  if (tone === 'info') {
    return 'signal-info';
  }
  return 'signal-ok';
}

function providerCommandToneLabel(tone: ProviderCommandLane['tone']) {
  if (tone === 'danger') {
    return 'Critical';
  }
  if (tone === 'warn') {
    return 'Watch';
  }
  if (tone === 'info') {
    return 'Info';
  }
  return 'Clear';
}

function buildPartnerDispatchForecast(
  providers: AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
): PartnerDispatchForecast {
  const readyNow = providers.filter((provider) => providerDispatchReady(provider, opsPolicy)).length;
  const online = providers.filter((provider) => provider.status === 'ONLINE_AVAILABLE').length;
  const approved = providers.filter((provider) => provider.verification?.status === 'APPROVED').length;
  const locationNeedsRefresh = providers.filter((provider) =>
    ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider, opsPolicy)),
  ).length;
  const pushMissing = providers.filter((provider) => !hasHealthyPush(provider)).length;
  const walletDebt = providers.filter((provider) => providerUnsettledWalletBalance(provider) < 0).length;
  const securityRisk = providers.filter((provider) =>
    ['account-blocked', 'blocked', 'suspicious', 'shared'].includes(providerSecurityStatus(provider)),
  ).length;
  const onboardingBlocked = providers.filter((provider) => provider.verification?.status !== 'APPROVED').length;
  const payoutLocked = providers.filter(providerPayoutSetupNeedsReview).length;
  const approvedOffline = providers.filter(
    (provider) => provider.verification?.status === 'APPROVED' && provider.status !== 'ONLINE_AVAILABLE',
  ).length;
  const recoverableNow = providers.filter((provider) => {
    if (providerDispatchReady(provider, opsPolicy)) return false;
    if (provider.verification?.status !== 'APPROVED') return false;
    if (provider.blockedAt) return false;
    if (providerUnsettledWalletBalance(provider) < 0) return false;
    if (!['clear', 'missing'].includes(providerSecurityStatus(provider))) return false;
    return (
      provider.status !== 'ONLINE_AVAILABLE' ||
      providerLocationStatus(provider, opsPolicy) !== 'recent' ||
      !hasHealthyPush(provider)
    );
  }).length;

  return {
    totals: [
      {
        label: 'Ready now',
        value: `${readyNow}/${providers.length}`,
        detail: 'Approved, online, fresh location, clean device risk, and push-ready partners.',
        tone: readyNow > 0 ? 'ok' : 'warn',
        href: '/partners?readiness=ready',
      },
      {
        label: 'Recoverable today',
        value: recoverableNow.toString(),
        detail: 'Approved partners likely recoverable by going online, refreshing location, or enabling push.',
        tone: recoverableNow > 0 ? 'info' : 'ok',
        href: recoverableNow > 0 ? '/partners?readiness=approved-offline' : '/partners',
      },
      {
        label: 'Online capacity',
        value: `${online}/${approved}`,
        detail: 'Approved partner pool currently online versus total approved partners in this filtered view.',
        tone: online > 0 ? 'info' : approved > 0 ? 'warn' : 'danger',
        href: '/partners?providerStatus=ONLINE_AVAILABLE',
      },
      {
        label: 'Hard blockers',
        value: (walletDebt + securityRisk + onboardingBlocked).toString(),
        detail: 'Identity, account, cash debt, or security blockers that should not be bypassed by dispatch.',
        tone: walletDebt + securityRisk + onboardingBlocked > 0 ? 'danger' : 'ok',
        href: walletDebt > 0 ? '/partners?review=cash-debt' : '/partners?review=security',
      },
    ],
    blockers: [
      {
        label: 'Location refresh',
        count: locationNeedsRefresh,
        detail: `Partner location is missing, expired, or older than ${opsPolicy.staleLocationMinutes} minutes.`,
        href: '/partners?review=location',
        tone: locationNeedsRefresh > 0 ? 'warn' : 'ok',
      },
      {
        label: 'Push alerts missing',
        count: pushMissing,
        detail: 'Direct booking and backup matching alerts may not reach these partners.',
        href: '/partners?review=push',
        tone: pushMissing > 0 ? 'warn' : 'ok',
      },
      {
        label: 'Approved but offline',
        count: approvedOffline,
        detail: 'Approved partners who can become useful supply once they open the Partner app.',
        href: '/partners?readiness=approved-offline',
        tone: approvedOffline > 0 ? 'info' : 'ok',
      },
      {
        label: 'Wallet debt',
        count: walletDebt,
        detail: 'Cash fee debt blocks accepting bookings until settlement is confirmed.',
        href: '/partners?review=cash-debt',
        tone: walletDebt > 0 ? 'danger' : 'ok',
      },
      {
        label: 'Payout/tax lock',
        count: payoutLocked,
        detail: 'First-earning partners who still need tax, bank, address, or agreement completion.',
        href: '/partners?review=payout-setup',
        tone: payoutLocked > 0 ? 'warn' : 'ok',
      },
      {
        label: 'Security review',
        count: securityRisk,
        detail: 'Blocked, shared, suspicious, or account-blocked partner devices/sessions.',
        href: '/partners?review=security',
        tone: securityRisk > 0 ? 'danger' : 'ok',
      },
    ],
    supplyLanes: buildPartnerSupplyLanes(providers, opsPolicy),
  };
}

function buildPartnerSupplyLanes(providers: AdminProvider[], opsPolicy: ProviderOpsPolicy) {
  const lanes = new Map<
    string,
    PartnerDispatchForecast['supplyLanes'][number]
  >();

  for (const provider of providers) {
    const city = provider.city?.trim() || 'Unknown city';
    const lane =
      lanes.get(city) ??
      {
        city,
        total: 0,
        ready: 0,
        online: 0,
        locationNeedsRefresh: 0,
        blocked: 0,
      };

    lane.total += 1;
    if (providerDispatchReady(provider, opsPolicy)) {
      lane.ready += 1;
    }
    if (provider.status === 'ONLINE_AVAILABLE') {
      lane.online += 1;
    }
    if (providerLocationStatus(provider, opsPolicy) !== 'recent') {
      lane.locationNeedsRefresh += 1;
    }
    if (
      provider.blockedAt ||
      provider.verification?.status !== 'APPROVED' ||
      providerUnsettledWalletBalance(provider) < 0 ||
      ['account-blocked', 'blocked', 'suspicious', 'shared'].includes(providerSecurityStatus(provider))
    ) {
      lane.blocked += 1;
    }
    lanes.set(city, lane);
  }

  return Array.from(lanes.values())
    .sort((left, right) => {
      if (left.ready !== right.ready) return right.ready - left.ready;
      if (left.online !== right.online) return right.online - left.online;
      if (left.total !== right.total) return right.total - left.total;
      return left.city.localeCompare(right.city);
    })
    .slice(0, 6);
}

function buildProviderSummary(providers: AdminProvider[], opsPolicy: ProviderOpsPolicy) {
  const accountBlocked = providers.filter((provider) => Boolean(provider.blockedAt)).length;
  const approved = providers.filter((provider) => provider.verification?.status === 'APPROVED').length;
  const online = providers.filter((provider) => provider.status === 'ONLINE_AVAILABLE').length;
  const recentLocation = providers.filter(
    (provider) => providerLocationStatus(provider, opsPolicy) === 'recent',
  ).length;
  const staleLocation = providers.filter((provider) =>
    ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider, opsPolicy)),
  ).length;
  const pushReady = providers.filter((provider) => hasHealthyPush(provider)).length;
  const pushDisabled = providers.filter((provider) =>
    (provider.user?.pushDevices ?? []).some((device) => !device.enabled),
  ).length;
  const publicMediaReview = providers.filter(providerPublicMediaNeedsReview).length;
  const payoutSetupReview = providers.filter(providerPayoutSetupNeedsReview).length;
  const walletDebt = providers.filter((provider) => providerUnsettledWalletBalance(provider) < 0).length;
  const openRisk = providers.filter((provider) => hasOpenProviderRisk(provider)).length;
  const deviceRisk = providers.filter((provider) =>
    ['account-blocked', 'blocked', 'suspicious', 'shared'].includes(providerSecurityStatus(provider)),
  ).length;
  const readyNow = providers.filter(
    (provider) =>
      provider.verification?.status === 'APPROVED' &&
      !provider.blockedAt &&
      provider.status === 'ONLINE_AVAILABLE' &&
      providerLocationStatus(provider, opsPolicy) === 'recent' &&
      providerSecurityStatus(provider) === 'clear' &&
      hasHealthyPush(provider),
  ).length;

  return [
    ['Total partners', providers.length.toString()],
    ['Account blocked', accountBlocked.toString()],
    ['Approved', approved.toString()],
    ['Online now', online.toString()],
    [`Recent location <=${opsPolicy.staleLocationMinutes}m`, recentLocation.toString()],
    ['Location needs review', staleLocation.toString()],
    ['Push ready', pushReady.toString()],
    ['Push needs review', pushDisabled.toString()],
    ['Public media review', publicMediaReview.toString()],
    ['First earning setup', payoutSetupReview.toString()],
    ['Wallet debt', walletDebt.toString()],
    ['Open risk', openRisk.toString()],
    ['Device risk', deviceRisk.toString()],
    ['Ready for dispatch', readyNow.toString()],
  ] as const;
}

function buildProviderReviewQueue(providers: AdminProvider[], opsPolicy: ProviderOpsPolicy) {
  const accountBlocks = providers.filter((provider) => Boolean(provider.blockedAt)).length;
  const kycNeedsReview = providers.filter((provider) =>
    ['PENDING', 'REJECTED'].includes(provider.kyc?.status ?? 'MISSING'),
  ).length;
  const documentNeedsReview = providers.filter((provider) =>
    (provider.documents ?? []).some((document) => ['PENDING_REVIEW', 'REJECTED'].includes(document.status)),
  ).length;
  const publicMediaNeedsReview = providers.filter(providerPublicMediaNeedsReview).length;
  const bankNeedsReview = providers.filter((provider) =>
    (provider.bankAccounts ?? []).some((account) => ['PENDING_REVIEW', 'REJECTED'].includes(account.status)),
  ).length;
  const payoutSetupNeedsReview = providers.filter(providerPayoutSetupNeedsReview).length;
  const cashDebtNeedsReview = providers.filter((provider) => providerUnsettledWalletBalance(provider) < 0).length;
  const taxNeedsReview = providers.filter(providerTaxNeedsReview).length;
  const locationNeedsReview = providers.filter((provider) =>
    ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider, opsPolicy)),
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
      providerLocationStatus(provider, opsPolicy) === 'recent' &&
      providerSecurityStatus(provider) === 'clear' &&
      hasHealthyPush(provider),
  ).length;

  const items = [
    {
      label: 'Account blocks',
      count: accountBlocks,
      href: '/partners?review=blocked',
      detail:
        'Partners blocked by admin cannot go online, refresh location, or appear in customer discovery.',
    },
    {
      label: 'KYC updates',
      count: kycNeedsReview,
      href: '/partners?review=kyc',
      detail: 'Partners with pending or rejected identity verification need admin review or resubmission.',
    },
    {
      label: 'Document review',
      count: documentNeedsReview,
      href: '/partners?review=documents',
      detail: 'Typed CCCD, selfie, or portfolio documents are waiting for approval or rejection handling.',
    },
    {
      label: 'Public media review',
      count: publicMediaNeedsReview,
      href: '/partners?review=public-media',
      detail: 'Uploaded public profile and gallery images must be approved before customers can see them.',
    },
    {
      label: 'Bank payout review',
      count: bankNeedsReview,
      href: '/partners?review=bank',
      detail: 'Bank accounts must be approved before partners can move toward payout readiness.',
    },
    {
      label: 'First earning payout setup',
      count: payoutSetupNeedsReview,
      href: '/partners?review=payout-setup',
      detail:
        'Partners with first revenue who still need tax profile, tax address, or payout agreements before withdrawal.',
    },
    {
      label: 'Cash fee debt',
      count: cashDebtNeedsReview,
      href: '/partners?review=cash-debt',
      detail:
        'Partners with negative wallet balance cannot accept bookings until HANDS fee settlement is confirmed.',
    },
    {
      label: 'Tax profile review',
      count: taxNeedsReview,
      href: '/partners?review=tax',
      detail: 'Freelance tax profiles should be approved only after MST and registered address are checked.',
    },
    {
      label: 'Device/session risk',
      count: securityNeedsReview,
      href: '/partners?review=security',
      detail: 'Blocked, shared, or suspicious partner app devices need operator review.',
    },
    {
      label: 'Reports and sanctions',
      count: riskNeedsReview,
      href: '/partners?review=risk',
      detail: 'Open reports or active sanctions should be reviewed before dispatch and trust badge changes.',
    },
    {
      label: 'Location freshness',
      count: locationNeedsReview,
      href: '/partners?review=location',
      detail:
        `Partners with missing, expired, or older-than-${opsPolicy.staleLocationMinutes}m locations should reopen the Partner app before dispatch.`,
    },
    {
      label: 'Push alert readiness',
      count: pushNeedsReview,
      href: '/partners?review=push',
      detail: 'Partners without enabled push devices may miss direct requests and backup matching alerts.',
    },
    {
      label: 'Ready for dispatch',
      count: readyForDispatch,
      href: '/partners?readiness=ready',
      detail: 'Approved, online partners with recent location and push registration.',
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

  return providerHasFirstRevenueSignal(provider) && taxStatus !== 'APPROVED';
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

function providerReviewIssues(provider: AdminProvider, opsPolicy = DEFAULT_PROVIDER_OPS_POLICY) {
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
  if (providerPublicMedia(provider).some((file) => file.reviewStatus === 'REJECTED')) {
    issues.push({ label: 'media rejected', severity: 'medium' });
  } else if (providerPublicMediaNeedsReview(provider)) {
    issues.push({ label: 'media pending', severity: 'medium' });
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
  if (providerHasFirstRevenueSignal(provider) && !provider.residentialAddress?.trim()) {
    issues.push({ label: 'tax address missing', severity: 'high' });
  }
  if (providerHasFirstRevenueSignal(provider) && (provider.agreements?.length ?? 0) < 5) {
    issues.push({ label: `terms ${(provider.agreements?.length ?? 0).toString()}/5`, severity: 'high' });
  }
  const walletBalance = providerUnsettledWalletBalance(provider);
  if (walletBalance < 0) {
    issues.push({ label: `cash debt ${formatProviderMoney(Math.abs(walletBalance))}`, severity: 'high' });
  }
  const locationState = providerLocationStatus(provider, opsPolicy);
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

function sortProviders(providers: AdminProvider[], opsPolicy = DEFAULT_PROVIDER_OPS_POLICY) {
  return [...providers].sort((left, right) => {
    const leftScore = providerPriority(left, opsPolicy);
    const rightScore = providerPriority(right, opsPolicy);
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
          description: 'Partner list is narrowed by name, phone, location, service, or risk text.',
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
    return 'Approved partners can progress toward dispatch if other readiness checks pass.';
  }
  if (kind === 'verification' && value === 'BLOCKED') {
    return 'Blocked partner accounts cannot receive customer requests.';
  }
  if (kind === 'providerStatus') {
    return 'Partner availability is narrowed to the selected online/offline state.';
  }
  if (kind === 'kyc') {
    return 'KYC review is narrowed to the selected identity state.';
  }
  if (kind === 'location') {
    return 'Location freshness is narrowed so dispatch can check stale or missing partner pins.';
  }
  if (kind === 'security') {
    return 'Security review is narrowed to device, session, or account risk state.';
  }
  if (kind === 'readiness') {
    return 'Readiness shows whether a partner can safely appear in customer discovery and dispatch.';
  }
  if (kind === 'review' && value === 'push') {
    return 'Push readiness highlights partners whose devices cannot reliably receive booking alerts.';
  }
  if (kind === 'review' && value === 'risk') {
    return 'Risk review highlights partners with open reports or active sanctions.';
  }
  if (kind === 'review' && value === 'public-media') {
    return 'Public media review highlights uploaded partner photos that are pending or rejected.';
  }
  if (kind === 'review' && value === 'payout-setup') {
    return 'First earning payout setup highlights partners who have earned revenue but still need tax profile, address, or agreements before withdrawal.';
  }
  if (kind === 'review' && value === 'cash-debt') {
    return 'Cash fee debt highlights partners blocked from accepting bookings because HANDS commission was not settled.';
  }
  if (kind === 'review') {
    return 'Review queue focuses the table on one operational approval lane.';
  }
  return 'Partner list is narrowed by the active filter.';
}

function emptyProviderMessage(activeFilters: Array<{ description: string }>) {
  if (activeFilters.length === 0) {
    return 'No partners loaded. Start the API and seed data to populate this table.';
  }
  return 'No partners match the active filters. Clear filters or switch to another review lane.';
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '').trim() : (value ?? '').trim();
}

function filterProviders(
  providers: AdminProvider[],
  filters: ProviderFilters,
  opsPolicy = DEFAULT_PROVIDER_OPS_POLICY,
) {
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
    if (filters.location && providerLocationStatus(provider, opsPolicy) !== filters.location) {
      return false;
    }
    if (filters.security && providerSecurityStatus(provider) !== filters.security) {
      return false;
    }
    if (filters.readiness && providerReadiness(provider, opsPolicy) !== filters.readiness) {
      return false;
    }
    if (filters.review && !providerMatchesReviewQueue(provider, filters.review, opsPolicy)) {
      return false;
    }
    return true;
  });
}

function providerMatchesReviewQueue(
  provider: AdminProvider,
  review: string,
  opsPolicy = DEFAULT_PROVIDER_OPS_POLICY,
) {
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
  if (review === 'public-media') {
    return providerPublicMediaNeedsReview(provider);
  }
  if (review === 'bank') {
    return (provider.bankAccounts ?? []).some((account) =>
      ['PENDING_REVIEW', 'REJECTED'].includes(account.status),
    );
  }
  if (review === 'payout-setup') {
    return providerPayoutSetupNeedsReview(provider);
  }
  if (review === 'cash-debt') {
    return providerUnsettledWalletBalance(provider) < 0;
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
    return ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider, opsPolicy));
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
    providerPublicMedia(provider)
      .map((file) => `${file.purpose} ${file.reviewStatus ?? ''} ${file.reviewReason ?? ''} ${file.key}`)
      .join(' '),
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

function providerReadiness(provider: AdminProvider, opsPolicy = DEFAULT_PROVIDER_OPS_POLICY) {
  if (provider.blockedAt) {
    return 'needs-review';
  }
  if (
    provider.verification?.status === 'APPROVED' &&
    provider.status === 'ONLINE_AVAILABLE' &&
    providerLocationStatus(provider, opsPolicy) === 'recent' &&
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

function providerPriority(provider: AdminProvider, opsPolicy = DEFAULT_PROVIDER_OPS_POLICY) {
  if (provider.blockedAt) {
    return 0;
  }
  if (['account-blocked', 'blocked', 'suspicious', 'shared'].includes(providerSecurityStatus(provider))) {
    return 0;
  }
  if (
    provider.verification?.status === 'APPROVED' &&
    provider.status === 'ONLINE_AVAILABLE' &&
    providerLocationStatus(provider, opsPolicy) === 'recent' &&
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

function providerLocationStatus(
  provider: AdminProvider,
  opsPolicy = DEFAULT_PROVIDER_OPS_POLICY,
): ProviderLocationState {
  if (!hasProviderCoordinate(provider) || !provider.currentLocationUpdatedAt) {
    return 'missing';
  }

  const updatedAt = new Date(provider.currentLocationUpdatedAt).getTime();
  if (!Number.isFinite(updatedAt)) {
    return 'missing';
  }

  const ageMs = Date.now() - updatedAt;
  if (ageMs > opsPolicy.expiredLocationHours * 60 * 60_000) {
    return 'expired';
  }
  if (ageMs > opsPolicy.staleLocationMinutes * 60_000) {
    return 'stale';
  }
  return 'recent';
}

function buildProviderOpsPolicy(settings: AdminOperationalPolicySetting[]): ProviderOpsPolicy {
  return {
    staleLocationMinutes:
      readPolicyNumber(settings, MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES_KEY) ??
      DEFAULT_PROVIDER_OPS_POLICY.staleLocationMinutes,
    expiredLocationHours: DEFAULT_PROVIDER_OPS_POLICY.expiredLocationHours,
    backupRadiusMeters:
      readPolicyNumber(settings, MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY) ??
      DEFAULT_PROVIDER_OPS_POLICY.backupRadiusMeters,
    responseWindowMinutes:
      readPolicyNumber(settings, MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY) ??
      DEFAULT_PROVIDER_OPS_POLICY.responseWindowMinutes,
  };
}

function readPolicyNumber(settings: AdminOperationalPolicySetting[], key: string) {
  const setting = settings.find((item) => item.key === key);
  if (!setting) return null;
  const parsed = Number(setting.value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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

function formatDistanceMeters(distanceMeters: number) {
  if (distanceMeters >= 1000) {
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(distanceMeters / 1000)}km`;
  }
  return `${new Intl.NumberFormat('en-US').format(distanceMeters)}m`;
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
    return 'Partner app has not shared a location.';
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
