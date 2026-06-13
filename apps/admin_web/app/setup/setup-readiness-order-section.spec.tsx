import { classNamesIn, hrefsIn, textContent } from './setup-section-test-utils';
import { SetupReadinessOrderSection } from './setup-readiness-order-section';

describe('SetupReadinessOrderSection', () => {
  it('renders live readiness rows and recommended order links', () => {
    const section = SetupReadinessOrderSection({
      readinessChecks: [
        {
          category: 'push',
          name: 'OS push provider',
          status: 'BLOCKED',
          configured: ['PUSH_PROVIDER'],
          missing: ['FIREBASE_PROJECT_ID'],
          invalid: ['provider credentials'],
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

    expect(section.type).toBe('section');
    expect(rendered).toContain('Live readiness');
    expect(rendered).toContain('FCM push service');
    expect(rendered).toContain('Customer and partner push credentials are required.');
    expect(rendered).toContain('Invalid: service credentials');
    expect(rendered).toContain('Secret-safe');
    expect(rendered).toContain('Recommended order');
    expect(rendered).toContain('Step 1');
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
    expect(rendered).toContain('npm.cmd run security:secrets');
    expect(rendered).toContain('npm.cmd run fcm:credentials-check');
    expect(rendered).toContain('npm.cmd run docker:contract');
    expect(rendered).toContain('npm.cmd run fcm:token-smoke -- --dry-run');
    expect(rendered).toContain('npm.cmd run fcm:push-smoke -- --dry-run');
    expect(rendered).toContain('npm.cmd run fcm:push-smoke -- --preflight');
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
