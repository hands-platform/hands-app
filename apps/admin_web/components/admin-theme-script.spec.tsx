import { ADMIN_THEME_STORAGE_KEY } from '../lib/admin-theme';
import { AdminThemeScript } from './admin-theme-script';

describe('AdminThemeScript', () => {
  it('injects the localStorage theme bootstrap script', () => {
    const script = AdminThemeScript();

    expect(script.props.id).toBe('admin-theme-bootstrap');
    expect(script.type).toBe('script');
    expect(script.props.strategy).toBeUndefined();
    expect(script.props.dangerouslySetInnerHTML.__html).toContain(ADMIN_THEME_STORAGE_KEY);
    expect(script.props.dangerouslySetInnerHTML.__html).toContain('document.documentElement.dataset.theme');
  });
});
