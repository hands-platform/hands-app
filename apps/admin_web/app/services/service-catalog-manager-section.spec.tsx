import { readFileSync } from 'node:fs';

import { ServiceCatalogManagerSection } from './service-catalog-manager-section';

const sectionSource = readFileSync(new URL('./service-catalog-manager-section.tsx', import.meta.url), 'utf8');

describe('ServiceCatalogManagerSection', () => {
  it('uses shared Vuexy badge atoms for service catalog labels', () => {
    expect(sectionSource).toContain('StatusBadge');
    expect(sectionSource).not.toContain('<span className="pill pill-info">{group.items.length} option(s)</span>');
    expect(sectionSource).not.toContain("<span className={activeCount ? 'pill pill-success' : 'pill pill-neutral'}>");
    expect(sectionSource).not.toContain('<span className="pill pill-neutral">');
    expect(sectionSource).not.toContain('<span className="pill pill-neutral">Not set</span>');
    expect(sectionSource).not.toContain("<span className={service.active ? 'pill pill-success' : 'pill pill-neutral'}>");
  });

  it('uses shared money atoms for service catalog duration prices', () => {
    expect(sectionSource).toContain('MoneyText');
    expect(sectionSource).not.toContain('formatMoney(');
  });

  it('scopes service catalog card typography to direct component slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.service-catalog-manager-card > .admin-section-header {');
    expect(css).toContain('.service-catalog-manager-card > .admin-section-header .button');
    expect(css).toContain('.service-menu-card > .admin-card-header > div > h3');
    expect(css).toContain('.service-menu-language-list > span');
    expect(css).toContain('.service-menu-language-list > span > strong');
    expect(css).toContain('.service-menu-duration-panel > div:first-child > strong');
    expect(css).toContain('.service-menu-duration-panel.is-empty > strong');
    expect(css).not.toContain('.service-menu-card h3');
    expect(css).not.toContain('.service-menu-language-list span');
    expect(css).not.toContain('.service-menu-language-list strong');
    expect(css).not.toContain('.service-menu-duration-panel strong');
    expect(css).not.toContain('.service-catalog-manager-card .admin-filter-panel-header');
    expect(css).not.toContain('.service-catalog-manager-card .admin-section-header');
  });

  it('keeps service dialog text fields and submit actions on shared AdminForm atoms', () => {
    const section = ServiceCatalogManagerSection({
      activeOptionCount: 1,
      dialogMode: 'new',
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
              serviceGroupKey: 'aroma_massage',
            },
          ],
          key: 'aroma_massage',
          label: 'Aroma Massage',
        },
      ],
      payoutRuleCount: 1,
      totalGroupCount: 1,
    });

    const classNames = classNamesIn(section);

    expect(textContent(section)).toContain('Add service menu');
    expect(classNames).toContain('card admin-section service-catalog-manager-card');
    expect(classNames).not.toContain('card admin-filter-panel service-catalog-manager-card');
    expect(classNames).toContain('admin-form-input admin-form-control-labeled admin-form-control-fluid');
    expect(classNames).toContain(
      'admin-form-textarea admin-form-control-labeled admin-form-control-fluid admin-grid-span-2',
    );
    expect(classNames.filter((className) => className.includes('service-menu-dialog-field'))).toEqual([]);
    expect(sectionSource).not.toContain('service-menu-dialog-field');
    expect(classNames).not.toContain('calendar-field');
    expect(sectionSource).not.toContain('className="calendar-field"');
    expect(classNames).toContain('card admin-card service-menu-duration-panel');
    expect(classNames).toContain('card admin-card service-menu-duration-panel is-empty');
    expect(classNames).toContain('ops-section-header admin-section-header admin-card-header');
    expect(classNames).toContain('admin-form-control-button button button-primary');
    expect(classNames).toContain('admin-form-control-link button button-primary');
    expect(classNames).toContain('admin-form-control-link button button-secondary');
    expect(classNames).toContain('admin-form-control-link button button-secondary calendar-icon-button');
    expect(classNames).toContain('admin-form-control-link button button-secondary service-table-action');
    expect(sectionSource).toContain('AdminCard');
    expect(sectionSource).toContain('AdminCardGrid');
    expect(sectionSource).toContain('AdminCardHeader');
    expect(sectionSource).toContain('AdminDrawerSurface');
    expect(sectionSource).toContain('AdminDrawerFormGrid');
    expect(sectionSource).toContain('AdminFormControlLink');
    expect(sectionSource).not.toContain('<div className="admin-filter-panel-body service-menu-card-grid">');
    expect(sectionSource).not.toContain('<a className="button');
    expect(sectionSource).not.toContain('<a aria-label="Close service dialog" className="calendar-icon-button"');
    expect(sectionSource).not.toContain('<form action={createServiceDurationSet} className="calendar-form-grid service-menu-dialog-form">');
    expect(sectionSource).not.toContain('<form action={saveServiceDurationMenu} className="calendar-form-grid service-menu-dialog-form">');
    expect(sectionSource).not.toContain('<aside\n        aria-label={title}\n        aria-modal="true"');
    expect(sectionSource).not.toContain('<div className="card admin-card service-menu-duration-panel');
    expect(sectionSource).not.toContain('<div className="service-menu-card-header">');
  });

  it('uses the shared empty-state atom when no service menus are registered', () => {
    const section = ServiceCatalogManagerSection({
      activeOptionCount: 0,
      dialogMode: null,
      editGroup: null,
      groups: [],
      payoutRuleCount: 0,
      totalGroupCount: 0,
    });

    expect(textContent(section)).toContain('No service menu items are registered.');
    expect(classNamesIn(section)).toContain('empty-state service-menu-empty-state');
    expect(sectionSource).toContain('AdminEmptyState');
    expect(sectionSource).not.toContain('<div className="service-menu-empty-state">');
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
