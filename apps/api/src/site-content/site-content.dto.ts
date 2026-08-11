import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsIn,
  IsOptional,
  IsObject,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PublicSiteKey,
  PublicSitePageStatus,
  PublicSiteSectionKind,
} from '@prisma/client';

const PUBLIC_SITE_PATH_PATTERN =
  /^\/(?:(?:[a-z0-9]+(?:-[a-z0-9]+)*|\[(?:city|slug)\])(?:\/(?:[a-z0-9]+(?:-[a-z0-9]+)*|\[(?:city|slug)\]))*)?$/u;
const PUBLIC_SITE_LOCALE_PATTERN = /^(?:vi|ko|en|ja|zh)$/u;
const PUBLIC_SITE_SECTION_KEY_PATTERN = /^[a-z][a-z0-9-]{0,79}$/u;

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function optionalTrimmedString(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

export class PublicSitePageQueryDto {
  @IsEnum(PublicSiteKey)
  site!: PublicSiteKey;

  @Transform(({ value }) => trimString(value))
  @Matches(PUBLIC_SITE_LOCALE_PATTERN)
  locale!: string;

  @Transform(({ value }) => trimString(value))
  @Matches(PUBLIC_SITE_PATH_PATTERN)
  path!: string;
}

export class PublicSiteRouteQueryDto {
  @IsEnum(PublicSiteKey)
  site!: PublicSiteKey;

  @Transform(({ value }) => trimString(value))
  @Matches(PUBLIC_SITE_LOCALE_PATTERN)
  locale!: string;
}

export class AdminPublicSitePageListQueryDto {
  @IsOptional()
  @IsEnum(PublicSiteKey)
  site?: PublicSiteKey;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @Matches(PUBLIC_SITE_LOCALE_PATTERN)
  locale?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn(['pages', 'news'])
  contentType?: 'pages' | 'news';

  @IsOptional()
  @IsIn(['all', 'live', 'draft', 'attention'])
  status?: 'all' | 'live' | 'draft' | 'attention';

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}

export class CreatePublicSitePageDto {
  @IsEnum(PublicSiteKey)
  site!: PublicSiteKey;

  @Transform(({ value }) => trimString(value))
  @Matches(PUBLIC_SITE_LOCALE_PATTERN)
  locale!: string;

  @Transform(({ value }) => trimString(value))
  @Matches(PUBLIC_SITE_PATH_PATTERN)
  path!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  internalName!: string;

  @IsOptional()
  @IsEnum(PublicSitePageStatus)
  status?: PublicSitePageStatus;

  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @MaxLength(160)
  seoTitle?: string | null;

  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @MaxLength(320)
  seoDescription?: string | null;

  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @Matches(PUBLIC_SITE_PATH_PATTERN)
  canonicalPath?: string | null;

  @IsOptional()
  @IsBoolean()
  noIndex?: boolean;
}

export class UpdatePublicSitePageDto {
  @IsOptional()
  @IsEnum(PublicSiteKey)
  site?: PublicSiteKey;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @Matches(PUBLIC_SITE_LOCALE_PATTERN)
  locale?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @Matches(PUBLIC_SITE_PATH_PATTERN)
  path?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  internalName?: string;

  @IsOptional()
  @IsEnum(PublicSitePageStatus)
  status?: PublicSitePageStatus;

  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @MaxLength(160)
  seoTitle?: string | null;

  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @MaxLength(320)
  seoDescription?: string | null;

  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @Matches(PUBLIC_SITE_PATH_PATTERN)
  canonicalPath?: string | null;

  @IsOptional()
  @IsBoolean()
  noIndex?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}

export class CreatePublicSiteSectionDto {
  @Transform(({ value }) => trimString(value))
  @Matches(PUBLIC_SITE_SECTION_KEY_PATTERN)
  key!: string;

  @IsEnum(PublicSiteSectionKind)
  kind!: PublicSiteSectionKind;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;
}

export class UpdatePublicSiteSectionDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @Matches(PUBLIC_SITE_SECTION_KEY_PATTERN)
  key?: string;

  @IsOptional()
  @IsEnum(PublicSiteSectionKind)
  kind?: PublicSiteSectionKind;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}

export class PublishPublicSiteDraftDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  revisionId!: string;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class RollbackPublicSiteRevisionDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  revisionId!: string;
}

export class CreatePublicSiteNewsDraftDto {
  @Transform(({ value }) => trimString(value))
  @Matches(PUBLIC_SITE_LOCALE_PATTERN)
  locale!: string;

  @Transform(({ value }) => trimString(value))
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
  @MaxLength(100)
  slug!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(160)
  title!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(320)
  subtitle!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(50_000)
  body!: string;

  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @IsString()
  @MaxLength(2_048)
  imageUrl?: string | null;
}

export class UpdatePublicSiteNewsDraftDto extends CreatePublicSiteNewsDraftDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  revisionId!: string;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class PublicSitePreviewQueryDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  token!: string;
}
