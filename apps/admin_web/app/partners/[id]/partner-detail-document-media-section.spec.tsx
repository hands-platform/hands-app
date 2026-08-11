import { readFileSync } from 'node:fs';
import {
  PartnerDetailPublicProfileMediaCard,
  PartnerDetailTypedDocumentsCard,
} from './partner-detail-document-media-section';

describe('partner detail document and media sections', () => {
  it('keeps typed KYC evidence compact and omits storage metadata', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-document-media-section.tsx', 'utf8');

    expect(source).toContain('partner-document-compact-grid');
    expect(source).toContain('partner-evidence-preview');
    expect(source).toContain('AdminEmptyState');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('uploadedAt');
    expect(source).not.toContain('fileLabel');
    expect(source).not.toContain('assetLabel');
    expect(source).not.toContain('detailLabel');
    expect(source).not.toContain('admin-table-scroll');
    expect(source).not.toContain('document.reviewActions');
  });

  it('renders compact evidence with one overall approve or hold decision', () => {
    const section = PartnerDetailTypedDocumentsCard({
      canApprove: true,
      canReview: true,
      decisionQueue: 'approval-pending',
      hasKycRecord: true,
      holdReason: 'Please upload a clearer identity photo.',
      kycStatus: 'PENDING',
      partnerId: 'partner-1',
      rows: [
        {
          fileHref: '/files/file-1/open',
          previewable: true,
          id: 'doc-1',
          rejectionReason: 'Upload the full front side again.',
          reviewHint: 'Front side must match the KYC identity.',
          status: 'PENDING_REVIEW',
          statusTone: 'pill-warn',
          typeLabel: 'CCCD front',
        },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('KYC evidence');
    expect(rendered).toContain('Typed documents');
    expect(rendered).toContain('CCCD front');
    expect(rendered).toContain('Front side must match the KYC identity.');
    expect(rendered).toContain('Upload the full front side again.');
    expect(rendered).toContain('PENDING_REVIEW');
    expect(rendered).toContain('Overall KYC review');
    expect(rendered).toContain('Awaiting decision');
    expect(rendered).toContain('Approve');
    expect(rendered).toContain('Current hold reason: Please upload a clearer identity photo.');
    expect(rendered).toContain('Put on hold');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining([
      '/files/file-1/open',
      '/partners/partner-1?section=dossier&dossier=evidence&decisionQueue=approval-pending&providerId=partner-1&reviewAction=approve-kyc',
      '/partners/partner-1?section=dossier&dossier=evidence&decisionQueue=approval-pending&providerId=partner-1&reviewAction=hold-kyc',
    ]));
    expect(hrefsIn(section)).not.toContain('/partners/partner-1?reviewAction=approve-document');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-card partner-detail-evidence-card',
        'partner-document-compact-grid',
        'partner-document-compact-item',
        'partner-evidence-preview',
        'partner-evidence-preview-placeholder',
        'partner-kyc-overall-decision',
      ]),
    );
    expect(inputNamesIn(section)).toEqual([]);
  });

  it('renders ordered public photos with upload, review, move, and delete controls', () => {
    const section = PartnerDetailPublicProfileMediaCard({
      canEdit: true,
      canReview: true,
      partnerId: 'partner-1',
      rows: [
        {
          fileHref: 'https://cdn.example.test/profile.png',
          previewable: true,
          id: 'media-1',
          reviewActions: [
            {
              href: '/partners/partner-1?reviewAction=approve-media',
              kind: 'link',
              label: 'Approve public media',
              tone: 'success',
            },
          ],
          reviewLabel: 'Media review actions for media-1',
          reviewStatus: 'APPROVED',
          reviewStatusTone: 'pill-success',
          typeLabel: 'Profile image',
        },
        {
          fileHref: 'https://cdn.example.test/work.png',
          previewable: true,
          id: 'media-2',
          reviewActions: [],
          reviewLabel: 'Media review actions for media-2',
          reviewStatus: 'APPROVED',
          reviewStatusTone: 'pill-success',
          typeLabel: 'Work photo',
        },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));
    const names = inputNamesIn(section);
    const ariaLabels = ariaLabelsIn(section);

    expect(rendered).toContain('Customer app');
    expect(rendered).toContain('Public profile media');
    expect(rendered).toContain('Photo type');
    expect(rendered).toContain('Add photo');
    expect(rendered).toContain('APPROVED');
    expect(names).toEqual(expect.arrayContaining(['providerId', 'purpose', 'photo', 'fileId', 'fileIds', 'direction']));
    expect(ariaLabels).toEqual(
      expect.arrayContaining([
        'Move Profile image left',
        'Move Profile image right',
        'Delete Profile image',
        'Move Work photo left',
        'Move Work photo right',
        'Delete Work photo',
      ]),
    );
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        'https://cdn.example.test/profile.png',
        'https://cdn.example.test/work.png',
        '/partners/partner-1?reviewAction=approve-media',
        '/partners/partner-1?section=dossier&dossier=evidence&providerId=partner-1&reviewAction=delete-media&fileId=media-1',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-card partner-detail-public-media-card',
        'partner-public-media-grid',
        'partner-public-media-item',
        'partner-public-media-order-actions',
      ]),
    );
  });

  it('does not expose raw media URLs or upload timestamps as visible copy', () => {
    const section = PartnerDetailPublicProfileMediaCard({
      canEdit: true,
      canReview: true,
      partnerId: 'partner-1',
      rows: [
        {
          fileHref: 'https://cdn.example.test/private-looking-key.png',
          id: 'media-1',
          previewable: true,
          reviewActions: [],
          reviewLabel: 'Media review actions for media-1',
          reviewStatus: 'APPROVED',
          reviewStatusTone: 'pill-success',
          typeLabel: 'Work photo',
        },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).not.toContain('https://cdn.example.test/private-looking-key.png');
    expect(rendered).not.toContain('uploaded');
    expect(rendered).not.toContain('reviewed');
  });

  it('keeps KYC and public media read-only without edit permissions', () => {
    const kyc = PartnerDetailTypedDocumentsCard({
      canApprove: false,
      canReview: false,
      hasKycRecord: true,
      kycStatus: 'DRAFT',
      partnerId: 'partner-1',
      rows: [],
    });
    const media = PartnerDetailPublicProfileMediaCard({
      canEdit: false,
      canReview: false,
      partnerId: 'partner-1',
      rows: [],
    });

    expect(normalizeSpaces(textContent(kyc))).toContain('Read-only KYC evidence');
    expect(normalizeSpaces(textContent(media))).toContain('Read-only public profile media');
    expect(inputNamesIn(kyc)).toEqual([]);
    expect(inputNamesIn(media)).toEqual([]);
  });
});

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function hrefsIn(value: unknown): string[] {
  return stringPropsIn(value, 'href');
}

function classNamesIn(value: unknown): string[] {
  return stringPropsIn(value, 'className');
}

function inputNamesIn(value: unknown): string[] {
  return stringPropsIn(value, 'name');
}

function ariaLabelsIn(value: unknown): string[] {
  return stringPropsIn(value, 'aria-label');
}

function stringPropsIn(value: unknown, key: string): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => stringPropsIn(item, key));
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const own = typeof props?.[key] === 'string' ? [props[key] as string] : [];
  return [...own, ...stringPropsIn(props?.children, key)];
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
