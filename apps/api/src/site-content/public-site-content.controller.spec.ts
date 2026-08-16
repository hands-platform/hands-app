import { UnauthorizedException } from '@nestjs/common';

import { PublicSiteContentController } from './public-site-content.controller';

describe('PublicSiteContentController preview', () => {
  it('requires the signed preview token in the Authorization header', () => {
    const controller = new PublicSiteContentController({} as never);

    expect(() => controller.preview()).toThrow(
      new UnauthorizedException('Preview bearer token is required'),
    );
  });

  it('passes only a well-formed bearer token to the preview resolver', async () => {
    const siteContent = {
      resolvePreview: vi.fn().mockResolvedValue({ id: 'preview-page' }),
    };
    const controller = new PublicSiteContentController(siteContent as never);

    await expect(controller.preview('Bearer signed-preview-token')).resolves.toEqual({
      id: 'preview-page',
    });
    expect(siteContent.resolvePreview).toHaveBeenCalledWith('signed-preview-token');
    expect(() => controller.preview('Basic signed-preview-token')).toThrow(
      'Preview bearer token is required',
    );
  });
});
