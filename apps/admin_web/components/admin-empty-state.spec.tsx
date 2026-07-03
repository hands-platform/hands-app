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
    expect(emptyState.props).toMatchObject({ className: 'empty-state' });
    expect(emptyState.props.children[0].props.children).toBe('No wallet evidence found');
  });
});
