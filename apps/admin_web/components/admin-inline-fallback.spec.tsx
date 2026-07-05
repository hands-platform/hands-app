import { AdminInlineFallback } from './admin-inline-fallback';

describe('AdminInlineFallback', () => {
  it('renders missing inline values with the shared Vuexy muted fallback class', () => {
    const fallback = AdminInlineFallback({
      children: 'No bank transaction',
    });

    expect(fallback.type).toBe('span');
    expect(fallback.props).toMatchObject({
      className: 'admin-inline-fallback',
      children: 'No bank transaction',
    });
  });

  it('preserves caller spacing classes without duplicating the fallback class', () => {
    const fallback = AdminInlineFallback({
      children: 'No journal entry',
      className: 'admin-mt-8 admin-inline-fallback',
    });

    expect(fallback.props.className).toBe('admin-inline-fallback admin-mt-8');
  });
});
