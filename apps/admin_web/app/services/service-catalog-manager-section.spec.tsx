import { ServiceCatalogManagerSection } from './service-catalog-manager-section';

describe('ServiceCatalogManagerSection', () => {
  it('keeps service dialog text fields and submit actions on shared AdminForm atoms', () => {
    const section = ServiceCatalogManagerSection({
      dialogMode: 'new',
      editGroup: null,
      groups: [],
      totalGroupCount: 0,
    });

    const classNames = classNamesIn(section);

    expect(textContent(section)).toContain('Add service menu');
    expect(classNames).toContain('admin-form-input');
    expect(classNames).toContain('admin-form-textarea');
    expect(classNames).toContain('admin-form-control-button button button-primary');
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
