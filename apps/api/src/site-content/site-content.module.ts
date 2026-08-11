import { Module } from '@nestjs/common';

import { PublicSiteContentController } from './public-site-content.controller';
import { SiteContentService } from './site-content.service';

@Module({
  controllers: [PublicSiteContentController],
  providers: [SiteContentService],
  exports: [SiteContentService],
})
export class SiteContentModule {}
