import type { ActionMenuItem } from '../../../components/action-menu';
import { providerDocumentLabel, providerDocumentReviewHint } from '../../../lib/admin-api';
import {
  approvePublicMediaDescription,
  rejectPublicMediaDescription,
} from '../partner-action-copy';
import { partnerDetailReviewActionConfirmHref } from './partner-detail-action-menu-model';
import type {
  PartnerPublicMediaRow,
  PartnerTypedDocumentRow,
} from './partner-detail-document-media-section';
import { formatJsonList, providerPublicMediaLabel, shortRecordId } from './partner-detail-format';
import type {
  PartnerProfileOverviewFact,
  PartnerProfileTranslationValues,
} from './partner-detail-profile-overview-card';
import { readMetadataObject, readString } from './partner-detail-record-helpers';
import type {
  ProviderDetail,
  ProviderPublicFileAsset,
} from './partner-detail-types';

export function buildPartnerTypedDocumentRows(provider: ProviderDetail): PartnerTypedDocumentRow[] {
  return (provider.documents ?? []).map((document) => ({
    fileHref: document.fileAsset?.id ? `/files/${document.fileAsset.id}/open` : undefined,
    previewable: document.fileAsset?.contentType?.startsWith('image/') ?? false,
    id: document.id,
    rejectionReason: document.rejectionReason,
    reviewHint: providerDocumentReviewHint(document.type),
    status: document.status,
    statusTone:
      document.status === 'APPROVED'
        ? 'pill-success'
        : document.status === 'REJECTED'
          ? 'pill-danger'
          : 'pill-warn',
    typeLabel: providerDocumentLabel(document.type),
  }));
}

export function buildPartnerProfileOverviewFacts(
  provider: ProviderDetail,
): PartnerProfileOverviewFact[] {
  return [
    {
      helper: 'Verified legal identity',
      label: 'Legal name',
      value: provider.legalName ?? 'Missing',
    },
    {
      helper: 'Partner account contact',
      label: 'Phone',
      value: provider.user?.phone ?? 'Missing',
    },
    {
      helper: 'Current residential record',
      label: 'Address',
      value: provider.residentialAddress ?? 'Missing',
    },
    {
      helper: 'Primary service market',
      label: 'Service city',
      value: provider.city ?? 'Missing',
    },
    {
      helper: 'Partner-provided work history',
      label: 'Experience',
      value:
        provider.experienceYears === null || provider.experienceYears === undefined
          ? 'Missing'
          : `${provider.experienceYears} year(s)`,
    },
    {
      helper: 'Customer-facing services',
      label: 'Specialties',
      value: formatJsonList(provider.specialties) ?? 'Missing',
    },
    {
      helper: 'Customer communication',
      label: 'Languages',
      value: formatJsonList(provider.languages) ?? 'Missing',
    },
    {
      helper: 'Customer-facing profile style',
      label: 'Service style',
      value: provider.serviceStyle ?? 'Missing',
    },
  ];
}

export function readPartnerProfileTranslations(value: unknown): PartnerProfileTranslationValues {
  const record = readMetadataObject(value);
  return {
    en: readString(record?.en) ?? '',
    ja: readString(record?.ja) ?? '',
    ko: readString(record?.ko) ?? '',
    zh: readString(record?.zh) ?? '',
  };
}

export function partnerProfileAvatarStatus(status?: string | null) {
  const normalized = status?.toUpperCase() ?? '';
  if (normalized.includes('SERVICE') || normalized.includes('WORK')) {
    return 'working' as const;
  }
  if (normalized.includes('MATCH')) {
    return 'matching' as const;
  }
  if (normalized.includes('ONLINE')) {
    return 'online' as const;
  }
  return 'offline' as const;
}

export function buildPartnerPublicMediaRows(provider: ProviderDetail): PartnerPublicMediaRow[] {
  return (provider.user?.fileAssets ?? []).map((file) => ({
    fileHref: file.url,
    previewable: file.contentType?.startsWith('image/') ?? false,
    id: file.id,
    reviewActions: buildPartnerPublicMediaReviewActions(provider.id, file),
    reviewLabel: `Media review actions for ${shortRecordId(file.id)}`,
    reviewStatus: file.reviewStatus ?? 'PENDING_REVIEW',
    reviewStatusTone: partnerPublicMediaReviewStatusTone(file.reviewStatus),
    typeLabel: providerPublicMediaLabel(file.purpose),
  }));
}

export function buildPartnerPublicMediaReviewActions(
  providerId: string,
  file: ProviderPublicFileAsset,
): ActionMenuItem[] {
  return [
    {
      description: approvePublicMediaDescription,
      disabled: file.reviewStatus === 'APPROVED',
      href: partnerDetailReviewActionConfirmHref(providerId, 'approve-media', {
        fileId: file.id,
      }),
      kind: 'link',
      label: 'Approve public media',
      tone: 'success',
    },
    {
      description: rejectPublicMediaDescription,
      disabled: file.reviewStatus === 'REJECTED',
      href: partnerDetailReviewActionConfirmHref(providerId, 'reject-media', {
        fileId: file.id,
      }),
      kind: 'link',
      label: 'Reject media',
      tone: 'danger',
    },
  ];
}

export function partnerPublicMediaReviewStatusTone(status?: string | null) {
  if (status === 'APPROVED') {
    return 'pill-success';
  }
  if (status === 'REJECTED') {
    return 'pill-danger';
  }
  return 'pill-warn';
}
