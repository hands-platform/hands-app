import { readFileSync } from 'node:fs';

import type { AdminProvider } from '../../lib/admin-api';
import { DEFAULT_PROVIDER_OPS_POLICY } from './partner-list-ops';
import { PartnerOpsReadinessCell } from './partner-ops-readiness-cell';

describe('PartnerOpsReadinessCell', () => {
  it('uses the shared Vuexy admin card surface for marketplace eligibility', () => {
    const source = readFileSync('app/partners/partner-ops-readiness-cell.tsx', 'utf8');

    expect(source).toContain('AdminCard');
    expect(source).toContain('AdminSectionHeader');
    expect(source).not.toContain('className="card admin-mt-10 admin-p-12"');
    expect(source).not.toContain('<div className="ops-section-header">');
  });

  it('uses shared Vuexy badge atoms instead of raw ops readiness pill spans', () => {
    const source = readFileSync('app/partners/partner-ops-readiness-cell.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className={`pill ${partnerListActionPillClass(action.tone)}`}>{action.status}</span>');
    expect(source).not.toContain('className={`pill ${partnerOpsBadgePillClass(badge.tone)}`}');
    expect(source).not.toContain('<span className="pill pill-success">No blocking issues</span>');
    expect(source).not.toContain('<span className={`pill ${issue.severity === \'high\' ? \'pill-danger\' : \'pill-warn\'}`} key={issue.label}>');
    expect(source).not.toContain('<span className="pill pill-info">+{issues.length - 5} more</span>');
    expect(source).not.toContain('<span className={`pill ${eligibility.eligible ? \'pill-success\' : \'pill-warn\'}`}>');
    expect(source).not.toContain('<span className="pill pill-info">Radius: {formatDistanceMeters(opsPolicy.backupRadiusMeters)}</span>');
    expect(source).not.toContain('className={`pill ${blocker.severity === \'hard\' ? \'pill-danger\' : \'pill-warn\'}`}');
  });

  it('renders next action, readiness badges, issue pills, action hint, eligibility, and open report link', () => {
    const cell = PartnerOpsReadinessCell({
      actionHint: 'Partner is ready for direct requests and marketplace matching.',
      eligibility: {
        blockers: [
          { label: 'push missing', severity: 'soft' },
          { label: 'bank account', severity: 'hard' },
        ],
        canParticipateInMarketplace: false,
        canReceiveMarketplaceAlerts: false,
        canViewMarketplace: true,
        detail: 'Marketplace matching needs the listed blockers resolved.',
        eligible: false,
        operatorAction: 'Fix blockers before relying on marketplace participation.',
        partnerAppMessage: null,
        walletBalance: 0,
      },
      hasOpenControl: true,
      issues: [
        { label: 'KYC PENDING_REVIEW', severity: 'high' },
        { label: 'push missing', severity: 'medium' },
      ],
      opsBadges: [
        {
          detail: 'Partner can receive a preferred direct booking now.',
          label: 'Direct request ready',
          tone: 'success',
        },
        {
          detail: 'Dispatch participation needs policy repair.',
          label: 'Dispatch repair',
          tone: 'warn',
        },
      ],
      opsPolicy: DEFAULT_PROVIDER_OPS_POLICY,
      provider: {
        id: 'partner-ready',
      } as AdminProvider,
      nextAction: {
        detail: 'KYC status is PENDING_REVIEW.',
        operatorAction: 'Approve or reject KYC with a clear reason.',
        priority: 90,
        status: 'KYC',
        tone: 'blocked',
      },
    });

    const rendered = normalizedText(cell);

    expect(rendered).toContain('KYC');
    expect(rendered).toContain('KYC status is PENDING_REVIEW.');
    expect(rendered).toContain('Approve or reject KYC with a clear reason.');
    expect(rendered).toContain('Direct request ready');
    expect(rendered).toContain('Dispatch repair');
    expect(rendered).toContain('KYC PENDING_REVIEW');
    expect(rendered).toContain('push missing');
    expect(rendered).toContain('Partner is ready for direct requests and marketplace matching.');
    expect(rendered).toContain('Marketplace participation eligibility');
    expect(rendered).toContain('Marketplace matching needs the listed blockers resolved.');
    expect(rendered).toContain('Excluded');
    expect(rendered).toContain('Radius:');
    expect(rendered).toContain('First window:');
    expect(rendered).toContain('Location:');
    expect(rendered).toContain('Fix blockers before relying on marketplace participation.');
    expect(rendered).toContain('Open reports');
    expect(hrefsIn(cell)).toEqual(expect.arrayContaining(['/partners?review=reports&q=partner-ready']));
    expect(classNamesIn(cell)).toEqual(
      expect.arrayContaining([
        'pill pill-danger',
        'pill pill-warn',
        'pill pill-success',
        'admin-form-control-link button button-secondary admin-inline-action admin-mt-8',
      ]),
    );
  });

  it('renders empty issue state and candidate-ready eligibility', () => {
    const cell = PartnerOpsReadinessCell({
      actionHint: 'Partner is ready.',
      eligibility: {
        blockers: [],
        canParticipateInMarketplace: true,
        canReceiveMarketplaceAlerts: true,
        canViewMarketplace: true,
        detail: 'Can receive marketplace alerts.',
        eligible: true,
        operatorAction: 'Confirm booking radius before inviting.',
        partnerAppMessage: null,
        walletBalance: 0,
      },
      hasOpenControl: false,
      issues: [],
      opsBadges: [],
      opsPolicy: DEFAULT_PROVIDER_OPS_POLICY,
      provider: {
        id: 'partner-clear',
      } as AdminProvider,
      nextAction: {
        detail: 'No action required.',
        operatorAction: 'Keep monitoring.',
        priority: 0,
        status: 'READY',
        tone: 'done',
      },
    });

    const rendered = normalizedText(cell);

    expect(rendered).toContain('No blocking issues');
    expect(rendered).toContain('Candidate ready');
    expect(rendered).not.toContain('Open reports');
  });
});

function textContent(value: unknown): string {
  value = resolveElement(value);
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
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function normalizedText(value: unknown): string {
  return textContent(value).replace(/\s+/g, ' ').trim();
}

function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
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
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
