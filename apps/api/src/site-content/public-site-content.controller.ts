import { Controller, Get, Header, Headers, NotFoundException, Query, UnauthorizedException } from '@nestjs/common';

import {
  PublicSitePageQueryDto,
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
  preview(@Headers('authorization') authorization?: string) {
    const token = previewBearerToken(authorization);
    if (!token) {
      throw new UnauthorizedException('Preview bearer token is required');
    }
    return this.siteContent.resolvePreview(token);
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

function previewBearerToken(authorization?: string) {
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1]?.trim() || null;
}
