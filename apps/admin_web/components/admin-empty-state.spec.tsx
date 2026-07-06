import { AdminEmptyState } from './admin-empty-state';

describe('AdminEmptyState', () => {
  it('renders the shared table empty copy without adding a nested frame by default', () => {
    const emptyState = AdminEmptyState({
      message: 'No partner command is currently queued.',
    });

    expect(emptyState.type).toBe(Symbol.for('react.fragment'));
    expect(emptyState.props.children[0].props).toMatchObject({
      children: 'No records found',
    });
    expect(emptyState.props.children[1].props).toMatchObject({
      className: 'muted',
      children: 'No partner command is currently queued.',
    });
  });

  it('can preserve existing framed empty-state blocks when a section already expects that wrapper', () => {
    const emptyState = AdminEmptyState({
      framed: true,
      message: 'No recent partner wallet ledger row is loaded.',
      title: 'No wallet evidence found',
    });

    expect(emptyState.type).toBe('div');
    expect(emptyState.props).toMatchObject({
      'aria-live': 'polite',
      className: 'empty-state',
      role: 'status',
    });
    expect(emptyState.props.children[0].props.children).toBe('No wallet evidence found');
  });

  it('keeps existing layout spacing classes on framed empty states', () => {
    const emptyState = AdminEmptyState({
      className: 'admin-mt-14',
      framed: true,
      message: 'No participant records match the current booking filters.',
    });

    expect(emptyState.type).toBe('div');
    expect(emptyState.props.className).toBe('empty-state admin-mt-14');
  });

  it('deduplicates legacy empty-state class tokens on framed empty states', () => {
    const emptyState = AdminEmptyState({
      className: 'empty-state admin-mt-14 empty-state',
      framed: true,
      message: 'No booking evidence is visible for this range.',
    });

    expect(emptyState.type).toBe('div');
    expect(emptyState.props.className).toBe('empty-state admin-mt-14');
  });

  it('keeps custom spacing classes on the shared Vuexy empty surface when a page supplies them', () => {
    const emptyState = AdminEmptyState({
      className: 'admin-mt-8',
      message: 'No partner files are retained for this profile.',
    });

    expect(emptyState.type).toBe('div');
    expect(emptyState.props).toMatchObject({
      'aria-live': 'polite',
      className: 'empty-state admin-mt-8',
      role: 'status',
    });
    expect(emptyState.props.children[0].props.children).toBe('No records found');
    expect(emptyState.props.children[1].props.children).toBe('No partner files are retained for this profile.');
  });

  it('deduplicates empty-state class tokens on classed empty states', () => {
    const emptyState = AdminEmptyState({
      className: 'empty-state admin-mt-8 empty-state',
      message: 'No visible operator activity.',
    });

    expect(emptyState.type).toBe('div');
    expect(emptyState.props.className).toBe('empty-state admin-mt-8');
  });

  it('can render legacy sentence-only empty states without adding a title', () => {
    const emptyState = AdminEmptyState({
      framed: true,
      message: 'No marketplace booking rows match the current filters.',
      title: null,
    });

    expect(emptyState.props.children[0]).toBeNull();
    expect(emptyState.props.children[1].props.children).toBe(
      'No marketplace booking rows match the current filters.',
    );
  });
});
