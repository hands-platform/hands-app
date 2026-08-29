import { renderToStaticMarkup } from 'react-dom/server';

import { PartnerDetailFullRecordIndexSection } from './partner-detail-full-record-index-section';

describe('PartnerDetailFullRecordIndexSection', () => {
  it('renders a bounded workspace index and preserves approval queue context', () => {
    const markup = renderToStaticMarkup(
      <PartnerDetailFullRecordIndexSection
        approvalOpenCount={2}
        bookingRecordCount={4}
        canViewDiagnostics
        decisionQueue="approval-pending"
        financeOpenCount={1}
        partnerId="partner-1"
        workOpenCount={3}
      />,
    );

    expect(markup).toContain('Partner work areas');
    expect(markup).toContain('6 open');
    expect(markup).toContain('Approval &amp; profile');
    expect(markup).toContain('Work readiness');
    expect(markup).toContain('Booking evidence');
    expect(markup).toContain('Money');
    expect(markup).toContain('History &amp; controls');
    expect(markup).toContain('Diagnostics');
    expect(markup).toContain('/partners/partner-1?section=dossier&amp;decisionQueue=approval-pending');
    expect(markup).toContain(
      '/partners/partner-1?section=dossier&amp;dossier=finance&amp;decisionQueue=approval-pending',
    );
    expect(markup).not.toContain('Profile and KYC');
    expect(markup).not.toContain('Operations timeline');
  });

  it('omits Developer diagnostics for ordinary operators', () => {
    const markup = renderToStaticMarkup(
      <PartnerDetailFullRecordIndexSection
        approvalOpenCount={0}
        bookingRecordCount={0}
        canViewDiagnostics={false}
        financeOpenCount={0}
        partnerId="partner-1"
        workOpenCount={0}
      />,
    );

    expect(markup).toContain('No action');
    expect(markup).not.toContain('Diagnostics');
  });

  it('does not count or label policy-dependent work readiness when policy data is unavailable', () => {
    const markup = renderToStaticMarkup(
      <PartnerDetailFullRecordIndexSection
        approvalOpenCount={1}
        bookingRecordCount={4}
        canViewDiagnostics={false}
        financeOpenCount={2}
        operationalPolicyAvailable={false}
        partnerId="partner-1"
        workOpenCount={5}
      />,
    );

    expect(markup).toContain('3 open');
    expect(markup).not.toContain('8 open');
    expect(markup).toContain('Operational policy data is unavailable');
    expect(markup).toContain('Unavailable');
  });
});
