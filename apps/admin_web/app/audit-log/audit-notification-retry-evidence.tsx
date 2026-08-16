import { StatusBadge } from '../../components/status-badge';

type JsonRecord = Record<string, unknown>;

export type AuditNotificationRetryEvidence = {
  readonly latestDelivery: {
    readonly attemptedAt: string | null;
    readonly failureCode: string | null;
    readonly provider: string | null;
    readonly pushDeviceEnabled: boolean | null;
    readonly pushDeviceId: string | null;
    readonly pushDeviceLastSeenAt: string | null;
    readonly pushDevicePlatform: string | null;
    readonly status: string | null;
  } | null;
  readonly retryAlreadyDelivered: boolean | null;
  readonly retryJob: {
    readonly attempts: number | null;
    readonly backoffMs: number | null;
    readonly jobName: string | null;
    readonly queueName: string | null;
    readonly queuedJobId: string | null;
  } | null;
  readonly retryRisk: string | null;
};

export function auditNotificationRetryEvidence(payload: unknown): AuditNotificationRetryEvidence | null {
  const metadata = asRecord(payload);
  if (!metadata || !hasRetryEvidence(metadata)) return null;

  const latestDelivery = asRecord(metadata.latestDelivery);
  const retryJob = asRecord(metadata.retryJob);
  return {
    latestDelivery: latestDelivery
      ? {
          attemptedAt: readString(latestDelivery.attemptedAt),
          failureCode: readString(latestDelivery.failureCode),
          provider: readString(latestDelivery.provider),
          pushDeviceEnabled: readBoolean(latestDelivery.pushDeviceEnabled),
          pushDeviceId: maskDeviceId(readString(latestDelivery.pushDeviceId)),
          pushDeviceLastSeenAt: readString(latestDelivery.pushDeviceLastSeenAt),
          pushDevicePlatform: readString(latestDelivery.pushDevicePlatform),
          status: readString(latestDelivery.status),
        }
      : null,
    retryAlreadyDelivered: readBoolean(metadata.retryAlreadyDelivered),
    retryJob: retryJob
      ? {
          attempts: readNumber(retryJob.attempts),
          backoffMs: readNumber(retryJob.backoffMs),
          jobName: readString(retryJob.jobName),
          queueName: readString(retryJob.queueName),
          queuedJobId: readString(retryJob.queuedJobId),
        }
      : null,
    retryRisk: readString(metadata.retryRisk),
  };
}

export function AuditNotificationRetryEvidenceSection({
  evidence,
}: {
  readonly evidence: AuditNotificationRetryEvidence;
}) {
  const delivery = evidence.latestDelivery;
  const job = evidence.retryJob;
  return (
    <section aria-labelledby="audit-notification-retry-title" className="audit-evidence-section audit-notification-retry-evidence">
      <div className="audit-evidence-section-heading">
        <div>
          <h3 id="audit-notification-retry-title">Notification retry evidence</h3>
          <p>Delivery and queue evidence captured when the retry was requested.</p>
        </div>
        <StatusBadge tone={evidence.retryAlreadyDelivered ? 'warning' : 'neutral'}>
          {evidence.retryAlreadyDelivered ? 'Previously delivered' : (evidence.retryRisk ?? 'Risk not recorded')}
        </StatusBadge>
      </div>
      <dl className="audit-evidence-facts audit-notification-retry-facts">
        <EvidenceFact label="Provider" value={delivery?.provider} />
        <EvidenceFact label="Delivery status" value={delivery?.status} />
        <EvidenceFact label="Attempted" value={delivery?.attemptedAt} />
        <EvidenceFact label="Failure code" value={delivery?.failureCode} />
        <EvidenceFact label="Push device" value={delivery?.pushDeviceId} />
        <EvidenceFact label="Device enabled" value={formatBoolean(delivery?.pushDeviceEnabled)} />
        <EvidenceFact label="Device last seen" value={delivery?.pushDeviceLastSeenAt} />
        <EvidenceFact label="Device platform" value={delivery?.pushDevicePlatform} />
        <EvidenceFact label="Queue" value={job?.queueName} />
        <EvidenceFact label="Job" value={job?.jobName} />
        <EvidenceFact label="Attempts" value={formatNumber(job?.attempts)} />
        <EvidenceFact label="Backoff" value={job?.backoffMs === null || job?.backoffMs === undefined ? null : `${job.backoffMs} ms`} />
        <EvidenceFact label="Queued job ID" value={maskIdentifier(job?.queuedJobId)} />
        <EvidenceFact label="Retry risk" value={evidence.retryRisk} />
      </dl>
    </section>
  );
}

function EvidenceFact({ label, value }: { readonly label: string; readonly value: string | null | undefined }) {
  return <div><dt>{label}</dt><dd>{value ?? 'Not recorded'}</dd></div>;
}

function hasRetryEvidence(metadata: JsonRecord) {
  return ['latestDelivery', 'retryJob', 'retryAlreadyDelivered', 'retryRisk'].some((key) => key in metadata);
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatBoolean(value: boolean | null | undefined) {
  return value === null || value === undefined ? null : value ? 'Yes' : 'No';
}

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? null : value.toLocaleString('en-US');
}

function maskDeviceId(value: string | null) {
  if (!value) return null;
  if (/^.{2,4}\.\.\..{2,4}$/.test(value)) return value;
  return maskIdentifier(value);
}

function maskIdentifier(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 8) return `${value.slice(0, 2)}...${value.slice(-2)}`;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
