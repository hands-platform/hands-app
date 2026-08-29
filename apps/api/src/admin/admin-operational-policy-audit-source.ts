import { createHmac, timingSafeEqual } from 'node:crypto';

import { ForbiddenException } from '@nestjs/common';

export type OperationalPolicyAuditContext =
  | {
      environment: string;
      source: 'operator';
    }
  | {
      environment: string;
      restoration: boolean;
      runId: string;
      source: 'automated_smoke';
    };

type HeaderValue = string | string[] | undefined;

type OperationalPolicyAuditEnvironment = {
  API_SMOKE_AUDIT_SECRET?: string;
  JWT_ACCESS_SECRET?: string;
  NODE_ENV?: string;
};

const SMOKE_RUN_ID_HEADER = 'x-hands-smoke-run-id';
const SMOKE_ENVIRONMENT_HEADER = 'x-hands-smoke-environment';
const SMOKE_RESTORATION_HEADER = 'x-hands-smoke-restoration';
const SMOKE_SIGNATURE_HEADER = 'x-hands-smoke-signature';

export function operationalPolicyAuditContextFromHeaders(
  headers: Record<string, HeaderValue>,
  environment: OperationalPolicyAuditEnvironment = process.env,
): OperationalPolicyAuditContext {
  const currentEnvironment = normalizeEnvironment(environment.NODE_ENV);
  const runId = readHeader(headers, SMOKE_RUN_ID_HEADER);
  const requestedEnvironment = readHeader(headers, SMOKE_ENVIRONMENT_HEADER);
  const restorationValue = readHeader(headers, SMOKE_RESTORATION_HEADER);
  const signature = readHeader(headers, SMOKE_SIGNATURE_HEADER);
  const hasAutomationHeader = Boolean(runId || requestedEnvironment || restorationValue || signature);

  if (!hasAutomationHeader) {
    return { environment: currentEnvironment, source: 'operator' };
  }
  if (currentEnvironment === 'production') {
    throw new ForbiddenException('Operational policy smoke automation is disabled in production');
  }

  const restoration = restorationValue === 'true';
  const normalizedRunId = runId?.trim() ?? '';
  const normalizedEnvironment = normalizeEnvironment(requestedEnvironment);
  const secret = trustedSmokeAuditSecret(environment);
  if (
    !normalizedRunId ||
    normalizedRunId.length > 128 ||
    !signature ||
    !secret ||
    !safeSignatureMatch(
      signature,
      operationalPolicySmokeSignature(secret, normalizedRunId, normalizedEnvironment, restoration),
    )
  ) {
    throw new ForbiddenException('Untrusted operational policy automation audit context');
  }

  return {
    environment: normalizedEnvironment,
    restoration,
    runId: normalizedRunId,
    source: 'automated_smoke',
  };
}

export function operationalPolicySmokeSignature(
  secret: string,
  runId: string,
  environment: string,
  restoration: boolean,
) {
  return createHmac('sha256', secret)
    .update(`${runId}\n${environment}\n${restoration ? 'restore' : 'change'}`)
    .digest('hex');
}

function trustedSmokeAuditSecret(environment: OperationalPolicyAuditEnvironment) {
  const explicit = environment.API_SMOKE_AUDIT_SECRET?.trim();
  if (explicit) return explicit;
  if (environment.NODE_ENV === 'production') return '';
  return environment.JWT_ACCESS_SECRET?.trim() || 'dev-access-secret';
}

function normalizeEnvironment(value: string | undefined) {
  return value?.trim() || 'development';
}

function readHeader(headers: Record<string, HeaderValue>, name: string) {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function safeSignatureMatch(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}
