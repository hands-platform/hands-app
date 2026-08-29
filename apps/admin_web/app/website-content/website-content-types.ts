export type PublicSiteKey = 'MAIN' | 'PARTNER_RECRUITMENT';
export type PublicSiteRevisionState = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type PublicSiteReadinessState = 'READY' | 'BLOCKED' | 'UNKNOWN';
export type PublicSiteOwnership = 'CMS_LIVE' | 'CODE_FALLBACK' | 'NOT_SERVED' | 'OWNERSHIP_CONFLICT';
export type PublicSiteSectionKind =
  | 'HERO'
  | 'APP_OVERVIEW'
  | 'PARTNER_DIRECTORY'
  | 'PARTNER_DETAIL'
  | 'RECRUITMENT_BENEFITS'
  | 'RECRUITMENT_PROCESS'
  | 'COMPANY_INFORMATION'
  | 'CONTACT'
  | 'LEGAL_DOCUMENT'
  | 'FAQ'
  | 'CTA';

export type PublicSiteRevisionSummary = {
  id: string;
  revisionNumber: number;
  version: number;
  state: PublicSiteRevisionState;
  readinessState: PublicSiteReadinessState;
  readinessIssues: unknown;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalPath?: string | null;
  noIndex: boolean;
  publishedAt?: string | null;
  publishedById?: string | null;
  publishedByLabel?: string | null;
  updatedAt: string;
};

export type PublicSiteSection = {
  id: string;
  revisionId: string;
  key: string;
  kind: PublicSiteSectionKind;
  content: Record<string, unknown>;
  sortOrder: number;
  enabled: boolean;
  updatedAt: string;
};

export type PublicSiteRevision = PublicSiteRevisionSummary & {
  sections: PublicSiteSection[];
};

export type PublicSitePageDetail = {
  id: string;
  site: PublicSiteKey;
  locale: string;
  path: string;
  internalName: string;
  activeRevisionId?: string | null;
  draftRevisionId?: string | null;
  firstPublishedAt?: string | null;
  updatedAt: string;
  activeRevision?: PublicSiteRevision | null;
  draftRevision?: PublicSiteRevision | null;
  revisions: PublicSiteRevisionSummary[];
  ownership: PublicSiteOwnership;
  manifestLabel?: string | null;
  offlineVisitorOutcome?: 'CODE_FALLBACK' | 'NOT_SERVED';
  activity?: Array<{
    id: string;
    action: string;
    createdAt: string;
    actor?: { id: string; label: string } | null;
    metadata?: unknown;
  }>;
};

export type PublicSitePageSummary = {
  id: string;
  site: PublicSiteKey;
  locale: string;
  path: string;
  internalName: string;
  firstPublishedAt?: string | null;
  updatedAt: string;
  activeRevision?: {
    id: string;
    revisionNumber: number;
    publishedAt?: string | null;
    updatedAt: string;
    noIndex: boolean;
    _count: { sections: number };
  } | null;
  draftRevision?: {
    id: string;
    revisionNumber: number;
    version: number;
    readinessState: PublicSiteReadinessState;
    readinessIssues: unknown;
    updatedAt: string;
    _count: { sections: number };
  } | null;
  ownership: PublicSiteOwnership;
  manifestLabel?: string | null;
};

export type PublicSiteRouteGroup = {
  groupKey: string;
  site: PublicSiteKey;
  path: string;
  label: string;
  ownership: PublicSiteOwnership;
  translations: PublicSitePageSummary[];
};

export type PublicSiteManifestQueueRow = {
  key: string;
  kind: 'MISSING_ROUTE' | 'MISSING_TRANSLATION';
  site: PublicSiteKey;
  path: string;
  locale: string;
  label: string;
  ownership: PublicSiteOwnership;
  reason: string;
  recommendedAction: string;
};

export type PublicSiteListSummary = {
  viewScope: {
    routes: number;
    live: number;
    draftChanges: number;
    ready: number;
    needsAttention: number;
    recentlyPublished: number;
    scope: {
      contentType: 'pages' | 'news';
      site: string | null;
      locale: string | null;
      q: string | null;
      status: string;
      readiness: string | null;
      ownership: string | null;
    };
  };
  manifestHealth: {
    scope: 'GLOBAL_CANONICAL';
    expectedRoutes: number;
    expectedRows: number;
    missingRoutes: number;
    missingTranslations: number;
    staleTranslations: number | null;
    staleTranslationsApplicable: boolean;
  };
  generatedAt: string;
};

export type PublicSiteListResult<T> = {
  items: T[];
  page: number;
  take: number;
  total: number;
  totalPages: number;
  summary: PublicSiteListSummary | null;
  summaryAvailable: boolean;
};

export type PublicSitePreviewLink = {
  token: string;
  expiresAt: string;
  site: PublicSiteKey;
  locale: string;
  path: string;
  revisionId: string;
  version: number;
};

export type PublicSiteCacheInvalidation = {
  status: 'FAILED' | 'NOT_CONFIGURED' | 'SUCCEEDED';
  requestId: string;
  hostCount: number;
  succeededHostCount: number;
};

export const publicSiteOptions = [
  { label: 'hands.vn', value: 'MAIN' },
  { label: 'join.hands.vn', value: 'PARTNER_RECRUITMENT' },
] as const;

export const publicSiteLocaleOptions = ['vi', 'ko', 'en', 'ja', 'zh'].map((locale) => ({
  label: locale.toUpperCase(),
  value: locale,
}));

export const publicSiteSectionKindOptions: Array<{
  label: string;
  value: PublicSiteSectionKind;
}> = [
  { label: 'Hero', value: 'HERO' },
  { label: 'App overview', value: 'APP_OVERVIEW' },
  { label: 'Partner directory', value: 'PARTNER_DIRECTORY' },
  { label: 'Partner detail', value: 'PARTNER_DETAIL' },
  { label: 'Recruitment benefits', value: 'RECRUITMENT_BENEFITS' },
  { label: 'Recruitment process', value: 'RECRUITMENT_PROCESS' },
  { label: 'Company information', value: 'COMPANY_INFORMATION' },
  { label: 'Contact', value: 'CONTACT' },
  { label: 'Legal document', value: 'LEGAL_DOCUMENT' },
  { label: 'FAQ', value: 'FAQ' },
  { label: 'CTA', value: 'CTA' },
];

export function readinessIssues(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
