import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { StartShiftRefreshButton } from './start-shift-refresh-button';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

const source = readFileSync('components/start-shift-refresh-button.tsx', 'utf8');

describe('StartShiftRefreshButton', () => {
  beforeEach(() => {
    refresh.mockReset();
  });

  it('uses the shared secondary button atom for manual refresh', () => {
    const markup = renderToStaticMarkup(<StartShiftRefreshButton />);

    expect(markup).toContain('Refresh Start Shift data');
    expect(markup).toContain('button-secondary');
    expect(markup).toContain('Refresh');
  });

  it('refreshes a visible idle page and defers updates while an operator is interacting', () => {
    expect(source).toContain('const DEFAULT_REFRESH_INTERVAL_MS = 60_000;');
    expect(source).toContain("document.visibilityState !== 'visible'");
    expect(source).toContain('operatorIsInteracting()');
    expect(source).toContain('setUpdateAvailable(true)');
    expect(source).toContain("'New data — refresh'");
    expect(source).toContain('New dashboard data is available.');
    expect(source).toContain('role="status"');
    expect(source).toContain("document.addEventListener('visibilitychange', refreshVisiblePage)");
    expect(source).toContain('window.setInterval(refreshVisiblePage, refreshIntervalMs)');
    expect(source).toContain('window.clearInterval(intervalId)');
  });
});
