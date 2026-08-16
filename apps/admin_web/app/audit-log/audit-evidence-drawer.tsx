'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Braces, Download, X } from 'lucide-react';

import { AdminDrawerBackdropButton } from '../../components/admin-drawer-backdrop-button';
import { AdminFormControlButton, AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminDrawerSurface } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import { useAdminModalFocus } from '../../components/use-admin-modal-focus';
import type { AdminAuditEventView } from '../../lib/admin-api';
import { AuditCopyButton } from './audit-copy-button';
import {
  auditNotificationRetryEvidence,
  AuditNotificationRetryEvidenceSection,
} from './audit-notification-retry-evidence';

export function AuditEvidenceDrawer({
  event,
  returnFocusHref,
  returnHref,
  scopeBucket,
}: {
  readonly event: AdminAuditEventView;
  readonly returnFocusHref: string;
  readonly returnHref: string;
  readonly scopeBucket?: string;
}) {
  const router = useRouter();
  const drawerRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement>(null);
  const [wrapJson, setWrapJson] = useState(true);
  const titleId = 'audit-evidence-drawer-title';
  const rawJson = useMemo(() => JSON.stringify(event.payload, null, 2), [event.payload]);
  const retryEvidence = useMemo(() => auditNotificationRetryEvidence(event.payload), [event.payload]);
  const policyEvidence = useMemo(() => operationalPolicyEvidence(event), [event]);

  useEffect(() => {
    returnFocusRef.current = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).find(
      (link) => link.getAttribute('href') === returnFocusHref,
    ) ?? null;
  }, [returnFocusHref]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const onClose = useCallback(() => {
    router.replace(returnHref, { scroll: false });
  }, [returnHref, router]);

  useAdminModalFocus(drawerRef, onClose, returnFocusRef);

  return (
    <>
      <AdminDrawerBackdropButton aria-label="Close evidence details" onClick={onClose} />
      <AdminDrawerSurface
        ariaLabel="Audit evidence details"
        ariaLabelledBy={titleId}
        ariaModal
        className="calendar-drawer audit-evidence-drawer"
        surfaceRef={drawerRef}
        tabIndex={-1}
      >
        <div className="calendar-drawer-header audit-evidence-drawer-header">
          <div>
            <h2 id={titleId}>{event.eventLabel}</h2>
            <p>{shortId(event.id)} · {event.actor.labelSnapshot}</p>
          </div>
          <AdminFormControlButton
            aria-label="Close evidence details"
            className="button-secondary calendar-icon-button"
            onClick={onClose}
            title="Close evidence details"
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </AdminFormControlButton>
        </div>

        <div className="calendar-drawer-body audit-evidence-drawer-body">
          <section aria-labelledby="audit-evidence-summary-title" className="audit-evidence-section">
            <div className="audit-evidence-section-heading">
              <h3 id="audit-evidence-summary-title">Summary</h3>
              <div className="audit-evidence-badges">
                <StatusBadge tone={severityTone(event.severity)}>{event.severity}</StatusBadge>
                <StatusBadge tone={outcomeTone(event.outcome)}>{event.outcome}</StatusBadge>
              </div>
            </div>
            <dl className="audit-evidence-facts">
              <div><dt>Event ID</dt><dd>{event.id}</dd></div>
              <div><dt>Actor</dt><dd>{event.actor.type} · {event.actor.labelSnapshot}</dd></div>
              <div><dt>Actor key</dt><dd>{event.actor.key ?? 'Not recorded'}</dd></div>
              <div><dt>Object</dt><dd>{event.object.type} · {event.object.labelSnapshot}</dd></div>
              <div><dt>Object ID</dt><dd>{event.object.id}</dd></div>
              <div><dt>Occurred</dt><dd>{formatVietnamTime(event.occurredAt)}</dd></div>
              <div><dt>Recorded</dt><dd>{formatVietnamTime(event.recordedAt)}</dd></div>
              <div><dt>Area</dt><dd>{event.area}</dd></div>
              <div><dt>Schema version</dt><dd>v{event.schemaVersion}</dd></div>
              <div><dt>Integrity</dt><dd>{event.integrity === 'HASHED' ? 'Payload hash stored' : 'Legacy · unverified'}</dd></div>
            </dl>
            {event.actor.attribution === 'LEGACY_INFERRED' ? (
              <p className="audit-evidence-warning">Legacy attribution inferred from the historical event source.</p>
            ) : null}
          </section>

          {policyEvidence ? (
            <section aria-labelledby="audit-policy-evidence-title" className="audit-evidence-section">
              <h3 id="audit-policy-evidence-title">Policy evidence</h3>
              <dl className="audit-evidence-facts">
                <div><dt>Policy key</dt><dd>{policyEvidence.key}</dd></div>
                <div><dt>Policy target</dt><dd>{policyEvidence.target}</dd></div>
                <div><dt>Environment</dt><dd>{policyEvidence.environment}</dd></div>
                <div><dt>Run ID</dt><dd>{policyEvidence.runId}</dd></div>
                <div><dt>Restoration</dt><dd>{policyEvidence.restoration}</dd></div>
                <div><dt>Source trust</dt><dd>{policyEvidence.sourceTrust}</dd></div>
              </dl>
              {!policyEvidence.trustedSource ? (
                <p className="audit-evidence-warning">
                  Trusted source metadata was not recorded. Reason wording may resemble automation but remains unverified.
                </p>
              ) : null}
            </section>
          ) : null}

          <section aria-labelledby="audit-evidence-change-title" className="audit-evidence-section">
            <h3 id="audit-evidence-change-title">Change and reason</h3>
            <p>{event.changeSummary}</p>
            {event.reason ? (
              <dl className="audit-evidence-facts">
                {event.reason.code ? <div><dt>Reason code</dt><dd>{event.reason.code}</dd></div> : null}
                {event.reason.text ? <div><dt>Reason</dt><dd>{event.reason.text}</dd></div> : null}
              </dl>
            ) : null}
            {event.change ? (
              <div className="audit-evidence-change-grid">
                <EvidenceValue label="Before" value={event.change.before} />
                <EvidenceValue label="After" value={event.change.after} />
              </div>
            ) : null}
          </section>

          <section aria-labelledby="audit-evidence-context-title" className="audit-evidence-section">
            <h3 id="audit-evidence-context-title">Request context</h3>
            <dl className="audit-evidence-facts">
              <div><dt>Source</dt><dd>{event.context.source}</dd></div>
              <div><dt>Correlation ID</dt><dd>{event.context.correlationId ?? 'Not recorded'}</dd></div>
              <div><dt>Request ID</dt><dd>{event.context.requestId ?? 'Not recorded'}</dd></div>
              <div><dt>Route template</dt><dd>{event.context.routeTemplate ?? 'Not recorded'}</dd></div>
            </dl>
            <div className="audit-evidence-actions">
              <AuditCopyButton label="Copy event ID" value={event.id} />
              {event.actor.key ? <AuditCopyButton label="Copy actor key" value={event.actor.key} /> : null}
              <AuditCopyButton label="Copy object ID" value={event.object.id} />
              <AdminFormControlLink
                className="button-secondary"
                href={`/api/admin/audit-log/export?format=json&range=all&eventId=${encodeURIComponent(event.id)}${scopeBucket ? `&bucket=${encodeURIComponent(scopeBucket)}` : ''}`}
              >
                <Download aria-hidden="true" size={15} />
                Download evidence
              </AdminFormControlLink>
              {event.context.correlationId ? (
                <AuditCopyButton label="Copy correlation ID" value={event.context.correlationId} />
              ) : null}
              {event.context.requestId ? (
                <AuditCopyButton label="Copy request ID" value={event.context.requestId} />
              ) : null}
              {event.payloadHash ? (
                <AuditCopyButton label="Copy payload hash" value={event.payloadHash} />
              ) : null}
            </div>
          </section>

          {retryEvidence ? <AuditNotificationRetryEvidenceSection evidence={retryEvidence} /> : null}

          <section aria-labelledby="audit-evidence-raw-title" className="audit-evidence-section">
            <div className="audit-evidence-section-heading">
              <div>
                <h3 id="audit-evidence-raw-title">Raw JSON</h3>
                <p>Redacted by the audit storage policy. No display-copy transformations are applied.</p>
              </div>
              <StatusBadge tone={event.integrity === 'HASHED' ? 'success' : 'warning'}>
                {event.integrity === 'HASHED' ? 'Hash stored' : 'Legacy · unverified'}
              </StatusBadge>
            </div>
            <div className="audit-evidence-actions">
              <AuditCopyButton label="Copy raw JSON" value={rawJson} />
              <AdminFormControlButton
                aria-pressed={wrapJson}
                className="button-secondary"
                onClick={() => setWrapJson((current) => !current)}
                type="button"
              >
                <Braces aria-hidden="true" size={15} />
                {wrapJson ? 'Disable wrap' : 'Wrap JSON'}
              </AdminFormControlButton>
            </div>
            <pre className={wrapJson ? 'audit-raw-json is-wrapped' : 'audit-raw-json'}>{rawJson}</pre>
            {event.payloadHash ? <p className="audit-evidence-hash">SHA-256 · {event.payloadHash}</p> : null}
          </section>
        </div>
      </AdminDrawerSurface>
    </>
  );
}

function operationalPolicyEvidence(event: AdminAuditEventView) {
  if (event.eventType !== 'operational_policy.update') return null;
  const payload = plainRecord(event.payload);
  const source = stringValue(payload?.source) ?? event.context.source;
  const trustedSource = source === 'operator' || source === 'automated_smoke';
  return {
    environment: stringValue(payload?.environment) ?? 'Not recorded',
    key: stringValue(payload?.key) ?? event.object.id,
    restoration: typeof payload?.restoration === 'boolean'
      ? payload.restoration ? 'Yes' : 'No'
      : 'Not recorded',
    runId: stringValue(payload?.runId) ?? 'Not recorded',
    sourceTrust: trustedSource ? `${source} · recorded metadata` : 'Legacy / unknown · unverified metadata',
    target: event.object.labelSnapshot,
    trustedSource,
  };
}

function plainRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function EvidenceValue({ label, value }: { readonly label: string; readonly value: unknown }) {
  return (
    <div>
      <strong>{label}</strong>
      <pre className="audit-evidence-value">{value === undefined ? 'Not recorded' : JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function formatVietnamTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

function severityTone(severity: AdminAuditEventView['severity']) {
  if (severity === 'CRITICAL') return 'danger' as const;
  if (severity === 'REVIEW') return 'warning' as const;
  if (severity === 'NOTICE') return 'info' as const;
  return 'neutral' as const;
}

function outcomeTone(outcome: AdminAuditEventView['outcome']) {
  if (outcome === 'FAILED' || outcome === 'DENIED') return 'danger' as const;
  if (outcome === 'OPENED') return 'warning' as const;
  if (outcome === 'SUCCEEDED' || outcome === 'RESOLVED') return 'success' as const;
  return 'neutral' as const;
}
