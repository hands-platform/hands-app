export function textContent(value: unknown): string {
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

export function hrefsIn(value: unknown): string[] {
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const expanded = renderKnownComponent(record);
  if (expanded !== null) {
    return hrefsIn(expanded);
  }
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

export function classNamesIn(value: unknown): string[] {
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
  if (
    typeof component === 'function' &&
    [
      'AdminAvatar',
      'AdminAvatarStatusDot',
      'AdminActionCard',
      'AdminCard',
      'AdminDataTable',
      'AdminEmptyState',
      'AdminKpiCard',
      'AdminPersonCell',
      'AdminSection',
      'MoneyText',
      'MetricCard',
    ].includes(component.name)
  ) {
    return (component as RenderableComponent)(readRecord(record?.props) ?? {});
  }
  if (
    typeof component === 'function' &&
    [
      'AdminFormControlButton',
      'AdminFormControlLink',
      'AdminFormInput',
      'AdminFormSelect',
      'AdminFormTextarea',
    ].includes(component.name)
  ) {
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
