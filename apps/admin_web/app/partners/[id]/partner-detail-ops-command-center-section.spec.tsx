import { readFileSync } from 'node:fs';

describe('PartnerDetailOpsCommandCenterSection', () => {
  it('uses the shared Vuexy admin card surface for the section shell', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-ops-command-center-section.tsx', 'utf8');

    expect(source).toContain('AdminCard');
    expect(source).not.toContain('className="card admin-mb-16"');
  });
});
