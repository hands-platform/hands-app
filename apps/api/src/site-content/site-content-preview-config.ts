import type { ConfigService } from '@nestjs/config';

export const SITE_CONTENT_PREVIEW_SECRET_MIN_LENGTH = 32;

export type SiteContentPreviewConfigState = 'missing' | 'short' | 'valid';

export function siteContentPreviewConfigState(secret: string | undefined): SiteContentPreviewConfigState {
  if (!secret) return 'missing';
  return secret.length >= SITE_CONTENT_PREVIEW_SECRET_MIN_LENGTH ? 'valid' : 'short';
}

export function assertSiteContentPreviewStartupConfig(config: ConfigService) {
  if (config.get<string>('NODE_ENV') !== 'production') return;
  const state = siteContentPreviewConfigState(config.get<string>('SITE_CONTENT_PREVIEW_SECRET'));
  if (state !== 'valid') {
    throw new Error(
      `SITE_CONTENT_PREVIEW_SECRET must contain at least ${SITE_CONTENT_PREVIEW_SECRET_MIN_LENGTH} characters in production.`,
    );
  }
}
