import { ForbiddenException } from '@nestjs/common';

import {
  operationalPolicyAuditContextFromHeaders,
  operationalPolicySmokeSignature,
} from './admin-operational-policy-audit-source';

describe('operational policy audit source', () => {
  const environment = {
    API_SMOKE_AUDIT_SECRET: 'local-smoke-audit-secret',
    NODE_ENV: 'test',
  };

  it('classifies ordinary authenticated requests as operator changes', () => {
    expect(operationalPolicyAuditContextFromHeaders({}, environment)).toEqual({
      environment: 'test',
      source: 'operator',
    });
  });

  it('accepts signed smoke provenance and keeps restoration explicit', () => {
    const signature = operationalPolicySmokeSignature(
      environment.API_SMOKE_AUDIT_SECRET,
      'run-123',
      'test',
      true,
    );

    expect(
      operationalPolicyAuditContextFromHeaders(
        {
          'x-hands-smoke-environment': 'test',
          'x-hands-smoke-restoration': 'true',
          'x-hands-smoke-run-id': 'run-123',
          'x-hands-smoke-signature': signature,
        },
        environment,
      ),
    ).toEqual({
      environment: 'test',
      restoration: true,
      runId: 'run-123',
      source: 'automated_smoke',
    });
  });

  it('rejects browser-spoofable automation headers without a trusted signature', () => {
    expect(() =>
      operationalPolicyAuditContextFromHeaders(
        {
          'x-hands-smoke-environment': 'test',
          'x-hands-smoke-restoration': 'false',
          'x-hands-smoke-run-id': 'spoofed-run',
          'x-hands-smoke-signature': 'not-valid',
        },
        environment,
      ),
    ).toThrow(ForbiddenException);
  });
});
