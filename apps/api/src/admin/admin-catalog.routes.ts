import { Body, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  AdminPublicSitePageListQueryDto,
  CreatePublicSiteNewsDraftDto,
  CreatePublicSitePageDto,
  CreatePublicSiteSectionDto,
  DeletePublicSitePageDto,
  PublishPublicSiteDraftDto,
  RollbackPublicSiteRevisionDto,
  TakePublicSitePageOfflineDto,
  UpdatePublicSiteNewsDraftDto,
  UpdatePublicSitePageDto,
  UpdatePublicSiteSectionDto,
} from '../site-content/site-content.dto';
import {
  BulkUpsertServicePayoutRulesDto,
  CreateAdminServiceDto,
  CreateServiceDurationSetDto,
  SaveServiceCatalogGroupDto,
  UpdateAdminServiceDto,
  UpdateServicePayoutRuleDto,
  UpsertServicePayoutRuleDto,
} from './admin.dto';
import { AdminFinanceRoutes } from './admin-finance.routes';

export class AdminCatalogRoutes extends AdminFinanceRoutes {
  @Get('site-pages/readiness-dry-run')
  publicSiteReadinessDryRun() {
    return this.admin.publicSiteReadinessDryRun();
  }

  @Get('site-pages')
  publicSitePages(@Query() query: AdminPublicSitePageListQueryDto) {
    return this.admin.listPublicSitePages(query);
  }

  @Get('site-pages/:id')
  publicSitePage(@Param('id') pageId: string) {
    return this.admin.getPublicSitePage(pageId);
  }

  @Get('site-pages/:id/preview-link')
  publicSitePreviewLink(@Param('id') pageId: string) {
    return this.admin.createPublicSitePreviewToken(pageId);
  }

  @Post('site-pages')
  createPublicSitePage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePublicSitePageDto,
  ) {
    return this.admin.createPublicSitePage(user.id, body);
  }

  @Post('site-pages/news')
  createPublicSiteNewsDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePublicSiteNewsDraftDto,
  ) {
    return this.admin.createPublicSiteNewsDraft(user.id, body);
  }

  @Patch('site-pages/:id/news-draft')
  updatePublicSiteNewsDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') pageId: string,
    @Body() body: UpdatePublicSiteNewsDraftDto,
  ) {
    return this.admin.updatePublicSiteNewsDraft(user.id, pageId, body);
  }

  @Post('site-pages/:id/draft')
  openPublicSiteDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') pageId: string,
  ) {
    return this.admin.openPublicSiteDraft(user.id, pageId);
  }

  @Delete('site-pages/:id/draft')
  discardPublicSiteDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') pageId: string,
  ) {
    return this.admin.discardPublicSiteDraft(user.id, pageId);
  }

  @Post('site-pages/:id/publish')
  publishPublicSiteDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') pageId: string,
    @Body() body: PublishPublicSiteDraftDto,
  ) {
    return this.admin.publishPublicSiteDraft(user.id, pageId, body);
  }

  @Post('site-pages/:id/rollback')
  rollbackPublicSiteRevision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') pageId: string,
    @Body() body: RollbackPublicSiteRevisionDto,
  ) {
    return this.admin.rollbackPublicSiteRevision(user.id, pageId, body);
  }

  @Post('site-pages/:id/take-offline')
  takePublicSitePageOffline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') pageId: string,
    @Body() body: TakePublicSitePageOfflineDto,
  ) {
    return this.admin.takePublicSitePageOffline(user.id, pageId, body);
  }

  @Patch('site-pages/:id')
  updatePublicSitePage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') pageId: string,
    @Body() body: UpdatePublicSitePageDto,
  ) {
    return this.admin.updatePublicSitePage(user.id, pageId, body);
  }

  @Delete('site-pages/:id')
  deletePublicSitePage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') pageId: string,
    @Body() body: DeletePublicSitePageDto,
  ) {
    return this.admin.deletePublicSitePage(user.id, pageId, body);
  }

  @Post('site-pages/:id/sections')
  createPublicSiteSection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') pageId: string,
    @Body() body: CreatePublicSiteSectionDto,
  ) {
    return this.admin.createPublicSiteSection(user.id, pageId, body);
  }

  @Patch('site-pages/sections/:sectionId')
  updatePublicSiteSection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sectionId') sectionId: string,
    @Body() body: UpdatePublicSiteSectionDto,
  ) {
    return this.admin.updatePublicSiteSection(user.id, sectionId, body);
  }

  @Delete('site-pages/sections/:sectionId')
  deletePublicSiteSection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sectionId') sectionId: string,
  ) {
    return this.admin.deletePublicSiteSection(user.id, sectionId);
  }

  @Get('services')
  services(@Query('scope') scope?: string) {
    return this.admin.listServices({ scope });
  }

  @Get('services/groups')
  serviceGroups(@Query('scope') scope?: string) {
    return this.admin.listServiceGroups({ scope });
  }

  @Get('services/health')
  serviceCatalogHealth() {
    return this.admin.serviceCatalogHealth();
  }

  @Get('services/groups/:groupKey/impact')
  serviceCatalogGroupImpact(@Param('groupKey') groupKey: string) {
    return this.admin.serviceCatalogGroupImpact(groupKey);
  }

  @Patch('services/groups/:groupKey')
  saveServiceCatalogGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupKey') groupKey: string,
    @Body() body: SaveServiceCatalogGroupDto,
  ) {
    return this.admin.saveServiceCatalogGroup(user.id, groupKey, body);
  }

  @Post('services/duration-sets')
  createServiceDurationSet(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateServiceDurationSetDto,
  ) {
    return this.admin.createServiceDurationSet(user.id, body);
  }

  @Post('services')
  createService(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateAdminServiceDto) {
    return this.admin.createService(user.id, body);
  }

  @Patch('services/:id')
  updateService(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateAdminServiceDto,
  ) {
    return this.admin.updateService(user.id, id, body);
  }

  @Post('services/:id/payout-rules')
  upsertServicePayoutRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') serviceId: string,
    @Body() body: UpsertServicePayoutRuleDto,
  ) {
    return this.admin.upsertServicePayoutRule(user.id, serviceId, body);
  }

  @Post('services/:id/payout-rules/bulk')
  bulkUpsertServicePayoutRules(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') serviceId: string,
    @Body() body: BulkUpsertServicePayoutRulesDto,
  ) {
    return this.admin.bulkUpsertServicePayoutRules(user.id, serviceId, body);
  }

  @Patch('service-payout-rules/:id')
  updateServicePayoutRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateServicePayoutRuleDto,
  ) {
    return this.admin.updateServicePayoutRule(user.id, id, body);
  }
}
