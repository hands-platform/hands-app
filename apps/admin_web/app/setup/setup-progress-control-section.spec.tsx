import { SetupProgressControlSection } from './setup-progress-control-section';

describe('SetupProgressControlSection', () => {
  it('renders the progress sequence and verified baseline commands', () => {
    const section = SetupProgressControlSection({
      sequence: [
        {
          phase: 'Phase 1',
          title: 'Stabilize core',
          detail: 'Keep the current production path stable.',
          status: 'In progress',
        },
      ],
      verifiedBaseline: ['npm.cmd run typecheck', 'npm.cmd run test'],
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(section.type).toBe('section');
    expect(rendered).toContain('Master progress control');
    expect(rendered).toContain('Roadmap locked');
    expect(rendered).toContain('Stabilize core');
    expect(rendered).toContain('Verified baseline');
    expect(rendered).toContain('2 checks');
    expect(rendered).toContain('npm.cmd run typecheck');
    expect(classNamesIn(section)).toContain('command-copy-row');
    expect(rendered).toContain('docs\\architecture\\master-progress-roadmap.md');
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
  const component = record?.type;
  return typeof component === 'function' && ['CommandCopyRow', 'PathCopyRow'].includes(component.name)
    ? resolveElement((component as RenderableComponent)(props ?? {}))
    : value;
}

type RenderableComponent = (props: Record<string, unknown>) => unknown;

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
