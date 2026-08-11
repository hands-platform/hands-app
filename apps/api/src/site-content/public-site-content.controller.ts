import { Controller, Get, Header, NotFoundException, Query } from '@nestjs/common';

import {
  PublicSitePageQueryDto,
  PublicSitePreviewQueryDto,
  PublicSiteRouteQueryDto,
} from './site-content.dto';
import { SiteContentService } from './site-content.service';

@Controller('public/site-pages')
export class PublicSiteContentController {
  constructor(private readonly siteContent: SiteContentService) {}

  @Get('resolve')
  async resolve(@Query() query: PublicSitePageQueryDto) {
    const page = await this.siteContent.resolvePublishedPage(
      query.site,
      query.locale,
      query.path,
    );
    if (!page) {
      throw new NotFoundException('Published public site page not found');
    }
    return page;
  }

  @Get('preview')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  preview(@Query() query: PublicSitePreviewQueryDto) {
    return this.siteContent.resolvePreview(query.token);
  }

  @Get('routes')
  routes(@Query() query: PublicSiteRouteQueryDto) {
    return this.siteContent.listPublishedRoutes(query.site, query.locale);
  }

  @Get('news')
  news(@Query() query: PublicSiteRouteQueryDto) {
    return this.siteContent.listPublishedNews(query.site, query.locale);
  }
}
