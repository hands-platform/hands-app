import { readFileSync } from 'node:fs';

import { ServiceCatalogManagerSection } from './service-catalog-manager-section';

const sectionSource = readFileSync(new URL('./service-catalog-manager-section.tsx', import.meta.url), 'utf8');
const editorSource = readFileSync(new URL('./service-catalog-editor-form.tsx', import.meta.url), 'utf8');
const drawerSource = readFileSync(new URL('./service-catalog-drawer-shell.tsx', import.meta.url), 'utf8');
const refreshSource = readFileSync(new URL('./service-catalog-refresh-button.tsx', import.meta.url), 'utf8');

describe('ServiceCatalogManagerSection', () => {
  it('uses shared Vuexy badge atoms for service catalog labels', () => {
    expect(sectionSource).toContain('StatusBadge');
    expect(sectionSource).not.toContain('<span className="pill pill-info">{group.items.length} option(s)</span>');
    expect(sectionSource).not.toContain("<span className={activeCount ? 'pill pill-success' : 'pill pill-neutral'}>");
    expect(sectionSource).not.toContain('<span className="pill pill-neutral">');
    expect(sectionSource).not.toContain('<span className="pill pill-neutral">Not set</span>');
    expect(sectionSource).not.toContain("<span className={service.active ? 'pill pill-success' : 'pill pill-neutral'}>");
    expect(sectionSource).not.toContain('service-menu-duration-panel is-empty');
  });

  it('uses shared money atoms for service catalog duration prices', () => {
    expect(sectionSource).toContain('MoneyText');
    expect(sectionSource).not.toContain('formatMoney(');
  });

  it('uses a compact health strip and comparison table instead of catalog cards', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.service-catalog-manager-card > .admin-section-header {');
    expect(css).toContain('.service-catalog-manager-card > .admin-section-header .button');
    expect(css).toContain('.service-catalog-health-strip {');
    expect(sectionSource.indexOf('label="Public anomalies"')).toBeLessThan(
      sectionSource.indexOf('label="Live service groups"'),
    );
    expect(sectionSource).toContain('priority="primary"');
    expect(sectionSource).toContain('valueKind="evidence"');
    expect(css).toContain('.service-catalog-health-fact.is-value-evidence dd {');
    expect(sectionSource).toContain("tone={health.anomalyCount ? 'danger' : 'neutral'}");
    expect(css).toContain('.service-catalog-page .service-catalog-table {');
    expect(css).toMatch(/\.service-catalog-page \.service-catalog-table \{[^}]*table-layout: fixed;/s);
    expect(css).toMatch(/\.service-catalog-page \.service-catalog-table \{[^}]*min-width: 1080px;/s);
    expect(css).toContain('.service-catalog-identity-cell {');
    expect(css).toMatch(
      /\.service-catalog-page \.table\.vuexy-data-table\.service-catalog-table th,[\s\S]*?padding-left: 8px;[\s\S]*?padding-right: 8px;/,
    );
    expect(css).toMatch(
      /\.service-catalog-table th:nth-child\(1\),[\s\S]*?min-width: 175px;[\s\S]*?width: 175px;/,
    );
    expect(css).toMatch(
      /\.service-catalog-table th:nth-child\(5\),[\s\S]*?min-width: 165px;[\s\S]*?width: 165px;/,
    );
    expect(css).toMatch(
      /\.service-catalog-identity-cell strong,[\s\S]*?overflow-wrap: anywhere;[\s\S]*?white-space: normal;/,
    );
    expect(css).toContain('.service-catalog-cell-stack {');
    expect(css).toMatch(
      /\.service-menu-dialog > \.service-menu-dialog-shell \{[^}]*grid-template-rows: auto minmax\(0, 1fr\);/s,
    );
    expect(drawerSource).toContain('className="service-menu-dialog-shell"');
    expect(sectionSource).toContain('returnFocusHref="/services?dialog=new"');
    expect(editorSource).toContain('useAdminModalFocus(dialogRef, onCancel, returnFocusRef)');
    expect(editorSource).toContain('data-service-catalog-review-intent="PUBLISH"');
    expect(editorSource).toContain('if (currentTrigger?.isConnected) currentTrigger.focus({ preventScroll: true })');
    expect(sectionSource).toContain('className="service-catalog-cell-stack service-catalog-price-cell-content"');
    expect(css).not.toContain('.service-menu-card h3');
    expect(css).not.toContain('.service-menu-card-grid {');
    expect(css).not.toContain('.service-menu-language-list');
    expect(css).not.toContain('.service-menu-duration-panel');
    expect(css).not.toContain('.service-catalog-manager-card .admin-filter-panel-header');
    expect(css).not.toContain('.service-catalog-manager-card .admin-section-header');
  });

  it('keeps the manager actions and service editor on shared AdminForm atoms', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    const section = ServiceCatalogManagerSection({
      dataAvailable: true,
      dialogMode: null,
      editGroup: null,
      groups: [
        {
          items: [
            {
              active: true,
              basePrice: 300000,
              displayOrder: 1,
              durationMin: 60,
              id: 'service-aroma-60',
              name: 'Aroma Massage',
              payoutRules: [
                {
                  active: true,
                  currency: 'VND',
                  customerPrice: 300000,
                  id: 'payout-aroma-60',
                  otherCostAmount: 0,
                  providerPayoutAmount: 210000,
                  serviceId: 'service-aroma-60',
                  vatBps: 0,
                },
              ],
              priceStep: 100000,
              publicationStatus: 'PUBLISHED',
              serviceGroupKey: 'aroma_massage',
            },
          ],
          key: 'aroma_massage',
          label: 'Aroma Massage',
        },
      ],
      health: healthFixture({ liveEnViReadyGroupCount: 1, liveGroupCount: 1, liveOptionCount: 1 }),
    });

    const classNames = classNamesIn(section);

    expect(textContent(section)).toContain('Catalog control');
    expect(classNames).toContain('card admin-section service-catalog-manager-card');
    expect(classNames).not.toContain('card admin-filter-panel service-catalog-manager-card');
    expect(classNames).toContain('ops-section-header admin-section-header');
    expect(classNames).toContain('admin-form-control-link button button-primary');
    expect(refreshSource).toContain('className="button-secondary"');
    expect(classNames).toContain('admin-form-control-link button button-secondary service-table-action');
    expect(sectionSource).toContain('ServiceCatalogDrawerShell');
    expect(drawerSource).toContain('AdminDrawerSurface');
    expect(drawerSource).toContain('useAdminModalFocus');
    expect(drawerSource).toContain('useEffect(() => {');
    expect(drawerSource).toContain("window.confirm('Discard unsaved service catalog changes?')");
    expect(drawerSource).toContain('router.replace(returnHref, { scroll: false })');
    expect(editorSource).toContain('AdminDrawerFormGrid');
    expect(editorSource).toContain('AdminFormInput');
    expect(editorSource).toContain('AdminFormTextarea');
    expect(editorSource).toContain('AdminFormCheckbox');
    expect(editorSource).toContain('AdminFormControlButton');
    expect(editorSource).toContain('value="SAVE_DRAFT"');
    expect(editorSource).toContain("type CatalogIntent = 'PUBLISH' | 'HIDE' | 'ARCHIVE'");
    expect(editorSource).toContain('value={intent}');
    expect(editorSource).toContain('publishBlockers.length');
    expect(editorSource).toContain('prepareMutation');
    expect(editorSource).toContain('CatalogConfirmationDialog');
    expect(editorSource).toContain('CatalogPublishChangeSet');
    expect(editorSource).toContain('Gross HANDS fee');
    expect(editorSource).toContain('No monetary change');
    expect(editorSource).toContain('Partner payout cannot exceed customer price.');
    expect(editorSource).toContain('disabled={pending || pricingConflict}');
    expect(editorSource).toContain('disabled={pending || publishBlockers.length > 0}');
    expect(editorSource).toContain('Localized app preview');
    expect(editorSource).toContain('Customer app · English');
    expect(editorSource).toContain('Partner app · Vietnamese');
    expect(editorSource).toContain('Draft gross HANDS fee');
    expect(sectionSource).toContain('aria-label={`Edit ${group.label}`}');
    expect(sectionSource).toContain('<Edit3 aria-hidden="true" size={15} />');
    expect(sectionSource).toContain('AdminFormControlLink');
    expect(sectionSource).not.toContain('admin-filter-panel-body');
    expect(editorSource).not.toContain('service-menu-dialog-field');
    expect(editorSource).not.toContain('className="calendar-field"');
    expect(sectionSource).not.toContain('<a className="button');
    expect(sectionSource).not.toContain('<a aria-label="Close service dialog" className="calendar-icon-button"');
    expect(sectionSource).not.toContain('<form action={createServiceDurationSet} className="calendar-form-grid service-menu-dialog-form">');
    expect(sectionSource).not.toContain('<form action={saveServiceDurationMenu} className="calendar-form-grid service-menu-dialog-form">');
    expect(sectionSource).not.toContain('<aside\n        aria-label={title}\n        aria-modal="true"');
    expect(sectionSource).not.toContain('<div className="card admin-card service-menu-duration-panel');
    expect(sectionSource).not.toContain('<div className="service-menu-card-header">');
    expect(css).toMatch(
      /\.service-catalog-review-delta dd \{[^}]*overflow-wrap: anywhere;/s,
    );
    expect(css).toMatch(/\.service-menu-dialog-footer \{[^}]*position: sticky;/s);
    expect(css).toMatch(/\.service-menu-dialog-footer \.button \{[^}]*white-space: nowrap;/s);
    expect(css).toMatch(/\.service-menu-dialog \.calendar-drawer-body \{[^}]*scroll-padding-bottom: 160px;/s);
  });

  it('shows a recovery notice instead of an empty drawer for an invalid group deep link', () => {
    const section = ServiceCatalogManagerSection({
      dataAvailable: true,
      dialogMode: 'edit',
      editGroup: null,
      groups: [],
      health: healthFixture(),
      invalidEditGroupKey: 'missing_group',
    });

    expect(textContent(section)).toContain('Service group not found.');
    expect(textContent(section)).toContain('Back to catalog');
  });

  it('renders health failure separately from a true empty catalog', () => {
    const section = ServiceCatalogManagerSection({
      dataAvailable: true,
      dialogMode: null,
      editGroup: null,
      groups: [],
      health: null,
      healthAvailable: false,
    });

    expect(textContent(section)).toContain('Public catalog health could not be checked.');
    expect(textContent(section)).not.toContain('Customer app projection healthy');
  });

  it('renders exact scoped evidence without exposing a full audit link by default', () => {
    const section = ServiceCatalogManagerSection({
      dataAvailable: true,
      dialogMode: null,
      editGroup: null,
      evidence: {
        groupKey: 'aroma_massage',
        items: [
          {
            action: 'service_catalog.published',
            actor: { email: 'operator@hands.vn', fullName: 'Service Operator' },
            createdAt: '2026-08-28T03:00:00.000Z',
            id: 'audit-service-1',
            target: 'service_group:aroma_massage',
          },
        ],
        target: 'service_group:aroma_massage',
      },
      evidenceGroupKey: 'aroma_massage',
      groups: [],
      health: healthFixture(),
    });

    expect(textContent(section)).toContain('Service change evidence');
    expect(textContent(section)).toContain('Service Operator');
    expect(textContent(section)).not.toContain('Open full audit log');
  });

  it('uses the shared empty-state atom when no service menus are registered', () => {
    const section = ServiceCatalogManagerSection({
      dataAvailable: true,
      dialogMode: null,
      editGroup: null,
      groups: [],
      health: healthFixture(),
    });

    expect(textContent(section)).toContain('No operational service groups are registered.');
    expect(classNamesIn(section)).toContain('empty-state service-menu-empty-state');
    expect(sectionSource).toContain('AdminEmptyState');
    expect(sectionSource).not.toContain('<div className="service-menu-empty-state">');
  });
});

function healthFixture(overrides: Partial<{
  anomalyCount: number;
  blockedOptionCount: number;
  currentPayoutRuleCount: number;
  historicalPayoutRuleCount: number;
  lastPublishedAt: string | null;
  lastPublishedById: string | null;
  lastPublishedByLabel: string;
  lastPublishedEvidenceId: string | null;
  liveEnViReadyGroupCount: number;
  liveGroupCount: number;
  liveOptionCount: number;
  workingDraftCount: number;
}> = {}) {
  return {
    anomalyCount: 0,
    auditTarget: null,
    blockedOptionCount: 0,
    checkedAt: '2026-08-14T00:00:00.000Z',
    currentPayoutRuleCount: 0,
    historicalPayoutRuleCount: 0,
    lastPublishedAt: null,
    lastPublishedById: null,
    lastPublishedByLabel: 'No publication recorded',
    lastPublishedEvidenceId: null,
    lastPublishedGroupKey: null,
    lastPublishedProvenance: 'NONE' as const,
    liveEnViReadyGroupCount: 0,
    liveGroupCount: 0,
    liveOptionCount: 0,
    status: 'healthy' as const,
    workingDraftCount: 0,
    ...overrides,
  };
}

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
  if (
    typeof record?.type === 'function' &&
    record.type.name === 'ServiceCatalogRefreshButton'
  ) {
    return value;
  }
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
