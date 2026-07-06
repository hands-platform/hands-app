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

export function normalizedText(value: unknown): string {
  return textContent(value).replace(/\s+/g, ' ').trim();
}

export function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
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

export function headingTextsIn(value: unknown): string[] {
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(headingTextsIn);
  }

  const record = readRecord(value);
  const expanded = renderKnownComponent(record);
  if (expanded !== null) {
    return headingTextsIn(expanded);
  }
  const props = readRecord(record?.props);
  const type = typeof record?.type === 'string' ? record.type : '';
  const ownHeading =
    /^h[1-6]$/.test(type) ? [textContent(props?.children).replace(/\s+/g, ' ').trim()] : [];
  return [...ownHeading, ...headingTextsIn(props?.children)];
}

export type TestButton = {
  readonly props?: {
    readonly children?: unknown;
    readonly onClick?: () => void;
  };
};

export function buttonsIn(value: unknown): TestButton[] {
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(buttonsIn);
  }

  const record = readRecord(value);
  const expanded = renderKnownComponent(record);
  if (expanded !== null) {
    return buttonsIn(expanded);
  }
  const props = readRecord(record?.props);
  const current = record?.type === 'button' ? [value as TestButton] : [];
  return [...current, ...buttonsIn(props?.children)];
}

export function classNamesIn(value: unknown): string[] {
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
  const expanded = renderKnownComponent(record);
  if (expanded !== null) {
    return resolveElement(expanded);
  }
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
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
      'AdminDataTable',
      'AdminEmptyState',
      'AdminFormControlButton',
      'AdminFormSelect',
      'AdminFormTextarea',
      'AdminKpiCard',
      'AdminMetricGrid',
      'AdminPageTemplate',
      'AdminPersonCell',
      'AdminSection',
      'AdminSectionHeader',
      'AdminTableSection',
      'AdminTaskCard',
      'AdminTraceSummary',
      'MetricCard',
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
