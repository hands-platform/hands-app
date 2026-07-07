import { readFileSync } from 'node:fs';

import { classNamesIn, hrefsIn, textContent } from './setup-section-test-utils';
import { SetupReadinessOrderSection } from './setup-readiness-order-section';

describe('SetupReadinessOrderSection', () => {
  it('uses shared badge atoms instead of raw pill markup', () => {
    const source = readFileSync(new URL('./setup-readiness-order-section.tsx', import.meta.url), 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).toContain('AdminDetailGrid');
    expect(source).toContain('AdminFilterChipGroup');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className="pill pill-warn">BLOCKED</span>');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain('<span className={`pill ${isCurrentStage ?');
    expect(source).not.toContain('<span className="pill pill-neutral">Secret-safe</span>');
    expect(source).not.toContain('<a className="pill pill-neutral"');
    expect(source).not.toContain('<span className={`pill ${readinessStatusPillClass(check.status)}`}>');
    expect(source).not.toContain('<section className="detail-grid">');
  });

  it('renders live readiness rows and recommended order links', () => {
    const section = SetupReadinessOrderSection({
      readinessChecks: [
        {
          category: 'push',
          name: 'OS push provider',
          status: 'BLOCKED',
          configured: ['PUSH_PROVIDER'],
          missing: ['FIREBASE_PROJECT_ID'],
          invalid: ['provider credentials', 'FIREBASE_PROJECT_ID_MISMATCH'],
          detail: 'Customer and provider push credentials are required.',
          scope: 'CURRENT_STAGE',
          operatorAction: 'Fill provider credentials outside Git.',
          commands: ['npm.cmd run external:check:push'],
          secretSafe: true,
        },
      ],
      recommendedOrder: [
        {
          id: 'notifications',
          title: 'FCM push',
          purpose: 'Verify push delivery after credentials are filled.',
        },
      ],
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(section.type.name).toBe('AdminDetailGrid');
    expect(rendered).toContain('Live readiness');
    expect(rendered).toContain('FCM push service');
    expect(rendered).toContain('Customer and partner push credentials are required.');
    expect(rendered).toContain('Invalid: service credentials');
    expect(rendered).toContain('Firebase Admin project does not match mobile app project');
    expect(rendered).toContain('Secret-safe');
    expect(rendered).toContain('Recommended order');
    expect(rendered).toContain('Step 1');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section',
        'ops-section-header admin-section-header',
      ]),
    );
    expect(classNamesIn(section)).toContain('command-copy-row');
    expect(hrefsIn(section)).toContain('#notifications');
  });

  it('shows FCM-specific push checks even when the API returns a broad production command', () => {
    const section = SetupReadinessOrderSection({
      readinessChecks: [
        {
          category: 'push',
          name: 'FCM push service',
          status: 'BLOCKED',
          configured: ['PUSH_PROVIDER'],
          missing: ['FIREBASE_SERVICE_ACCOUNT_JSON'],
          invalid: [],
          detail: 'Current delivery is in-app only.',
          scope: 'DEFERRED',
          operatorAction: 'Add FCM credentials later for Android/iOS FCM push E2E.',
          commands: ['npm.cmd run external:check:production'],
          secretSafe: true,
        },
      ],
      recommendedOrder: [],
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('npm.cmd run external:check:push');
    expect(rendered).toContain('npm.cmd run fcm:env-contract');
    expect(rendered).toContain('npm.cmd run notifications:push-data-contract');
    expect(rendered).toContain(
      'npm.cmd run fcm:credentials:install -- -SourcePath C:\\Users\\<you>\\Downloads\\<firebase-admin-key>.json -CheckOnly',
    );
    expect(rendered).toContain('npm.cmd run security:secrets');
    expect(rendered).toContain('npm.cmd run fcm:credentials-check');
    expect(rendered).toContain('npm.cmd run docker:contract');
    expect(rendered).toContain('npm.cmd run fcm:token-smoke -- --dry-run');
    expect(rendered).toContain('npm.cmd run fcm:token-recovery-smoke -- --dry-run');
    expect(rendered).toContain('npm.cmd run fcm:token-recovery-smoke');
    expect(rendered).toContain('npm.cmd run fcm:push-smoke -- --dry-run');
    expect(rendered).toContain('npm.cmd run fcm:push-smoke -- --preflight');
    expect(rendered).toContain('npm.cmd run fcm:push-smoke -- --preflight --use-registered-device');
    expect(rendered).not.toContain('npm.cmd run external:check:production');
  });

  it('uses an info pill for partial readiness checks', () => {
    const section = SetupReadinessOrderSection({
      readinessChecks: [
        {
          category: 'storage',
          name: 'File storage',
          status: 'PARTIAL',
          configured: ['S3_ENDPOINT'],
          missing: ['S3_PUBLIC_BASE_URL'],
          invalid: [],
          detail: 'Storage is partially configured.',
          scope: 'DEFERRED',
          commands: [],
          secretSafe: true,
        },
      ],
      recommendedOrder: [],
    });

    expect(classNamesIn(section)).toContain('pill pill-info');
  });

  it('renders the API unavailable state when checks are empty', () => {
    const section = SetupReadinessOrderSection({
      readinessChecks: [],
      recommendedOrder: [],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Readiness API unavailable');
    expect(rendered).toContain('Start the HANDS API and refresh this page.');
    expect(rendered).toContain('BLOCKED');
  });
});
