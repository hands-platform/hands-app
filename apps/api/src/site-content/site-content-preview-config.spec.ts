import { describe, expect, it, vi } from 'vitest';

import {
  assertSiteContentPreviewStartupConfig,
  siteContentPreviewConfigState,
} from './site-content-preview-config';

describe('site content preview configuration', () => {
  it.each([
    [undefined, 'missing'],
    ['too-short', 'short'],
    ['preview-secret-at-least-32-characters', 'valid'],
  ] as const)('classifies %s as %s', (secret, state) => {
    expect(siteContentPreviewConfigState(secret)).toBe(state);
  });

  it('fails production startup for missing or short secrets without exposing a value', () => {
    for (const secret of [undefined, 'sensitive-short-value']) {
      const config = {
        get: vi.fn((key: string) => key === 'NODE_ENV' ? 'production' : secret),
      };
      expect(() => assertSiteContentPreviewStartupConfig(config as never)).toThrow(
        'SITE_CONTENT_PREVIEW_SECRET must contain at least 32 characters in production.',
      );
      try {
        assertSiteContentPreviewStartupConfig(config as never);
      } catch (error) {
        expect(String(error)).not.toContain(secret ?? '__missing__');
      }
    }
  });

  it('accepts a valid production secret and leaves non-production startup available', () => {
    expect(() => assertSiteContentPreviewStartupConfig({
      get: vi.fn((key: string) => key === 'NODE_ENV' ? 'production' : 'preview-secret-at-least-32-characters'),
    } as never)).not.toThrow();
    expect(() => assertSiteContentPreviewStartupConfig({
      get: vi.fn((key: string) => key === 'NODE_ENV' ? 'development' : undefined),
    } as never)).not.toThrow();
  });
});
