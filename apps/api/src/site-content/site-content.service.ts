import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  PublicSitePageStatus,
  PublicSiteRevisionReadinessState,
  PublicSiteRevisionState,
  type PublicSiteKey,
  type PublicSiteSectionKind,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type {
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
} from './site-content.dto';
import {
  publicSiteManifestEntry,
  publicSiteOwnership,
  publicSiteRouteManifest,
  type PublicSiteOwnership,
} from './public-site-route-manifest';

const revisionSections = {
  orderBy: [{ sortOrder: 'asc' as const }, { key: 'asc' as const }],
};

const pageDetailInclude = {
  activeRevision: { include: { sections: revisionSections } },
  draftRevision: { include: { sections: revisionSections } },
  revisions: {
    where: { state: { in: [PublicSiteRevisionState.ACTIVE, PublicSiteRevisionState.ARCHIVED] } },
    orderBy: { revisionNumber: 'desc' as const },
    take: 20,
    select: {
      id: true,
      revisionNumber: true,
      version: true,
      state: true,
      readinessState: true,
      publishedAt: true,
      publishedById: true,
      updatedAt: true,
      seoTitle: true,
      seoDescription: true,
      canonicalPath: true,
      noIndex: true,
    },
  },
} satisfies Prisma.PublicSitePageInclude;

type RevisionWithSections = Prisma.PublicSitePageRevisionGetPayload<{
  include: { sections: typeof revisionSections };
}>;

type PreviewTokenPayload = {
  exp: number;
  pageId: string;
  revisionId: string;
  site: PublicSiteKey;
  locale: string;
  path: string;
  version: number;
};

@Injectable()
export class SiteContentService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async listAdminPages(query: AdminPublicSitePageListQueryDto = {}) {
    const page = Math.max(1, query.page ?? 1);
    const take = Math.min(100, Math.max(1, query.take ?? 20));
    const contentType = query.contentType ?? 'pages';
    const ownershipWhere = ownershipFilter(query.ownership, query.site);
    const where: Prisma.PublicSitePageWhereInput = {
      ...(query.site ? { site: query.site } : {}),
      ...(query.locale ? { locale: query.locale } : {}),
      ...(query.q
        ? {
            OR: [
              { internalName: { contains: query.q, mode: 'insensitive' } },
              { path: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(contentType === 'news'
        ? { path: { startsWith: '/news/' } }
        : { NOT: { path: { startsWith: '/news/' } } }),
      ...(query.status === 'live'
        ? { activeRevisionId: { not: null } }
        : query.status === 'draft'
          ? { draftRevisionId: { not: null } }
          : query.status === 'attention'
            ? {
                draftRevision: {
                  is: { readinessState: { not: PublicSiteRevisionReadinessState.READY } },
                },
              }
            : {}),
      ...(query.readiness
        ? { draftRevision: { is: { readinessState: query.readiness } } }
        : {}),
      ...(ownershipWhere ? { AND: [ownershipWhere] } : {}),
    };
    if (contentType === 'news') {
      const [rows, total, resolvedSummary] = await Promise.all([
        this.prisma.publicSitePage.findMany({
          where,
          orderBy: [{ activeRevision: { publishedAt: 'desc' } }, { updatedAt: 'desc' }],
          skip: (page - 1) * take,
          take,
          select: adminPageSummarySelect,
        }),
      this.prisma.publicSitePage.count({ where }),
        this.adminSummary(query, where).catch(() => null),
      ]);
      return pageResult(rows.map(adminPageSummaryWithOwnership), page, take, total, resolvedSummary);
    }
    const [routeGroups, allRouteGroups, resolvedSummary] = await Promise.all([
      this.prisma.publicSitePage.groupBy({
        by: ['site', 'path'],
        where,
        orderBy: [{ site: 'asc' }, { path: 'asc' }],
        skip: (page - 1) * take,
        take,
      }),
      this.prisma.publicSitePage.groupBy({ by: ['site', 'path'], where }),
      this.adminSummary(query, where).catch(() => null),
    ]);
    if (!routeGroups.length) {
      return pageResult([], page, take, allRouteGroups.length, resolvedSummary);
    }
    const rows = await this.prisma.publicSitePage.findMany({
      where: {
        AND: [
          where,
          { OR: routeGroups.map((group) => ({ site: group.site, path: group.path })) },
        ],
      },
      orderBy: [{ site: 'asc' }, { path: 'asc' }, { locale: 'asc' }],
      select: adminPageSummarySelect,
    });
    return pageResult(
      groupPageRoutes(rows.map(adminPageSummaryWithOwnership)),
      page,
      take,
      allRouteGroups.length,
      resolvedSummary,
    );
  }

  async getAdminPage(pageId: string) {
    const [page, activity] = await Promise.all([
      this.assertPageExists(pageId),
      this.prisma.adminAuditLog.findMany({
        where: { target: `public_site_page:${pageId}` },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
        include: { actor: { select: { id: true, fullName: true, email: true } } },
      }),
    ]);
    return {
      ...page,
      ownership: publicSiteOwnership(page.site, page.path, Boolean(page.activeRevisionId)),
      manifestLabel: publicSiteManifestEntry(page.site, page.path)?.label ?? null,
      offlineVisitorOutcome: publicSiteManifestEntry(page.site, page.path)?.codeFallback
        ? 'CODE_FALLBACK'
        : 'NOT_SERVED',
      activity: activity.map((event) => ({
        id: event.id,
        action: event.action,
        createdAt: event.createdAt,
        actor: event.actor
          ? { id: event.actor.id, label: event.actor.fullName ?? event.actor.email ?? event.actor.id }
          : null,
        metadata: event.metadata,
      })),
    };
  }

  async createPage(actorId: string, input: CreatePublicSitePageDto) {
    if (input.status === PublicSitePageStatus.PUBLISHED) {
      throw new BadRequestException('New pages must be saved as Draft before publishing');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const page = await tx.publicSitePage.create({
          data: {
            site: input.site,
            locale: input.locale,
            path: input.path,
            internalName: input.internalName,
            status: PublicSitePageStatus.DRAFT,
            noIndex: input.noIndex ?? true,
            createdById: actorId,
            updatedById: actorId,
          },
        });
        const readiness = publicSiteRevisionReadiness({
          seoTitle: input.seoTitle,
          seoDescription: input.seoDescription,
          sections: [],
        });
        const draft = await tx.publicSitePageRevision.create({
          data: {
            pageId: page.id,
            revisionNumber: 1,
            state: PublicSiteRevisionState.DRAFT,
            seoTitle: input.seoTitle,
            seoDescription: input.seoDescription,
            canonicalPath: input.canonicalPath,
            noIndex: input.noIndex ?? true,
            readinessState: readiness.state,
            readinessIssues: readiness.issues,
            createdById: actorId,
            updatedById: actorId,
          },
        });
        await tx.publicSitePage.update({
          where: { id: page.id },
          data: { draftRevisionId: draft.id },
        });
        await audit(tx, actorId, 'PUBLIC_SITE_DRAFT_CREATED', page.id, {
          site: page.site,
          locale: page.locale,
          path: page.path,
          revisionId: draft.id,
        });
        return this.findPageWithTx(tx, page.id);
      });
    } catch (error) {
      throwPublicSiteConflict(error);
    }
  }

  async updatePage(actorId: string, pageId: string, input: UpdatePublicSitePageDto) {
    if (input.status !== undefined) {
      throw new BadRequestException('Publish state is changed only by Publish or Rollback');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const page = await this.ensureDraft(tx, pageId, actorId);
        if (
          page.activeRevisionId &&
          ((input.site && input.site !== page.site) ||
            (input.locale && input.locale !== page.locale) ||
            (input.path && input.path !== page.path))
        ) {
          throw new BadRequestException(
            'Live website, language, and route path are locked. Create a new route for a URL move.',
          );
        }
        const draft = requiredDraft(page);
        assertExpectedVersion(draft.version, input.expectedVersion);
        const next = {
          seoTitle: input.seoTitle !== undefined ? input.seoTitle : draft.seoTitle,
          seoDescription:
            input.seoDescription !== undefined ? input.seoDescription : draft.seoDescription,
          canonicalPath:
            input.canonicalPath !== undefined ? input.canonicalPath : draft.canonicalPath,
          noIndex: input.noIndex !== undefined ? input.noIndex : draft.noIndex,
          sections: draft.sections,
        };
        const readiness = publicSiteRevisionReadiness(next);
        const updated = await tx.publicSitePageRevision.updateMany({
          where: { id: draft.id, version: draft.version, state: PublicSiteRevisionState.DRAFT },
          data: {
            seoTitle: next.seoTitle,
            seoDescription: next.seoDescription,
            canonicalPath: next.canonicalPath,
            noIndex: next.noIndex,
            readinessState: readiness.state,
            readinessIssues: readiness.issues,
            updatedById: actorId,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throwDraftConflict();
        await tx.publicSitePage.update({
          where: { id: pageId },
          data: {
            internalName: input.internalName ?? page.internalName,
            ...(!page.activeRevisionId
              ? {
                  site: input.site ?? page.site,
                  locale: input.locale ?? page.locale,
                  path: input.path ?? page.path,
                }
              : {}),
            updatedById: actorId,
          },
        });
        await audit(tx, actorId, 'PUBLIC_SITE_DRAFT_UPDATED', pageId, {
          revisionId: draft.id,
          version: draft.version + 1,
        });
        return this.findPageWithTx(tx, pageId);
      });
    } catch (error) {
      throwPublicSiteConflict(error);
    }
  }

  async deletePage(actorId: string, pageId: string, input: DeletePublicSitePageDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findPageWithTx(tx, pageId);
      if (!existing) throw new NotFoundException('Public site page not found');
      assertConfirmedPath(existing.path, input.confirmationPath);
      if (existing.activeRevisionId || existing.firstPublishedAt || existing.revisions.length > 0) {
        throw new ConflictException(
          'Pages with Live history cannot be deleted. Take the page offline and retain its audit history.',
        );
      }
      if (publicSiteOwnership(existing.site, existing.path, false) === 'OWNERSHIP_CONFLICT') {
        throw new ConflictException('Resolve this route ownership conflict before deleting the page.');
      }
      await audit(tx, actorId, 'PUBLIC_SITE_PAGE_DELETED', pageId, {
        requestId: randomUUID(),
        reason: input.reason,
        before: {
          site: existing.site,
          locale: existing.locale,
          path: existing.path,
          draftRevisionId: existing.draftRevisionId,
        },
      });
      await tx.publicSitePage.delete({ where: { id: pageId } });
      return { deleted: true, id: pageId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async createSection(actorId: string, pageId: string, input: CreatePublicSiteSectionDto) {
    assertPublicSiteContentSize(input.content);
    assertPublicSiteContentContract(input.kind, input.content);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const page = await this.ensureDraft(tx, pageId, actorId);
        const draft = requiredDraft(page);
        const section = await tx.publicSiteRevisionSection.create({
          data: {
            revisionId: draft.id,
            key: input.key,
            kind: input.kind,
            sortOrder: input.sortOrder ?? 0,
            enabled: input.enabled ?? true,
            content: (input.content ?? {}) as Prisma.InputJsonObject,
          },
        });
        await this.refreshDraftReadiness(tx, draft.id, actorId, draft.version);
        await audit(tx, actorId, 'PUBLIC_SITE_SECTION_CREATED', pageId, {
          revisionId: draft.id,
          sectionId: section.id,
          key: section.key,
        });
        return section;
      });
    } catch (error) {
      throwPublicSiteConflict(error);
    }
  }

  async updateSection(actorId: string, sectionId: string, input: UpdatePublicSiteSectionDto) {
    assertPublicSiteContentSize(input.content);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.publicSiteRevisionSection.findUnique({
          where: { id: sectionId },
          include: { revision: { include: { page: true } } },
        });
        if (!existing || existing.revision.state !== PublicSiteRevisionState.DRAFT) {
          throw new NotFoundException('Draft website section not found');
        }
        if (existing.revision.page.draftRevisionId !== existing.revisionId) {
          throw new ConflictException('This section no longer belongs to the current Draft');
        }
        assertExpectedVersion(existing.revision.version, input.expectedVersion);
        assertPublicSiteContentContract(input.kind ?? existing.kind, input.content);
        const { expectedVersion: _expectedVersion, content, ...values } = input;
        void _expectedVersion;
        const section = await tx.publicSiteRevisionSection.update({
          where: { id: sectionId },
          data: {
            ...values,
            ...(content !== undefined ? { content: content as Prisma.InputJsonObject } : {}),
          },
        });
        await this.refreshDraftReadiness(
          tx,
          existing.revisionId,
          actorId,
          existing.revision.version,
        );
        await audit(tx, actorId, 'PUBLIC_SITE_SECTION_UPDATED', existing.revision.pageId, {
          revisionId: existing.revisionId,
          sectionId,
          key: section.key,
        });
        return section;
      });
    } catch (error) {
      throwPublicSiteConflict(error);
    }
  }

  async deleteSection(actorId: string, sectionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.publicSiteRevisionSection.findUnique({
        where: { id: sectionId },
        include: { revision: { include: { page: true } } },
      });
      if (!existing || existing.revision.state !== PublicSiteRevisionState.DRAFT) {
        throw new NotFoundException('Draft website section not found');
      }
      if (existing.revision.page.draftRevisionId !== existing.revisionId) {
        throw new ConflictException('This section no longer belongs to the current Draft');
      }
      await tx.publicSiteRevisionSection.delete({ where: { id: sectionId } });
      await this.refreshDraftReadiness(
        tx,
        existing.revisionId,
        actorId,
        existing.revision.version,
      );
      await audit(tx, actorId, 'PUBLIC_SITE_SECTION_DELETED', existing.revision.pageId, {
        revisionId: existing.revisionId,
        sectionId,
        key: existing.key,
      });
      return { deleted: true, id: sectionId };
    });
  }

  async createNewsDraft(actorId: string, input: CreatePublicSiteNewsDraftDto) {
    const path = `/news/${input.slug}`;
    const content = newsContent(input);
    assertPublicSiteContentSize(content);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const page = await tx.publicSitePage.create({
          data: {
            site: 'MAIN',
            locale: input.locale,
            path,
            internalName: `News: ${input.title}`,
            status: PublicSitePageStatus.DRAFT,
            noIndex: false,
            createdById: actorId,
            updatedById: actorId,
          },
        });
        const readiness = publicSiteRevisionReadiness({
          seoTitle: input.title,
          seoDescription: input.subtitle,
          sections: [{ kind: 'APP_OVERVIEW', enabled: true, content }],
        });
        const draft = await tx.publicSitePageRevision.create({
          data: {
            pageId: page.id,
            revisionNumber: 1,
            state: PublicSiteRevisionState.DRAFT,
            seoTitle: input.title,
            seoDescription: input.subtitle,
            canonicalPath: path,
            noIndex: false,
            readinessState: readiness.state,
            readinessIssues: readiness.issues,
            createdById: actorId,
            updatedById: actorId,
            sections: {
              create: {
                key: 'article',
                kind: 'APP_OVERVIEW',
                content,
                sortOrder: 0,
                enabled: true,
              },
            },
          },
        });
        await tx.publicSitePage.update({
          where: { id: page.id },
          data: { draftRevisionId: draft.id },
        });
        await audit(tx, actorId, 'PUBLIC_SITE_NEWS_DRAFT_CREATED', page.id, {
          revisionId: draft.id,
          path,
        });
        return this.findPageWithTx(tx, page.id);
      });
    } catch (error) {
      throwPublicSiteConflict(error);
    }
  }

  async updateNewsDraft(
    actorId: string,
    pageId: string,
    input: UpdatePublicSiteNewsDraftDto,
  ) {
    const content = newsContent(input);
    assertPublicSiteContentSize(content);
    const path = `/news/${input.slug}`;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const page = await this.ensureDraft(tx, pageId, actorId);
        const draft = requiredDraft(page);
        if (draft.id !== input.revisionId) throwDraftConflict();
        assertExpectedVersion(draft.version, input.expectedVersion);
        if (page.activeRevisionId && (input.locale !== page.locale || path !== page.path)) {
          throw new BadRequestException('A live news URL cannot be changed from the Draft editor');
        }
        const article = draft.sections.find((section) => section.key === 'article');
        if (!article) throw new BadRequestException('News Draft is missing its article section');
        await tx.publicSiteRevisionSection.update({
          where: { id: article.id },
          data: { content },
        });
        const readiness = publicSiteRevisionReadiness({
          seoTitle: input.title,
          seoDescription: input.subtitle,
          sections: [{ ...article, content }],
        });
        const updated = await tx.publicSitePageRevision.updateMany({
          where: { id: draft.id, version: draft.version, state: PublicSiteRevisionState.DRAFT },
          data: {
            seoTitle: input.title,
            seoDescription: input.subtitle,
            canonicalPath: path,
            noIndex: false,
            readinessState: readiness.state,
            readinessIssues: readiness.issues,
            updatedById: actorId,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throwDraftConflict();
        await tx.publicSitePage.update({
          where: { id: pageId },
          data: {
            internalName: `News: ${input.title}`,
            ...(!page.activeRevisionId ? { locale: input.locale, path } : {}),
            updatedById: actorId,
          },
        });
        await audit(tx, actorId, 'PUBLIC_SITE_NEWS_DRAFT_UPDATED', pageId, {
          revisionId: draft.id,
          version: draft.version + 1,
        });
        return this.findPageWithTx(tx, pageId);
      });
    } catch (error) {
      throwPublicSiteConflict(error);
    }
  }

  async openDraft(actorId: string, pageId: string) {
    return this.prisma.$transaction((tx) => this.ensureDraft(tx, pageId, actorId));
  }

  async discardDraft(actorId: string, pageId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const page = await this.findPageWithTx(tx, pageId);
        if (!page) throw new NotFoundException('Public site page not found');
        if (!page.draftRevisionId || !page.draftRevision) return page;
        if (!page.activeRevisionId) {
          throw new ConflictException('A Draft-only route must be deleted instead');
        }
        const revisionId = page.draftRevisionId;
        await tx.publicSitePage.update({
          where: { id: pageId },
          data: { draftRevisionId: null, updatedById: actorId },
        });
        await tx.publicSitePageRevision.delete({ where: { id: revisionId } });
        await audit(tx, actorId, 'PUBLIC_SITE_DRAFT_DISCARDED', pageId, { revisionId });
        return this.findPageWithTx(tx, pageId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async publishDraft(actorId: string, pageId: string, input: PublishPublicSiteDraftDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const page = await this.findPageWithTx(tx, pageId);
        if (!page) throw new NotFoundException('Public site page not found');
        if (page.activeRevisionId === input.revisionId && !page.draftRevisionId) {
          return page;
        }
        const draft = requiredDraft(page);
        if (draft.id !== input.revisionId) throwDraftConflict();
        assertExpectedVersion(draft.version, input.expectedVersion);
        const readiness = publicSiteRevisionReadiness(draft);
        if (readiness.state !== PublicSiteRevisionReadinessState.READY) {
          throw new BadRequestException({
            code: 'CONTENT_NOT_READY',
            message: 'Draft cannot be published until all readiness checks pass.',
            issues: readiness.issues,
          });
        }
        const publishedAt = new Date();
        if (page.activeRevisionId) {
          await tx.publicSitePageRevision.update({
            where: { id: page.activeRevisionId },
            data: { state: PublicSiteRevisionState.ARCHIVED },
          });
        }
        await tx.publicSitePageRevision.update({
          where: { id: draft.id },
          data: {
            state: PublicSiteRevisionState.ACTIVE,
            readinessState: readiness.state,
            readinessIssues: readiness.issues,
            publishedAt,
            publishedById: actorId,
            updatedById: actorId,
          },
        });
        await tx.publicSitePage.update({
          where: { id: pageId },
          data: {
            activeRevisionId: draft.id,
            draftRevisionId: null,
            firstPublishedAt: page.firstPublishedAt ?? publishedAt,
            status: PublicSitePageStatus.PUBLISHED,
            publishedAt: page.firstPublishedAt ?? publishedAt,
            seoTitle: draft.seoTitle,
            seoDescription: draft.seoDescription,
            canonicalPath: draft.canonicalPath,
            noIndex: draft.noIndex,
            updatedById: actorId,
          },
        });
        await audit(tx, actorId, 'PUBLIC_SITE_DRAFT_PUBLISHED', pageId, {
          requestId: randomUUID(),
          previousRevisionId: page.activeRevisionId,
          revisionId: draft.id,
          version: draft.version,
          ownershipBefore: publicSiteOwnership(page.site, page.path, Boolean(page.activeRevisionId)),
          ownershipAfter: 'CMS_LIVE',
          firstPublish: !page.firstPublishedAt,
        });
        return this.findPageWithTx(tx, pageId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async rollbackRevision(
    actorId: string,
    pageId: string,
    input: RollbackPublicSiteRevisionDto,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const page = await this.findPageWithTx(tx, pageId);
        if (!page) throw new NotFoundException('Public site page not found');
        const target = await tx.publicSitePageRevision.findFirst({
          where: {
            id: input.revisionId,
            pageId,
            state: PublicSiteRevisionState.ARCHIVED,
            publishedAt: { not: null },
          },
        });
        if (!target) throw new BadRequestException('Only a previous Live revision can be restored');
        if (page.activeRevisionId) {
          await tx.publicSitePageRevision.update({
            where: { id: page.activeRevisionId },
            data: { state: PublicSiteRevisionState.ARCHIVED },
          });
        }
        await tx.publicSitePageRevision.update({
          where: { id: target.id },
          data: { state: PublicSiteRevisionState.ACTIVE },
        });
        await tx.publicSitePage.update({
          where: { id: pageId },
          data: {
            activeRevisionId: target.id,
            status: PublicSitePageStatus.PUBLISHED,
            seoTitle: target.seoTitle,
            seoDescription: target.seoDescription,
            canonicalPath: target.canonicalPath,
            noIndex: target.noIndex,
            updatedById: actorId,
          },
        });
        await audit(tx, actorId, 'PUBLIC_SITE_REVISION_ROLLED_BACK', pageId, {
          requestId: randomUUID(),
          reason: input.reason,
          previousRevisionId: page.activeRevisionId,
          revisionId: target.id,
          originalPublishedAt: target.publishedAt?.toISOString() ?? null,
          originalPublisherId: target.publishedById,
        });
        return this.findPageWithTx(tx, pageId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async takeOffline(actorId: string, pageId: string, input: TakePublicSitePageOfflineDto) {
    return this.prisma.$transaction(async (tx) => {
      const page = await this.findPageWithTx(tx, pageId);
      if (!page) throw new NotFoundException('Public site page not found');
      assertConfirmedPath(page.path, input.confirmationPath);
      const manifest = publicSiteManifestEntry(page.site, page.path);
      const visitorOutcome = manifest?.codeFallback ? 'CODE_FALLBACK' : 'NOT_SERVED';
      if (!page.activeRevisionId) {
        return { page, idempotent: true, visitorOutcome };
      }
      const previousRevisionId = page.activeRevisionId;
      await tx.publicSitePageRevision.update({
        where: { id: previousRevisionId },
        data: { state: PublicSiteRevisionState.ARCHIVED, updatedById: actorId },
      });
      await tx.publicSitePage.update({
        where: { id: pageId },
        data: {
          activeRevisionId: null,
          status: PublicSitePageStatus.DRAFT,
          publishedAt: null,
          updatedById: actorId,
        },
      });
      await audit(tx, actorId, 'PUBLIC_SITE_PAGE_TAKEN_OFFLINE', pageId, {
        requestId: randomUUID(),
        reason: input.reason,
        previousRevisionId,
        ownershipBefore: 'CMS_LIVE',
        ownershipAfter: visitorOutcome,
        visitorOutcome,
      });
      return { page: await this.findPageWithTx(tx, pageId), idempotent: false, visitorOutcome };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async createPreviewToken(pageId: string) {
    const page = await this.assertPageExists(pageId);
    const draft = requiredDraft(page);
    const payload: PreviewTokenPayload = {
      exp: Date.now() + 10 * 60_000,
      pageId,
      revisionId: draft.id,
      site: page.site,
      locale: page.locale,
      path: page.path,
      version: draft.version,
    };
    return {
      token: this.signPreviewPayload(payload),
      expiresAt: new Date(payload.exp).toISOString(),
      site: page.site,
      locale: page.locale,
      path: page.path,
      revisionId: draft.id,
      version: draft.version,
    };
  }

  async resolvePreview(token: string) {
    const payload = this.verifyPreviewToken(token);
    const page = await this.prisma.publicSitePage.findUnique({
      where: { id: payload.pageId },
      include: { draftRevision: { include: { sections: revisionSections } } },
    });
    if (
      !page?.draftRevision ||
      page.draftRevision.id !== payload.revisionId ||
      page.draftRevision.version !== payload.version ||
      page.site !== payload.site ||
      page.locale !== payload.locale ||
      page.path !== payload.path
    ) {
      throw new UnauthorizedException('Draft preview link is no longer valid');
    }
    return publicPageResponse(page, page.draftRevision, true);
  }

  async resolvePublishedPage(site: PublicSiteKey, locale: string, path: string) {
    const page = await this.prisma.publicSitePage.findFirst({
      where: { site, locale, path, activeRevisionId: { not: null } },
      include: { activeRevision: { include: { sections: revisionSections } } },
    });
    return page?.activeRevision ? publicPageResponse(page, page.activeRevision, false) : null;
  }

  async listPublishedRoutes(site: PublicSiteKey, locale: string) {
    const pages = await this.prisma.publicSitePage.findMany({
      where: {
        site,
        locale,
        activeRevision: { is: { noIndex: false } },
        path: { not: { contains: '[' } },
      },
      orderBy: { path: 'asc' },
      select: { path: true, activeRevision: { select: { updatedAt: true } } },
    });
    return pages.map((page) => ({ path: page.path, updatedAt: page.activeRevision?.updatedAt }));
  }

  async listPublishedNews(site: PublicSiteKey, locale: string) {
    const pages = await this.prisma.publicSitePage.findMany({
      where: { site, locale, activeRevisionId: { not: null }, path: { startsWith: '/news/' } },
      orderBy: { activeRevision: { publishedAt: 'desc' } },
      take: 50,
      include: { activeRevision: { include: { sections: revisionSections } } },
    });
    return pages.flatMap((page) => {
      if (!page.activeRevision) return [];
      const response = publicPageResponse(page, page.activeRevision, false);
      return [{
        id: page.id,
        path: page.path,
        seoTitle: response.seoTitle,
        seoDescription: response.seoDescription,
        publishedAt: page.activeRevision.publishedAt,
        updatedAt: page.activeRevision.updatedAt,
        sections: response.sections.slice(0, 1),
      }];
    });
  }

  async readinessDryRun() {
    const drafts = await this.prisma.publicSitePage.findMany({
      where: { draftRevisionId: { not: null } },
      orderBy: [{ site: 'asc' }, { path: 'asc' }, { locale: 'asc' }],
      include: { draftRevision: { include: { sections: revisionSections } } },
    });
    return {
      generatedAt: new Date().toISOString(),
      applyExecuted: false,
      items: drafts.flatMap((page) => {
        if (!page.draftRevision) return [];
        const readiness = publicSiteRevisionReadiness(page.draftRevision);
        return [{
          pageId: page.id,
          site: page.site,
          locale: page.locale,
          path: page.path,
          previousState: page.draftRevision.readinessState,
          nextState: readiness.state,
          issues: readiness.issues,
        }];
      }),
    };
  }

  private async adminSummary(
    query: AdminPublicSitePageListQueryDto,
    scopedWhere: Prisma.PublicSitePageWhereInput,
  ) {
    const contentType = query.contentType ?? 'pages';
    const includeCompleteness = contentType === 'pages' &&
      !query.readiness &&
      !query.ownership &&
      (!query.status || query.status === 'all');
    const manifestRoutes = !includeCompleteness
      ? []
      : publicSiteRouteManifest.filter((entry) =>
          (!query.site || entry.site === query.site) &&
          (!query.q || `${entry.label} ${entry.path}`.toLowerCase().includes(query.q.toLowerCase())),
        );
    const requiredManifestRows = manifestRoutes.flatMap((entry) =>
      entry.requiredLocales
        .filter((locale) => !query.locale || locale === query.locale)
        .map((locale) => ({ site: entry.site, path: entry.path, locale })),
    );
    const [routeGroups, live, draftChanges, ready, needsAttention, existingManifestRows, recentlyPublished] = await Promise.all([
      this.prisma.publicSitePage.groupBy({ by: ['site', 'path'], where: scopedWhere }),
      this.prisma.publicSitePage.count({ where: { AND: [scopedWhere, { activeRevisionId: { not: null } }] } }),
      this.prisma.publicSitePage.count({ where: { AND: [scopedWhere, { draftRevisionId: { not: null } }] } }),
      this.prisma.publicSitePage.count({
        where: {
          AND: [scopedWhere, { draftRevision: { is: { readinessState: PublicSiteRevisionReadinessState.READY } } }],
        },
      }),
      this.prisma.publicSitePage.count({
        where: {
          AND: [scopedWhere, { draftRevision: { is: { readinessState: PublicSiteRevisionReadinessState.BLOCKED } } }],
        },
      }),
      requiredManifestRows.length
        ? this.prisma.publicSitePage.findMany({
            where: { OR: requiredManifestRows.map((row) => row) },
            select: { site: true, path: true, locale: true },
          })
        : Promise.resolve([]),
      this.prisma.publicSitePage.count({
        where: {
          AND: [
            scopedWhere,
            { activeRevision: { is: { publishedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } } },
          ],
        },
      }),
    ]);
    const existingKeys = new Set(existingManifestRows.map((row) => `${row.site}:${row.path}:${row.locale}`));
    const missingRows = requiredManifestRows.filter((row) => !existingKeys.has(`${row.site}:${row.path}:${row.locale}`));
    const existingRouteKeys = new Set(existingManifestRows.map((row) => `${row.site}:${row.path}`));
    const missingRoutes = manifestRoutes.filter((entry) => !existingRouteKeys.has(`${entry.site}:${entry.path}`)).length;
    return {
      routes: contentType === 'news' ? routeGroups.length : routeGroups.length,
      live,
      draftChanges,
      ready,
      needsAttention,
      missingRoutes,
      missingTranslations: missingRows.length,
      staleTranslations: 0,
      recentlyPublished,
      scope: { contentType, site: query.site ?? null, locale: query.locale ?? null, q: query.q ?? null, status: query.status ?? 'all' },
      generatedAt: new Date().toISOString(),
    };
  }

  private async assertPageExists(pageId: string) {
    const page = await this.prisma.publicSitePage.findUnique({
      where: { id: pageId },
      include: pageDetailInclude,
    });
    if (!page) throw new NotFoundException('Public site page not found');
    return page;
  }

  private findPageWithTx(tx: Prisma.TransactionClient, pageId: string) {
    return tx.publicSitePage.findUnique({ where: { id: pageId }, include: pageDetailInclude });
  }

  private async ensureDraft(tx: Prisma.TransactionClient, pageId: string, actorId: string) {
    const page = await this.findPageWithTx(tx, pageId);
    if (!page) throw new NotFoundException('Public site page not found');
    if (page.draftRevision) return page;
    if (!page.activeRevision) throw new ConflictException('Page has no Live revision to copy');
    const latest = await tx.publicSitePageRevision.aggregate({
      where: { pageId },
      _max: { revisionNumber: true },
    });
    const draft = await tx.publicSitePageRevision.create({
      data: {
        pageId,
        revisionNumber: (latest._max.revisionNumber ?? 0) + 1,
        state: PublicSiteRevisionState.DRAFT,
        seoTitle: page.activeRevision.seoTitle,
        seoDescription: page.activeRevision.seoDescription,
        canonicalPath: page.activeRevision.canonicalPath,
        noIndex: page.activeRevision.noIndex,
        readinessState: page.activeRevision.readinessState,
        readinessIssues: page.activeRevision.readinessIssues ?? [],
        createdById: actorId,
        updatedById: actorId,
        sections: {
          create: page.activeRevision.sections.map((section) => ({
            key: section.key,
            kind: section.kind,
            content: section.content as Prisma.InputJsonValue,
            sortOrder: section.sortOrder,
            enabled: section.enabled,
          })),
        },
      },
    });
    await tx.publicSitePage.update({
      where: { id: pageId },
      data: { draftRevisionId: draft.id, updatedById: actorId },
    });
    await audit(tx, actorId, 'PUBLIC_SITE_DRAFT_OPENED', pageId, {
      sourceRevisionId: page.activeRevision.id,
      revisionId: draft.id,
    });
    const refreshed = await this.findPageWithTx(tx, pageId);
    if (!refreshed) throw new NotFoundException('Public site page not found');
    return refreshed;
  }

  private async refreshDraftReadiness(
    tx: Prisma.TransactionClient,
    revisionId: string,
    actorId: string,
    expectedVersion: number,
  ) {
    const revision = await tx.publicSitePageRevision.findUnique({
      where: { id: revisionId },
      include: { sections: revisionSections },
    });
    if (!revision || revision.state !== PublicSiteRevisionState.DRAFT) throwDraftConflict();
    if (revision.version !== expectedVersion) throwDraftConflict();
    const readiness = publicSiteRevisionReadiness(revision);
    const updated = await tx.publicSitePageRevision.updateMany({
      where: { id: revisionId, version: expectedVersion, state: PublicSiteRevisionState.DRAFT },
      data: {
        readinessState: readiness.state,
        readinessIssues: readiness.issues,
        updatedById: actorId,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throwDraftConflict();
  }

  private signPreviewPayload(payload: PreviewTokenPayload) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.previewSecret()).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
  }

  private verifyPreviewToken(token: string): PreviewTokenPayload {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) throw new UnauthorizedException('Draft preview link is invalid');
    const expected = createHmac('sha256', this.previewSecret()).update(encoded).digest();
    let actual: Buffer;
    try {
      actual = Buffer.from(signature, 'base64url');
    } catch {
      throw new UnauthorizedException('Draft preview link is invalid');
    }
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new UnauthorizedException('Draft preview link is invalid');
    }
    let payload: PreviewTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as PreviewTokenPayload;
    } catch {
      throw new UnauthorizedException('Draft preview link is invalid');
    }
    if (!payload.exp || payload.exp <= Date.now()) {
      throw new UnauthorizedException('Draft preview link has expired');
    }
    return payload;
  }

  private previewSecret() {
    const secret =
      this.config?.get<string>('SITE_CONTENT_PREVIEW_SECRET') ??
      process.env.SITE_CONTENT_PREVIEW_SECRET;
    if (!secret || secret.length < 32) {
      throw new ServiceUnavailableException('Draft preview signing is not configured');
    }
    return secret;
  }
}

const adminPageSummarySelect = {
  id: true,
  site: true,
  locale: true,
  path: true,
  internalName: true,
  firstPublishedAt: true,
  updatedAt: true,
  activeRevision: {
    select: {
      id: true,
      revisionNumber: true,
      publishedAt: true,
      updatedAt: true,
      noIndex: true,
      _count: { select: { sections: true } },
    },
  },
  draftRevision: {
    select: {
      id: true,
      revisionNumber: true,
      version: true,
      readinessState: true,
      readinessIssues: true,
      updatedAt: true,
      _count: { select: { sections: true } },
    },
  },
} satisfies Prisma.PublicSitePageSelect;

type AdminPageSummary = Prisma.PublicSitePageGetPayload<{ select: typeof adminPageSummarySelect }>;
type AdminPageSummaryWithOwnership = AdminPageSummary & {
  ownership: PublicSiteOwnership;
  manifestLabel: string | null;
};

function adminPageSummaryWithOwnership(row: AdminPageSummary): AdminPageSummaryWithOwnership {
  return {
    ...row,
    ownership: publicSiteOwnership(row.site, row.path, Boolean(row.activeRevision)),
    manifestLabel: publicSiteManifestEntry(row.site, row.path)?.label ?? null,
  };
}

function groupPageRoutes(rows: AdminPageSummaryWithOwnership[]) {
  const groups = new Map<string, {
    groupKey: string;
    site: PublicSiteKey;
    path: string;
    label: string;
    ownership: PublicSiteOwnership;
    translations: AdminPageSummaryWithOwnership[];
  }>();
  for (const row of rows) {
    const key = `${row.site}:${row.path}`;
    const group = groups.get(key) ?? {
      groupKey: key,
      site: row.site,
      path: row.path,
      label: row.manifestLabel ?? row.internalName,
      ownership: row.ownership,
      translations: [],
    };
    group.translations.push(row);
    if (group.ownership !== row.ownership) group.ownership = 'OWNERSHIP_CONFLICT';
    groups.set(key, group);
  }
  return [...groups.values()];
}

function pageResult<T>(items: T[], page: number, take: number, total: number, summary: unknown) {
  return {
    items,
    page,
    take,
    total,
    totalPages: Math.max(1, Math.ceil(total / take)),
    summary,
    summaryAvailable: summary !== null,
  };
}

function ownershipFilter(
  ownership: AdminPublicSitePageListQueryDto['ownership'],
  site?: PublicSiteKey,
): Prisma.PublicSitePageWhereInput | null {
  if (!ownership) return null;
  if (ownership === 'CMS_LIVE') return { activeRevisionId: { not: null } };
  const entries = publicSiteRouteManifest.filter((entry) => !site || entry.site === site);
  const routes = entries
    .filter((entry) =>
      ownership === 'CODE_FALLBACK'
        ? entry.codeFallback
        : ownership === 'NOT_SERVED'
          ? !entry.codeFallback
          : false,
    )
    .map((entry) => ({ site: entry.site, path: entry.path }));
  if (ownership === 'OWNERSHIP_CONFLICT') {
    return {
      NOT: {
        OR: entries.map((entry) => ({ site: entry.site, path: entry.path })),
      },
    };
  }
  return { activeRevisionId: null, OR: routes.length ? routes : [{ id: '__no_matching_route__' }] };
}

function assertConfirmedPath(currentPath: string, confirmationPath: string) {
  if (currentPath !== confirmationPath) {
    throw new ConflictException({
      code: 'PUBLIC_SITE_PATH_CHANGED',
      message: 'The page path changed. Reload the page and confirm the current path before continuing.',
      currentPath,
    });
  }
}

function requiredDraft<T extends { draftRevision: RevisionWithSections | null }>(page: T) {
  if (!page.draftRevision) throw new ConflictException('Open a Draft before editing this page');
  return page.draftRevision;
}

function assertExpectedVersion(actual: number, expected?: number) {
  if (expected !== undefined && actual !== expected) throwDraftConflict();
}

function throwDraftConflict(): never {
  throw new ConflictException({
    code: 'DRAFT_CONFLICT',
    message: 'This Draft changed while you were editing. Reload and compare before saving again.',
  });
}

async function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  pageId: string,
  metadata: Prisma.InputJsonObject,
) {
  await tx.adminAuditLog.create({
    data: { actorId, action, target: `public_site_page:${pageId}`, metadata },
  });
}

function newsContent(input: CreatePublicSiteNewsDraftDto) {
  return {
    eyebrow: 'HANDS NEWS',
    title: input.title,
    subtitle: input.subtitle,
    body: input.body,
    imageUrl: input.imageUrl ?? null,
  } satisfies Prisma.InputJsonObject;
}

export function publicSiteRevisionReadiness(input: {
  seoTitle?: string | null;
  seoDescription?: string | null;
  sections: Array<{
    key?: string;
    kind: PublicSiteSectionKind | string;
    content: unknown;
    enabled: boolean;
  }>;
}) {
  const issues: string[] = [];
  if (!textValue(input.seoTitle)) issues.push('SEO title is required.');
  if (!textValue(input.seoDescription)) issues.push('SEO description is required.');
  const enabled = input.sections.filter((section) => section.enabled);
  if (!enabled.length) issues.push('At least one enabled section is required.');
  for (const section of enabled) {
    const normalized = normalizePublicSiteSection(section.kind, section.content);
    if (!normalized) issues.push(`${section.key ?? section.kind}: content cannot be rendered.`);
  }
  return {
    state: issues.length
      ? PublicSiteRevisionReadinessState.BLOCKED
      : PublicSiteRevisionReadinessState.READY,
    issues,
  };
}

export type PublicSiteSectionRenderModel = NonNullable<
  ReturnType<typeof normalizePublicSiteSection>
>;

export function normalizePublicSiteSection(kind: string, content: unknown) {
  if (!isObject(content)) return null;
  const eyebrow = textValue(content.eyebrow);
  const title = textValue(content.title);
  const subtitle = textValue(content.subtitle);
  const body = textValue(content.body);
  const imageUrl = safePublicHref(content.imageUrl);
  const actionLabel = textValue(content.actionLabel);
  const actionHref = safePublicHref(content.actionHref);
  const items = Array.isArray(content.items)
    ? content.items.flatMap((item) => {
        if (!isObject(item)) return [];
        const itemTitle = textValue(item.title) ?? textValue(item.question);
        const itemBody = textValue(item.body) ?? textValue(item.answer);
        const href = safePublicHref(item.href);
        const label = textValue(item.label);
        return itemTitle || itemBody || (href && label)
          ? [{ title: itemTitle, body: itemBody, href, label }]
          : [];
      })
    : [];

  if (kind === 'HERO') {
    return title ? { variant: 'hero' as const, eyebrow, title, subtitle, body, imageUrl, actionLabel, actionHref, items: [] } : null;
  }
  if (kind === 'FAQ') {
    return items.some((item) => item.title && item.body)
      ? { variant: 'faq' as const, eyebrow, title, subtitle, body, imageUrl, actionLabel, actionHref, items }
      : null;
  }
  if (kind === 'LEGAL_DOCUMENT') {
    return title && body
      ? { variant: 'document' as const, eyebrow, title, subtitle, body, imageUrl, actionLabel, actionHref, items }
      : null;
  }
  if (kind === 'CTA') {
    return title && actionLabel && actionHref
      ? { variant: 'cta' as const, eyebrow, title, subtitle, body, imageUrl, actionLabel, actionHref, items }
      : null;
  }
  if (!eyebrow && !title && !subtitle && !body && !imageUrl && !items.length && !(actionLabel && actionHref)) {
    return null;
  }
  return { variant: 'content' as const, eyebrow, title, subtitle, body, imageUrl, actionLabel, actionHref, items };
}

function publicPageResponse(
  page: { id: string; site: PublicSiteKey; locale: string; path: string },
  revision: RevisionWithSections,
  preview: boolean,
) {
  return {
    id: page.id,
    site: page.site,
    locale: page.locale,
    path: page.path,
    status: preview ? 'DRAFT_PREVIEW' : 'PUBLISHED',
    revisionId: revision.id,
    revisionNumber: revision.revisionNumber,
    version: revision.version,
    seoTitle: revision.seoTitle,
    seoDescription: revision.seoDescription,
    canonicalPath: revision.canonicalPath,
    noIndex: preview || revision.noIndex,
    publishedAt: revision.publishedAt,
    updatedAt: revision.updatedAt,
    sections: revision.sections.flatMap((section) => {
      if (!section.enabled) return [];
      const renderModel = normalizePublicSiteSection(section.kind, section.content);
      return renderModel
        ? [{ id: section.id, key: section.key, kind: section.kind, sortOrder: section.sortOrder, enabled: true, renderModel }]
        : [];
    }),
  };
}

function textValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safePublicHref(value: unknown) {
  if (typeof value !== 'string') return null;
  const href = value.trim();
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function assertPublicSiteContentSize(content?: Record<string, unknown>) {
  if (content && JSON.stringify(content).length > 50_000) {
    throw new BadRequestException('Public site section content exceeds 50KB');
  }
}

function assertPublicSiteContentContract(kind: string, content?: Record<string, unknown>) {
  if (!content) return;
  const allowed = new Set([
    'eyebrow',
    'title',
    'subtitle',
    'body',
    'imageUrl',
    'actionLabel',
    'actionHref',
    'items',
  ]);
  const unsupported = Object.keys(content).filter((key) => !allowed.has(key));
  if (unsupported.length) {
    throw new BadRequestException(`Unsupported content keys: ${unsupported.join(', ')}`);
  }
  for (const key of ['imageUrl', 'actionHref'] as const) {
    const value = content[key];
    if (typeof value === 'string' && value.trim() && !safePublicHref(value)) {
      throw new BadRequestException(`${key} must be a relative path or HTTPS URL`);
    }
  }
  if (content.items !== undefined && !Array.isArray(content.items)) {
    throw new BadRequestException('items must be an array');
  }
  for (const item of Array.isArray(content.items) ? content.items : []) {
    if (!isObject(item)) throw new BadRequestException('Each content item must be an object');
    const itemKeys = Object.keys(item);
    const allowedItemKeys = kind === 'FAQ'
      ? new Set(['question', 'answer', 'title', 'body'])
      : new Set(['title', 'body', 'href', 'label']);
    const unsupportedItemKeys = itemKeys.filter((key) => !allowedItemKeys.has(key));
    if (unsupportedItemKeys.length) {
      throw new BadRequestException(`Unsupported item keys: ${unsupportedItemKeys.join(', ')}`);
    }
    if ('href' in item && typeof item.href === 'string' && item.href.trim() && !safePublicHref(item.href)) {
      throw new BadRequestException('Item href must be a relative path or HTTPS URL');
    }
  }
}

function throwPublicSiteConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictException('Public site route or Draft section key already exists');
  }
  throw error;
}
