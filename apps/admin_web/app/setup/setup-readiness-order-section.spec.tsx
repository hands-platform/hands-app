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
    expect(rendered).toContain('OS push service');
    expect(rendered).toContain('Customer and partner push credentials are required.');
    expect(rendered).toContain('Invalid: SMS backend credentials');
    expect(rendered).toContain('Secret-safe');
    expect(rendered).toContain('Recommended order');
    expect(rendered).toContain('Step 1');
    expect(hrefsIn(section)).toContain('#notifications');
  });

  it('shows FCM-specific push checks even when the API returns a broad production command', () => {
    const section = SetupReadinessOrderSection({
      readinessChecks: [
        {
          category: 'push',
          name: 'OS push provider',
          status: 'BLOCKED',
          configured: ['PUSH_PROVIDER'],
          missing: ['FIREBASE_SERVICE_ACCOUNT_JSON'],
          invalid: [],
          detail: 'Current delivery is in-app only.',
          scope: 'DEFERRED',
          operatorAction: 'Add FCM credentials later for Android/iOS OS push E2E.',
          commands: ['npm.cmd run external:check:production'],
          secretSafe: true,
        },
      ],
      recommendedOrder: [],
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('npm.cmd run external:check:push');
    expect(rendered).toContain('npm.cmd run fcm:env-contract');
    expect(rendered).toContain('npm.cmd run fcm:token-smoke -- --dry-run');
    expect(rendered).toContain('npm.cmd run fcm:push-smoke -- --dry-run');
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

function textContent(value: unknown): string {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const expanded = renderKnownComponent(record);
  if (expanded !== null) {
    return textContent(expanded);
  }
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function hrefsIn(value: unknown): string[] {
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

function classNamesIn(value: unknown): string[] {
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const expanded = renderKnownComponent(record);
  if (expanded !== null) {
    return classNamesIn(expanded);
  }
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
}

type RenderableComponent = (props: Record<string, unknown>) => unknown;

function renderKnownComponent(record: Record<string, unknown> | null) {
  const component = record?.type;
  if (typeof component === 'function' && component.name === 'ReadinessRow') {
    return (component as RenderableComponent)(readRecord(record?.props) ?? {});
  }
  return null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
