type RenderableComponent = (props: Record<string, unknown>) => unknown;

export function textContent(value: unknown): string {
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
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
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

export function ariaCurrentValuesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(ariaCurrentValuesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const ariaCurrent = typeof props?.['aria-current'] === 'string' ? [props['aria-current']] : [];
  return [...ariaCurrent, ...ariaCurrentValuesIn(props?.children)];
}

export function elementTypesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(elementTypesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const type = typeof record?.type === 'string' ? [record.type] : [];
  return [...type, ...elementTypesIn(props?.children)];
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  const component = record?.type;
  if (typeof component === 'function' && component.name === 'ClientActionDropdownSurface') {
    return {
      props: {
        children: {
          props: {
            children: props?.children,
            className: joinClassNames('admin-action-menu', props?.menuClassName),
          },
          type: 'div',
        },
        className: joinClassNames('admin-action-dropdown', props?.className),
      },
      type: 'div',
    };
  }
  if (typeof component !== 'function' || component.name === 'CommandCopyButton') {
    return value;
  }
  return resolveElement((component as RenderableComponent)(props ?? {}));
}

function joinClassNames(...values: unknown[]) {
  return values.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
