import { readFileSync } from 'node:fs';

import nextConfig from '../next.config';

describe('Admin Web Server Action upload contract', () => {
  it('keeps the global request ceiling close to the only validated 10 MB upload action', () => {
    const partnerActionsSource = readFileSync('app/partners/actions.ts', 'utf8');

    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe('11mb');
    expect(partnerActionsSource).toContain('const PARTNER_PUBLIC_IMAGE_MAX_BYTES = 10 * 1024 * 1024;');
    expect(partnerActionsSource).toContain('if (photo.size > PARTNER_PUBLIC_IMAGE_MAX_BYTES)');
  });
});
