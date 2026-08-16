import { readFileSync } from 'node:fs';

const source = readFileSync('app/audit-log/audit-evidence-drawer.tsx', 'utf8');

describe('AuditEvidenceDrawer', () => {
  it('keeps raw evidence byte-faithful after storage redaction', () => {
    expect(source).toContain('JSON.stringify(event.payload, null, 2)');
    expect(source).toContain('Copy raw JSON');
    expect(source).toContain('Redacted by the audit storage policy');
    expect(source).not.toContain('operationalDisplayText');
    expect(source).not.toContain('adminCopy');
  });

  it('uses the shared accessible drawer focus contract and audited evidence download', () => {
    expect(source).toContain('useAdminModalFocus(drawerRef, onClose, returnFocusRef)');
    expect(source).toContain('ariaModal');
    expect(source).toContain("document.body.style.overflow = 'hidden'");
    expect(source).toContain('document.body.style.overflow = previousOverflow');
    expect(source).toContain('Download evidence');
    expect(source).toContain('eventId=${encodeURIComponent(event.id)}');
  });

  it('exposes the identifiers and integrity evidence needed for investigation', () => {
    expect(source).toContain('<dt>Actor key</dt>');
    expect(source).toContain('<dt>Object ID</dt>');
    expect(source).toContain('<dt>Recorded</dt>');
    expect(source).toContain('<dt>Schema version</dt>');
    expect(source).toContain('<dt>Integrity</dt>');
    expect(source).toContain('Copy actor key');
    expect(source).toContain('Copy object ID');
    expect(source).toContain('Copy payload hash');
  });

  it('does not claim an unverified hash is verified', () => {
    expect(source).toContain("event.integrity === 'HASHED' ? 'Hash stored' : 'Legacy · unverified'");
    expect(source).not.toContain("'Verified'");
  });

  it('separates policy evidence and warns when source metadata is untrusted', () => {
    expect(source).toContain('Policy evidence');
    expect(source).toContain('<dt>Event ID</dt>');
    expect(source).toContain('<dt>Policy key</dt>');
    expect(source).toContain('<dt>Policy target</dt>');
    expect(source).toContain('<dt>Environment</dt>');
    expect(source).toContain('<dt>Run ID</dt>');
    expect(source).toContain('<dt>Restoration</dt>');
    expect(source).toContain('Reason wording may resemble automation but remains unverified.');
    expect(source).toContain('scopeBucket');
  });
});
