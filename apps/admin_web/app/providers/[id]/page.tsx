import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AdminProvider,
  adminGet,
  providerDocumentLabel,
  providerDocumentReviewHint,
} from '../../../lib/admin-api';
import {
  approveProvider,
  approveProviderBankAccount,
  approveProviderDocument,
  approveProviderKyc,
  approveProviderTaxProfile,
  rejectProvider,
  rejectProviderBankAccount,
  rejectProviderDocument,
  rejectProviderKyc,
  rejectProviderTaxProfile,
  syncSupabaseProviderRole,
} from '../actions';

type PageProps = {
  params: Promise<{ id: string }>;
};

type ProviderDetail = AdminProvider & {
  locationSnapshots?: Array<{ id: string; lat: string | number; lng: string | number; recordedAt: string }>;
  earnings?: Array<{
    id: string;
    grossAmount: number;
    withholdingAmount: number;
    netAmount: number;
    status: string;
    createdAt?: string;
  }>;
  payoutBatches?: Array<{ id: string; totalNetAmount: number; status: string; createdAt?: string }>;
  verificationLogs?: Array<{
    id: string;
    action: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    metadata?: unknown;
    createdAt: string;
    actor?: { phone?: string | null; fullName?: string | null } | null;
  }>;
};

export default async function ProviderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const provider = await adminGet<ProviderDetail | null>(`/admin/providers/${id}`, null);

  if (!provider) {
    notFound();
  }

  const readUrls = new Map<string, string>();
  await Promise.all(
    [
      ...(provider.verification?.files ?? []),
      ...(provider.documents ?? []).map((document) => document.fileAsset).filter(Boolean),
    ].map(async (file) => {
      if (!file?.id) return;
      const result = await adminGet<{ read?: { url?: string } }>(`/files/${file.id}/read-url`, {});
      if (result.read?.url) {
        readUrls.set(file.id, result.read.url);
      }
    }),
  );

  const primaryBank = provider.bankAccounts?.[0];
  const reviewChecklist = buildReviewChecklist(provider);
  const canApproveKyc = hasApprovedRequiredKycDocuments(provider);

  return (
    <>
      <section className="toolbar">
        <div>
          <p className="muted">
            <Link className="text-link" href="/providers">
              Back to providers
            </Link>
          </p>
          <h1>{provider.displayName || provider.user?.fullName || provider.user?.phone}</h1>
          <p className="muted">
            {provider.legalName ?? 'Legal name missing'} / {provider.user?.phone ?? 'No phone'} /{' '}
            {provider.city ?? 'No city'}
          </p>
        </div>
        <div className="actions">
          <form action={approveProvider}>
            <input type="hidden" name="providerId" value={provider.id} />
            <button type="submit">Approve provider</button>
          </form>
          <form action={rejectProvider}>
            <input type="hidden" name="providerId" value={provider.id} />
            <input
              name="reason"
              placeholder="Provider rejection reason"
              defaultValue="Rejected from provider detail review"
            />
            <button type="submit">Reject provider</button>
          </form>
          <form action={syncSupabaseProviderRole}>
            <input type="hidden" name="providerId" value={provider.id} />
            <button type="submit" disabled={provider.verification?.status !== 'APPROVED'}>
              Sync Supabase role
            </button>
          </form>
        </div>
      </section>

      <div className="grid" style={{ marginBottom: 16 }}>
        <StatusCard label="Level" value={provider.level ?? 'LEVEL_1_SIGNUP'} />
        <StatusCard label="Provider status" value={provider.status} />
        <StatusCard label="KYC" value={provider.kyc?.status ?? 'DRAFT'} />
        <StatusCard label="Verification" value={provider.verification?.status ?? 'DRAFT'} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Approval checklist</h2>
            <p className="muted">
              Review these gates before approving the provider or relying on this therapist for dispatch.
            </p>
          </div>
          <span className={`pill ${reviewChecklist.ready ? 'pill-success' : 'pill-warn'}`}>
            {reviewChecklist.ready ? 'Ready for approval' : `${reviewChecklist.blockers} blocker(s)`}
          </span>
        </div>
        <div className="setup-stage-list">
          {reviewChecklist.items.map((item) => (
            <div className="setup-stage-item" key={item.label}>
              <span>{item.status}</span>
              <div>
                <strong>{item.label}</strong>
                <p className="muted">{item.detail}</p>
              </div>
              <small>{item.ok ? 'OK' : 'Check'}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Review history</h2>
            <p className="muted">
              Provider, KYC, document, bank, and tax review decisions are shown here for handoff and audit.
            </p>
          </div>
          <span className="pill pill-info">{provider.verificationLogs?.length ?? 0} recent event(s)</span>
        </div>
        {(provider.verificationLogs ?? []).length ? (
          <div className="setup-stage-list">
            {provider.verificationLogs?.slice(0, 8).map((log) => {
              const preview = metadataPreview(log.metadata);
              return (
                <div className="setup-stage-item" key={log.id}>
                  <span>{humanizeProviderLogAction(log.action)}</span>
                  <div>
                    <strong>{statusTransition(log)}</strong>
                    <p className="muted">
                      {formatDate(log.createdAt)} / {log.actor?.fullName ?? log.actor?.phone ?? 'System'}
                    </p>
                    {preview ? <p className="muted">{preview}</p> : null}
                  </div>
                  <small>{log.action}</small>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">
            No provider review logs yet. New approval, rejection, and resubmission actions will appear here.
          </p>
        )}
      </div>

      <section className="detail-grid">
        <div className="card">
          <h2>Basic profile</h2>
          <InfoLine label="Display name" value={provider.displayName} />
          <InfoLine label="Legal name" value={provider.legalName} />
          <InfoLine label="Phone" value={provider.user?.phone} />
          <InfoLine label="Address" value={provider.residentialAddress} />
          <InfoLine label="User name" value={provider.user?.fullName} />
          <InfoLine label="Supabase user" value={provider.user?.supabaseUserId} />
          <p className="muted">
            {provider.verification?.rejectionReason ?? provider.bio ?? 'No notes saved.'}
          </p>
        </div>

        <div className="card">
          <h2>KYC decision</h2>
          <p className="muted">
            CCCD last 4: {provider.kyc?.cccdNumberLast4 ? `****${provider.kyc.cccdNumberLast4}` : 'Missing'}
          </p>
          <p className="muted">Submitted: {formatDate(provider.kyc?.submittedAt)}</p>
          <p className="muted">Reviewed: {formatDate(provider.kyc?.reviewedAt)}</p>
          {provider.kyc?.rejectionReason ? (
            <p className="muted">Rejection reason: {provider.kyc.rejectionReason}</p>
          ) : null}
          <div className="actions" style={{ marginTop: 12 }}>
            <form action={approveProviderKyc}>
              <input type="hidden" name="providerId" value={provider.id} />
              <button type="submit" disabled={provider.kyc?.status === 'APPROVED' || !canApproveKyc}>
                Approve KYC
              </button>
            </form>
            <form action={rejectProviderKyc}>
              <input type="hidden" name="providerId" value={provider.id} />
              <input
                name="reason"
                placeholder="KYC rejection reason"
                defaultValue="KYC rejected from provider detail review"
              />
              <button type="submit" disabled={!provider.kyc || provider.kyc.status === 'REJECTED'}>
                Reject KYC
              </button>
            </form>
          </div>
          {!canApproveKyc ? (
            <p className="muted" style={{ marginTop: 10 }}>
              Approve the required CCCD front, CCCD back, and selfie documents before approving KYC.
            </p>
          ) : null}
        </div>

        <div className="card">
          <h2>Typed documents</h2>
          {(provider.documents ?? []).length ? (
            provider.documents?.map((document) => (
              <div className="provider-file-row" key={document.id}>
                <div className="participant-list" style={{ marginBottom: 6 }}>
                  <span className="pill pill-info">{providerDocumentLabel(document.type)}</span>
                  <span className={`pill ${document.status === 'APPROVED' ? 'pill-success' : 'pill-warn'}`}>
                    {document.status}
                  </span>
                </div>
                <p className="muted">{providerDocumentReviewHint(document.type)}</p>
                <p className="muted">
                  {document.fileAsset?.contentType ?? 'Unknown type'}
                  {document.fileAsset?.uploadedAt ? ` / ${formatDate(document.fileAsset.uploadedAt)}` : ''}
                </p>
                {document.rejectionReason ? (
                  <p className="muted">Rejection reason: {document.rejectionReason}</p>
                ) : null}
                <p className="muted">
                  {document.fileAsset?.id && readUrls.get(document.fileAsset.id) ? (
                    <a
                      className="text-link"
                      href={readUrls.get(document.fileAsset.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open private file
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
                      name="reason"
                      placeholder="Document rejection reason"
                      defaultValue="Provider document rejected from detail review"
                    />
                    <button type="submit" disabled={document.status === 'REJECTED'}>
                      Reject doc
                    </button>
                  </form>
                </div>
              </div>
            ))
          ) : (
            <p className="muted">No typed onboarding documents yet.</p>
          )}
        </div>

        <div className="card">
          <h2>Bank and payout gate</h2>
          {primaryBank ? (
            <>
              <InfoLine label="Bank" value={primaryBank.bankName} />
              <InfoLine
                label="Account"
                value={primaryBank.accountNumberMasked ?? primaryBank.accountNumberLast4}
              />
              <InfoLine label="Holder" value={primaryBank.accountHolderName} />
              <InfoLine label="Status" value={primaryBank.status} />
              <InfoLine label="Rejection reason" value={primaryBank.rejectionReason} />
              <div className="actions" style={{ marginTop: 12 }}>
                <form action={approveProviderBankAccount}>
                  <input type="hidden" name="bankAccountId" value={primaryBank.id} />
                  <button type="submit" disabled={primaryBank.status === 'APPROVED'}>
                    Approve bank
                  </button>
                </form>
                <form action={rejectProviderBankAccount}>
                  <input type="hidden" name="bankAccountId" value={primaryBank.id} />
                  <input
                    name="reason"
                    placeholder="Bank rejection reason"
                    defaultValue="Bank rejected from provider detail review"
                  />
                  <button type="submit" disabled={primaryBank.status === 'REJECTED'}>
                    Reject bank
                  </button>
                </form>
              </div>
            </>
          ) : (
            <p className="muted">No bank account submitted.</p>
          )}
        </div>

        <div className="card">
          <h2>Tax profile</h2>
          {provider.taxProfile ? (
            <>
              <InfoLine label="Status" value={provider.taxProfile.status} />
              <InfoLine label="Legal name" value={provider.taxProfile.legalName} />
              <InfoLine label="Tax code" value={`****${provider.taxProfile.taxCodeLast4 ?? '----'}`} />
              <InfoLine label="Registered address" value={provider.taxProfile.registeredAddress} />
              <InfoLine label="Rejection reason" value={provider.taxProfile.rejectionReason} />
              <div className="actions" style={{ marginTop: 12 }}>
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
                    defaultValue="Tax profile rejected from detail review"
                  />
                  <button type="submit" disabled={provider.taxProfile.status === 'REJECTED'}>
                    Reject tax
                  </button>
                </form>
              </div>
            </>
          ) : (
            <p className="muted">
              Tax profile is not required until payout unlock, and has not been submitted.
            </p>
          )}
        </div>

        <div className="card">
          <h2>Location and activity</h2>
          <InfoLine
            label="Last location"
            value={provider.currentLocationUpdatedAt ? formatDate(provider.currentLocationUpdatedAt) : null}
          />
          <InfoLine
            label="Coordinates"
            value={
              provider.currentLat && provider.currentLng
                ? `${Number(provider.currentLat).toFixed(5)}, ${Number(provider.currentLng).toFixed(5)}`
                : null
            }
          />
          <div className="participant-list">
            {(provider.locationSnapshots ?? []).slice(0, 5).map((snapshot) => (
              <span className="pill pill-neutral" key={snapshot.id}>
                {formatDate(snapshot.recordedAt)}
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Agreements</h2>
          {(provider.agreements ?? []).length ? (
            <div className="participant-list">
              {provider.agreements?.map((agreement) => (
                <span className="pill pill-success" key={agreement.id}>
                  {agreement.type} v{agreement.version}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">No legal agreements accepted yet.</p>
          )}
        </div>

        <div className="card">
          <h2>Recent payout signals</h2>
          <InfoLine label="Recent earnings" value={(provider.earnings?.length ?? 0).toString()} />
          <InfoLine label="Recent payout batches" value={(provider.payoutBatches?.length ?? 0).toString()} />
          {(provider.earnings ?? []).slice(0, 3).map((earning) => (
            <p className="muted" key={earning.id}>
              {earning.status}: gross {formatCurrency(earning.grossAmount)} / withholding{' '}
              {formatCurrency(earning.withholdingAmount)} / net {formatCurrency(earning.netAmount)}
            </p>
          ))}
        </div>
      </section>
    </>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p>{label}</p>
      <h2>{value}</h2>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <p className="muted">
      <strong>{label}:</strong> {value && value.trim() ? value : 'Missing'}
    </p>
  );
}

function buildReviewChecklist(provider: ProviderDetail) {
  const missingDocuments = missingApprovedRequiredKycDocuments(provider);
  const primaryBank = provider.bankAccounts?.[0];
  const hasRecentLocation = locationAgeMinutes(provider.currentLocationUpdatedAt) <= 30;
  const hasPushDevice = (provider.user?.pushDevices ?? []).some((device) => device.enabled);
  const hasBasicProfile = Boolean(
    provider.displayName?.trim() &&
    provider.legalName?.trim() &&
    provider.user?.phone?.trim() &&
    provider.residentialAddress?.trim(),
  );

  const items = [
    {
      label: 'Basic provider identity',
      ok: hasBasicProfile,
      status: hasBasicProfile ? 'Complete' : 'Missing',
      detail: hasBasicProfile
        ? 'Display name, legal name, phone, and address are saved.'
        : 'Confirm display name, legal name, phone, and residential address.',
    },
    {
      label: 'KYC status',
      ok: provider.kyc?.status === 'APPROVED',
      status: provider.kyc?.status ?? 'DRAFT',
      detail:
        provider.kyc?.status === 'APPROVED'
          ? 'KYC has been approved.'
          : 'Approve CCCD/CMND and selfie review before Level 2 activity.',
    },
    {
      label: 'Required KYC documents',
      ok: missingDocuments.length === 0,
      status: missingDocuments.length === 0 ? 'Complete' : 'Missing',
      detail:
        missingDocuments.length === 0
          ? 'CCCD front, CCCD back, and selfie are approved.'
          : `Missing or unapproved: ${missingDocuments.map(providerDocumentLabel).join(', ')}.`,
    },
    {
      label: 'Bank account',
      ok: primaryBank?.status === 'APPROVED',
      status: primaryBank?.status ?? 'MISSING',
      detail: primaryBank
        ? `${primaryBank.bankName} / ${primaryBank.accountNumberMasked ?? primaryBank.accountNumberLast4 ?? 'unmasked'}`
        : 'Provider has not submitted a payout account.',
    },
    {
      label: 'Tax and payout gate',
      ok: provider.taxProfile?.status === 'APPROVED' || (provider.earnings ?? []).length === 0,
      status: provider.taxProfile?.status ?? 'DEFERRED',
      detail:
        provider.taxProfile?.status === 'APPROVED'
          ? 'Tax profile has been approved.'
          : 'Tax profile can stay deferred until first completed service, then blocks payout.',
    },
    {
      label: 'Location freshness',
      ok: hasRecentLocation,
      status: hasRecentLocation ? 'RECENT' : 'STALE',
      detail: provider.currentLocationUpdatedAt
        ? `Last shared at ${formatDate(provider.currentLocationUpdatedAt)}.`
        : 'Provider app has not shared a location.',
    },
    {
      label: 'Push device',
      ok: hasPushDevice,
      status: hasPushDevice ? 'READY' : 'MISSING',
      detail: hasPushDevice
        ? 'At least one enabled device token exists.'
        : 'Ask provider to open the app so alerts can register.',
    },
  ];

  return {
    items,
    blockers: items.filter((item) => !item.ok).length,
    ready: items.every((item) => item.ok),
  };
}

function hasApprovedRequiredKycDocuments(provider: ProviderDetail) {
  return missingApprovedRequiredKycDocuments(provider).length === 0;
}

function missingApprovedRequiredKycDocuments(provider: ProviderDetail) {
  const requiredDocuments = ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE'];
  const approvedDocuments = new Set(
    (provider.documents ?? [])
      .filter((document) => document.status === 'APPROVED')
      .map((document) => document.type),
  );
  return requiredDocuments.filter((type) => !approvedDocuments.has(type));
}

function formatDate(value?: string | null) {
  if (!value) return 'Missing';
  return new Date(value).toLocaleString();
}

function locationAgeMinutes(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const updatedAt = new Date(value).getTime();
  if (!Number.isFinite(updatedAt)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((Date.now() - updatedAt) / 60_000));
}

function formatCurrency(value?: number | null) {
  if (!value) return '0 VND';
  return `${value.toLocaleString('vi-VN')} VND`;
}

function humanizeProviderLogAction(action: string) {
  return action
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function statusTransition(log: NonNullable<ProviderDetail['verificationLogs']>[number]) {
  if (log.fromStatus || log.toStatus) {
    return `${log.fromStatus ?? 'New'} -> ${log.toStatus ?? 'Unknown'}`;
  }
  return 'Decision recorded';
}

function metadataPreview(metadata?: unknown) {
  if (!metadata || typeof metadata !== 'object') return null;
  const record = metadata as Record<string, unknown>;
  const reason = typeof record.reason === 'string' ? record.reason : null;
  const documentType = typeof record.documentType === 'string' ? record.documentType : null;
  const target = typeof record.target === 'string' ? record.target : null;
  const parts = [
    reason ? `Reason: ${reason}` : null,
    documentType ? `Document: ${documentType}` : null,
    target ? `Target: ${target}` : null,
  ].filter(Boolean);
  return parts.join(' / ');
}
