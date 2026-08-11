import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  PartnerDetailNeedsActionSection,
  PartnerDetailWorkReadinessSection,
} from './partner-detail-operational-status-section';
import type { PartnerOperationalCheck } from './partner-detail-operational-status-model';

const checks: PartnerOperationalCheck[] = [
  {
    actionLabel: 'Review KYC evidence',
    detail: 'One identity document is missing.',
    domain: 'APPROVAL',
    href: '#kyc-title',
    id: 'kyc',
    open: true,
    status: 'PENDING',
    title: 'KYC and documents',
    tone: 'pending',
  },
  {
    actionLabel: 'No action',
    detail: 'One service can be booked.',
    domain: 'WORK',
    id: 'services',
    open: false,
    status: 'READY',
    title: 'Bookable services',
    tone: 'done',
  },
];

describe('partner detail operational status sections', () => {
  it('shows only unresolved checks in Needs action', () => {
    const markup = renderToStaticMarkup(<PartnerDetailNeedsActionSection checks={checks} />);
    expect(markup).toContain('Needs action');
    expect(markup).toContain('1 open');
    expect(markup).toContain('KYC and documents');
    expect(markup).not.toContain('Bookable services');
  });

  it('shows all work checks in one readiness table', () => {
    const markup = renderToStaticMarkup(<PartnerDetailWorkReadinessSection checks={checks} />);
    expect(markup).toContain('Readiness checks');
    expect(markup).toContain('Bookable services');
    expect(markup).toContain('Ready');
    expect(markup).not.toContain('<strong>Work</strong>');
  });
});
