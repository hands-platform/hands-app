import { readFileSync } from 'node:fs';
import {
  PartnerDetailPublicProfileMediaCard,
  PartnerDetailTypedDocumentsCard,
} from './partner-detail-document-media-section';

describe('partner detail document and media sections', () => {
  it('uses the partner detail Vuexy table panel atom for document and media shells', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-document-media-section.tsx', 'utf8');

    expect(source).toContain('PartnerDetailVuexyTablePanel');
    expect(source).not.toContain('AdminFilterPanel');
    expect(source).not.toContain('partnerDetailReviewCardClassName');
  });

  it('uses the shared Vuexy empty-state atom', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-document-media-section.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<strong>No evidence found</strong>');
    expect(source).not.toContain('<span className={`pill ${document.statusTone}`}>{document.status}</span>');
    expect(source).not.toContain('<span className="pill pill-success">{file.uploadStatus}</span>');
  });

  it('renders typed onboarding documents in a Vuexy table with dropdown review actions', () => {
    const section = PartnerDetailTypedDocumentsCard({
      rows: [
        {
          assetLabel: 'image/jpeg / 20 Jun 2026, 10:00',
          fileHref: '/files/file-1/open',
          fileLabel: 'private/cccd-front.jpg',
          id: 'doc-1',
          rejectionReason: 'Upload the full front side again.',
          reviewActions: [
            {
              href: '/partners/partner-1?reviewAction=approve-document',
              kind: 'link',
              label: 'Approve doc',
              tone: 'success',
            },
          ],
          reviewHint: 'Front side must match the KYC identity.',
          reviewLabel: 'Document review actions for doc-1',
          status: 'PENDING_REVIEW',
          statusTone: 'pill-warn',
          typeLabel: 'CCCD front',
        },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Typed documents');
    expect(rendered).toContain('1 document(s)');
    expect(rendered).toContain('CCCD front');
    expect(rendered).toContain('Front side must match the KYC identity.');
    expect(rendered).toContain('Partner app correction: Upload the full front side again.');
    expect(rendered).toContain('PENDING_REVIEW');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/files/file-1/open', '/partners/partner-1?reviewAction=approve-document']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'files-open-action',
        'admin-action-dropdown action-menu-dropdown',
      ]),
    );
  });

  it('renders public profile media in the same table pattern', () => {
    const section = PartnerDetailPublicProfileMediaCard({
      rows: [
        {
          detailLabel: 'image/png / 200 KB / uploaded 20 Jun 2026, 10:00',
          fileHref: 'https://cdn.example.test/profile.png',
          fileLabel: 'public/profile.png',
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
          reviewedLabel: null,
          reviewReason: null,
          reviewStatus: 'APPROVED',
          reviewStatusTone: 'pill-success',
          uploadStatus: 'UPLOADED',
          typeLabel: 'Profile image',
        },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Public profile media');
    expect(rendered).toContain('1 asset(s)');
    expect(rendered).toContain('Profile image');
    expect(rendered).toContain('UPLOADED');
    expect(rendered).toContain('APPROVED');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        'https://cdn.example.test/profile.png',
        '/partners/partner-1?reviewAction=approve-media',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-success',
      ]),
    );
  });

  it('prefers shared date nodes over fallback document and media date text', () => {
    const typedDocuments = PartnerDetailTypedDocumentsCard({
      rows: [
        {
          assetLabel: 'Fallback document uploaded date',
          assetLabelNode: <span>Shared document uploaded date marker</span>,
          fileHref: '/files/file-2/open',
          fileLabel: 'private/cccd-back.jpg',
          id: 'doc-2',
          rejectionReason: null,
          reviewActions: [],
          reviewHint: 'Back side must match the KYC identity.',
          reviewLabel: 'Document review actions for doc-2',
          status: 'APPROVED',
          statusTone: 'pill-success',
          typeLabel: 'CCCD back',
        },
      ],
    });
    const publicMedia = PartnerDetailPublicProfileMediaCard({
      rows: [
        {
          detailLabel: 'Fallback media uploaded date',
          detailLabelNode: <span>Shared media uploaded date marker</span>,
          fileHref: 'https://cdn.example.test/work.png',
          fileLabel: 'public/work.png',
          id: 'media-2',
          reviewActions: [],
          reviewLabel: 'Media review actions for media-2',
          reviewedLabel: 'Fallback reviewed date',
          reviewedLabelNode: <span>Shared reviewed date marker</span>,
          reviewReason: null,
          reviewStatus: 'APPROVED',
          reviewStatusTone: 'pill-success',
          uploadStatus: 'UPLOADED',
          typeLabel: 'Work photo',
        },
      ],
    });
    const rendered = normalizeSpaces(`${textContent(typedDocuments)} ${textContent(publicMedia)}`);
    const source = readFileSync('app/partners/[id]/partner-detail-document-media-section.tsx', 'utf8');
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(rendered).toContain('Shared document uploaded date marker');
    expect(rendered).toContain('Shared media uploaded date marker');
    expect(rendered).toContain('Shared reviewed date marker');
    expect(rendered).not.toContain('Fallback document uploaded date');
    expect(rendered).not.toContain('Fallback media uploaded date');
    expect(rendered).not.toContain('Fallback reviewed date');
    expect(source).toContain('readonly assetLabelNode?: ReactNode;');
    expect(source).toContain('readonly detailLabelNode?: ReactNode;');
    expect(source).toContain('readonly reviewedLabelNode?: ReactNode;');
    expect(source).toContain('document.assetLabelNode ?? marketplaceDisplayText(document.assetLabel)');
    expect(source).toContain('file.detailLabelNode ?? file.detailLabel');
    expect(source).toContain('file.reviewedLabelNode ?? file.reviewedLabel');
    expect(pageSource).toContain('<DateTimeText fallback="Missing" value={document.fileAsset.uploadedAt} />');
    expect(pageSource).toContain('<DateTimeText fallback="Missing" value={file.uploadedAt} />');
    expect(pageSource).toContain('<DateTimeText fallback="Missing" value={file.reviewedAt} />');
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
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

function classNamesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
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
