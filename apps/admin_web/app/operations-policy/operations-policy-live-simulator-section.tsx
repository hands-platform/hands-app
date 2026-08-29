import { ExternalLink, RefreshCw } from 'lucide-react';

import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminNoticeCard, AdminSection } from '../../components/admin-surface';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge } from '../../components/status-badge';
import { formatRelativeTime } from '../../lib/admin-format';
import type { AdminMatchingPreview } from '../../lib/admin-api';
import { formatDistance } from './policy-distance-format';

type OperationsPolicyLiveSimulatorSectionProps = {
  readonly canOpenBookingEvidence?: boolean;
  readonly canOpenPartnerEvidence?: boolean;
  readonly compact?: boolean;
  readonly preview: AdminMatchingPreview | null;
  readonly refreshHref: string;
  readonly unavailable?: boolean;
  readonly variant?: 'dispatch' | 'supply';
};

export function OperationsPolicyLiveSimulatorSection({
  canOpenBookingEvidence = true,
  canOpenPartnerEvidence = true,
  compact = false,
  preview,
  refreshHref,
  unavailable = false,
  variant = 'dispatch',
}: OperationsPolicyLiveSimulatorSectionProps) {
  const presentation = matchingPreviewPresentation(preview, unavailable, variant);
  const primaryActionAllowed = preview?.primaryBlocker
    ? previewActionAllowed(
        preview.primaryBlocker.actionHref,
        canOpenBookingEvidence,
        canOpenPartnerEvidence,
      )
    : false;
  const topBlockingStages = preview?.reference.kind === 'BOOKING'
    ? preview.stages.slice(1).filter((stage) => stage.excludedCount > 0).slice(0, 3)
    : [];
  const completeProductionEvidence = Boolean(
    preview &&
    preview.reference.kind === 'BOOKING' &&
    !preview.evidence.truncated &&
    (preview.status === 'READY_WITH_PRODUCTION_EVIDENCE' ||
      preview.status === 'BLOCKED_NO_ELIGIBLE_SUPPLY'),
  );
  const smallProductionSample = Boolean(
    preview &&
    preview.reference.kind === 'BOOKING' &&
    preview.evidence.totalEvaluated > 0 &&
    preview.evidence.totalEvaluated < 10,
  );

  return (
    <AdminSection
      actions={(
        <AdminFormControlLink className="button-secondary" href={refreshHref}>
          <RefreshCw aria-hidden="true" size={16} />
          {variant === 'supply' ? 'Refresh evidence' : 'Re-run preview'}
        </AdminFormControlLink>
      )}
      className="operations-policy-matching-preview admin-mb-16"
      description={variant === 'supply'
        ? 'Authoritative current status for the active production matching booking, using the same Partner candidate gates as dispatch.'
        : 'Read-only, no-write preview using the current live matching policy and the same production Partner candidate gates used for dispatch.'}
      statusLabel={presentation.label}
      statusTone={presentation.tone}
      title={variant === 'supply' ? 'Supply evidence' : 'Current dispatch preview'}
    >
      {!preview || unavailable ? (
        <AdminEmptyState
          framed
          message="The matching preview API could not be loaded. Retry before using this workspace for a dispatch decision."
          title="Production evidence unavailable"
        />
      ) : (
        <>
          <AdminTraceSummary
            ariaLabel="Matching preview evidence summary"
            className="admin-mt-12 operations-policy-preview-summary"
            inferScope={false}
            metrics={[
              {
                detail: (
                  <>
                    {preview.reference.lat !== null && preview.reference.lng !== null
                      ? `${preview.reference.lat.toFixed(4)}, ${preview.reference.lng.toFixed(4)}`
                      : 'Coordinates unavailable'}
                    {preview.reference.observedAt ? (
                      <>
                        {' · observed '}
                        <DateTimeText value={preview.reference.observedAt} />
                        {` (${formatRelativeTime(preview.reference.observedAt, { includeFuture: true })})`}
                      </>
                    ) : null}
                  </>
                ),
                label: 'Reference',
                scope: preview.reference.kind === 'BOOKING' ? 'Production booking' : 'Demo only',
                value: preview.reference.label,
              },
              {
                detail: formatRelativeTime(preview.checkedAt, { justNow: 'just now', includeFuture: true }),
                label: 'Checked',
                scope: 'Asia/Ho_Chi_Minh',
                valueDateTimeValue: preview.checkedAt,
                value: 'Not available',
              },
              {
                detail: preview.evidence.newestAt ? (
                  <>
                    {`Newest ${formatRelativeTime(preview.evidence.newestAt)}`}
                    {preview.evidence.oldestAt ? (
                      <>
                        {' · oldest '}
                        <DateTimeText value={preview.evidence.oldestAt} />
                        {` (${formatRelativeTime(preview.evidence.oldestAt)})`}
                      </>
                    ) : null}
                  </>
                ) : 'No Partner location evidence returned',
                label: 'Partner evidence',
                scope: 'Source freshness',
                valueDateTimeValue: preview.evidence.newestAt,
                value: 'Unavailable',
              },
              {
                detail: completeProductionEvidence
                  ? 'Exact server-side stage counts'
                  : preview.status === 'DEMO_PREVIEW_ONLY'
                    ? 'Demo coordinates were not evaluated as production supply.'
                    : 'No global supply conclusion is made.',
                label: 'Coverage',
                scope: completeProductionEvidence
                  ? 'Complete'
                  : preview.status === 'DEMO_PREVIEW_ONLY'
                    ? 'Not production evidence'
                    : 'Incomplete',
                value: preview.status === 'DEMO_PREVIEW_ONLY' ||
                  (!completeProductionEvidence && preview.evidence.totalEvaluated === 0)
                    ? 'Not evaluated'
                    : `${preview.evidence.totalEvaluated} Partner records evaluated`,
              },
            ]}
          />

          {smallProductionSample ? (
            <AdminNoticeCard role="status" tone="warning">
              <AdminSectionHeader
                description="Fewer than 10 Partner records were evaluated. Treat the gate result as a narrow operational sample, not a city-wide supply conclusion."
                status={<StatusBadge tone="warning">Small sample</StatusBadge>}
                title="Preview confidence is limited"
              />
            </AdminNoticeCard>
          ) : null}

          {presentation.notice ? (
            <AdminNoticeCard role={presentation.role} tone={presentation.noticeTone}>
              <AdminSectionHeader
                actions={primaryActionAllowed && preview.primaryBlocker?.actionHref && preview.primaryBlocker.actionLabel ? (
                  <AdminFormControlLink className="button-secondary" href={preview.primaryBlocker.actionHref}>
                    {preview.primaryBlocker.actionLabel}
                  </AdminFormControlLink>
                ) : null}
                description={presentation.notice.detail}
                status={<StatusBadge tone={presentation.tone}>{presentation.label}</StatusBadge>}
                title={presentation.notice.title}
              />
            </AdminNoticeCard>
          ) : null}

          {preview.primaryBlocker && !presentation.notice ? (
            <AdminNoticeCard className="operations-policy-primary-blocker" role="alert" tone="danger">
              <AdminSectionHeader
                actions={primaryActionAllowed && preview.primaryBlocker.actionHref && preview.primaryBlocker.actionLabel ? (
                  <AdminFormControlLink className="button-secondary" href={preview.primaryBlocker.actionHref}>
                    {preview.primaryBlocker.actionLabel}
                  </AdminFormControlLink>
                ) : null}
                description={preview.primaryBlocker.detail}
                status={<StatusBadge tone="danger">Primary blocker</StatusBadge>}
                title={preview.primaryBlocker.title}
              />
            </AdminNoticeCard>
          ) : null}

          {compact && variant === 'supply' && topBlockingStages.length > 0 ? (
            <section aria-label="Top non-zero matching blockers" className="admin-mt-14">
              <AdminSectionHeader
                description="Stage losses are shown independently; do not combine them into a total supply count."
                status={<StatusBadge tone="warning">Top {topBlockingStages.length}</StatusBadge>}
                title="Top matching blockers"
              />
              <div className="operations-policy-preview-funnel admin-mt-10">
                {topBlockingStages.map((stage) => (
                  <div key={stage.code}>
                    <span>{stage.label}</span>
                    <strong>{stage.excludedCount}</strong>
                    <small>excluded at this stage</small>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {!compact && preview.reference.kind === 'BOOKING' && preview.stages.length > 0 ? (
            <div aria-label="Production matching blocker funnel" className="operations-policy-preview-funnel admin-mt-14">
              {preview.stages.map((stage) => (
                <div className={stage.passedCount === 0 ? 'is-blocked' : undefined} key={stage.code}>
                  <span>{stage.label}</span>
                  <strong>{stage.passedCount}</strong>
                  <small>{stage.excludedCount > 0 ? `${stage.excludedCount} excluded here` : 'No loss at this gate'}</small>
                </div>
              ))}
            </div>
          ) : null}

          {!compact && preview.reference.kind === 'BOOKING' && preview.candidates.length > 0 ? (
            <section aria-label="Matching preview candidates" className="operations-policy-preview-candidates admin-mt-16">
              <AdminSectionHeader
                description="Nearest Partners remaining after the production status, identity, service, location, radius, alert, wallet, and invitation-limit gates."
                status={<StatusBadge tone="info">{preview.candidates.length} shown</StatusBadge>}
                title="Candidate preview"
              />
              <div className="stack admin-mt-10">
                {preview.candidates.map((candidate) => (
                  <div className="ops-row" key={candidate.partnerId}>
                    <div>
                      {canOpenPartnerEvidence ? (
                        <AdminFormControlLink
                          className="button-secondary policy-inline-action"
                          href={`/partners/${candidate.partnerId}`}
                        >
                          <ExternalLink aria-hidden="true" size={14} />
                          {candidate.name}
                        </AdminFormControlLink>
                      ) : <strong>{candidate.name}</strong>}
                      <p className="muted">
                        {formatDistance(candidate.distanceMeters)} · location <DateTimeText value={candidate.locationUpdatedAt} />
                      </p>
                    </div>
                    <StatusBadge tone="success">Invitable</StatusBadge>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <p className="muted operations-policy-preview-safety admin-mt-14">
            Dry run only. No booking, participant, notification, wallet, audit, or policy record was created or changed.
          </p>
        </>
      )}
    </AdminSection>
  );
}

function previewActionAllowed(
  href: string | null,
  canOpenBookingEvidence: boolean,
  canOpenPartnerEvidence: boolean,
) {
  if (!href) return false;
  if (href.startsWith('/bookings')) return canOpenBookingEvidence;
  if (href.startsWith('/partners') || href.startsWith('/partner-controls')) return canOpenPartnerEvidence;
  return true;
}

function matchingPreviewPresentation(
  preview: AdminMatchingPreview | null,
  unavailable: boolean,
  variant: 'dispatch' | 'supply',
): {
  label: string;
  notice: { title: string; detail: string } | null;
  noticeTone: 'danger' | 'warning';
  role: 'alert' | 'status';
  tone: 'danger' | 'success' | 'warning';
} {
  if (!preview || unavailable || preview.status === 'UNAVAILABLE') {
    return { label: 'Unavailable', notice: null, noticeTone: 'danger', role: 'alert', tone: 'danger' };
  }
  if (preview.status === 'READY_WITH_PRODUCTION_EVIDENCE') {
    return {
      label: 'Ready with production evidence',
      notice: null,
      noticeTone: 'warning',
      role: 'status',
      tone: 'success',
    };
  }
  if (preview.status === 'DEMO_PREVIEW_ONLY') {
    return {
      label: variant === 'supply' ? 'Inconclusive · demo reference' : 'Demo preview only',
      notice: {
        detail: 'No actionable booking coordinate is available. Results use the Ho Chi Minh City demo reference and cannot approve a live policy decision.',
        title: 'Demo evidence cannot authorize dispatch',
      },
      noticeTone: 'warning',
      role: 'status',
      tone: 'warning',
    };
  }
  if (preview.status === 'INCOMPLETE_EVIDENCE') {
    return {
      label: variant === 'supply' ? 'Inconclusive · incomplete evidence' : 'Evidence incomplete',
      notice: {
        detail: 'The server could not prove complete candidate coverage. No global supply conclusion is shown.',
        title: 'Cannot complete a production dispatch preview',
      },
      noticeTone: 'warning',
      role: 'status',
      tone: 'warning',
    };
  }
  return {
    label: preview.status === 'BLOCKED_NO_REFERENCE' ? 'No actionable reference' : 'Blocked · no eligible Partner supply',
    notice: null,
    noticeTone: 'danger',
    role: 'alert',
    tone: 'danger',
  };
}
