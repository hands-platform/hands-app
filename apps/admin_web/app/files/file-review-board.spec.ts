import type { AdminProvider } from '../../lib/admin-api';
import {
  buildFileReviewConfirmationProviders,
  buildFileReviewItemRows,
  buildFileReviewRows,
  buildFileReviewSummary,
  fileReviewPurposeLabel,
  filterFileReviewRows,
} from './file-review-board';

describe('file review board', () => {
  it('builds sorted private verification and public media rows', () => {
    const rows = buildFileReviewRows([
      partner({
        displayName: 'Provider Linh',
        status: 'ONLINE_BUSY',
        user: {
          fileAssets: [
            {
              contentType: 'image/png',
              id: 'public-approved',
              key: 'partners/linh/gallery.png',
              purpose: 'GALLERY_PHOTO',
              reviewStatus: 'APPROVED',
              uploadStatus: 'UPLOADED',
              uploadedAt: '2026-06-08T09:00:00.000Z',
              url: 'https://cdn.example.test/gallery.png',
              visibility: 'PUBLIC',
            },
          ],
        },
        verification: {
          files: [
            {
              contentType: 'image/jpeg',
              id: 'private-pending',
              key: 'private/linh/cccd.jpg',
              purpose: 'CCCD_FRONT',
              reviewStatus: 'PENDING_REVIEW',
              sizeBytes: 2048,
              uploadStatus: 'UPLOADED',
              uploadedAt: '2026-06-09T09:00:00.000Z',
              visibility: 'PRIVATE',
            },
          ],
          id: 'verification-1',
          status: 'PENDING_REVIEW',
        },
      }),
    ]);

    expect(rows.map((row) => [row.id, row.kind, row.partnerName, row.partnerAvatarStatus, row.statusTone])).toEqual([
      ['private-pending', 'private-verification', 'Partner Linh', 'working', 'warning'],
      ['public-approved', 'public-media', 'Partner Linh', 'working', 'success'],
    ]);
    expect(rows[0]?.fileHref).toBe('/files/private-pending/open');
    expect(rows[1]?.fileHref).toBe('https://cdn.example.test/gallery.png');
  });

  it('filters by review state, kind, and search query', () => {
    const rows = buildFileReviewRows([
      partner({
        user: {
          fileAssets: [
            {
              contentType: 'image/jpeg',
              id: 'media-rejected',
              key: 'partners/mai/profile.jpg',
              purpose: 'PROFILE_PHOTO',
              reviewReason: 'Face is not clear enough',
              reviewStatus: 'REJECTED',
              uploadStatus: 'UPLOADED',
              visibility: 'PUBLIC',
            },
          ],
        },
      }),
    ]);

    expect(filterFileReviewRows(rows, { kind: 'public-media', q: 'face', review: 'rejected' })).toHaveLength(1);
    expect(filterFileReviewRows(rows, { kind: 'private-verification', q: '', review: '' })).toHaveLength(0);
    expect(filterFileReviewRows(rows, { kind: '', q: '', review: 'approved' })).toHaveLength(0);
  });

  it('summarizes review and upload states', () => {
    const rows = buildFileReviewRows([
      partner({
        user: {
          fileAssets: [
            {
              contentType: 'image/jpeg',
              id: 'media-pending',
              key: 'partners/mai/profile.jpg',
              purpose: 'PROFILE_PHOTO',
              reviewStatus: 'PENDING_REVIEW',
              uploadStatus: 'PENDING',
              visibility: 'PUBLIC',
            },
            {
              contentType: 'image/jpeg',
              id: 'media-rejected',
              key: 'partners/mai/gallery.jpg',
              purpose: 'GALLERY_PHOTO',
              reviewStatus: 'REJECTED',
              uploadStatus: 'UPLOADED',
              visibility: 'PUBLIC',
            },
          ],
        },
      }),
    ]);

    expect(buildFileReviewSummary(rows)).toEqual({
      approved: 0,
      pendingReview: 2,
      privateFiles: 0,
      publicMedia: 2,
      rejected: 1,
      total: 2,
      uploadIncomplete: 1,
    });
  });

  it('humanizes file purpose labels', () => {
    expect(fileReviewPurposeLabel('PROFILE_PHOTO')).toBe('Profile Photo');
    expect(fileReviewPurposeLabel('PROVIDER_VERIFICATION')).toBe('Partner Verification');
    expect(fileReviewPurposeLabel(null)).toBe('Unlabeled file');
  });

  it('maps compact API items without exposing private URLs and preserves public action evidence', () => {
    const items = [
      {
        contentType: 'image/jpeg',
        createdAt: '2026-07-01T00:00:00.000Z',
        id: 'private-file',
        key: 'private/identity.jpg',
        kind: 'private-verification' as const,
        partner: {
          displayName: 'Linh Partner',
          id: 'partner-1',
          status: 'OFFLINE',
          userId: 'user-1',
        },
        purpose: 'PROVIDER_VERIFICATION',
        reviewStatus: 'PENDING_REVIEW',
        uploadStatus: 'UPLOADED',
        url: null,
        visibility: 'PRIVATE',
      },
      {
        contentType: 'image/jpeg',
        createdAt: '2026-07-02T00:00:00.000Z',
        id: 'public-file',
        key: 'partners/linh/gallery.jpg',
        kind: 'public-media' as const,
        partner: {
          displayName: 'Linh Partner',
          id: 'partner-1',
          status: 'ONLINE_AVAILABLE',
          userId: 'user-1',
        },
        purpose: 'PROVIDER_GALLERY',
        reviewStatus: 'PENDING_REVIEW',
        uploadStatus: 'UPLOADED',
        url: 'https://cdn.example.test/gallery.jpg',
        visibility: 'PUBLIC',
      },
    ];

    const rows = buildFileReviewItemRows(items);
    expect(rows.map((row) => [row.id, row.fileHref, row.partnerAvatarStatus])).toEqual([
      ['public-file', 'https://cdn.example.test/gallery.jpg', 'online'],
      ['private-file', '/files/private-file/open', 'offline'],
    ]);
    expect(buildFileReviewConfirmationProviders(items)).toEqual([
      expect.objectContaining({
        id: 'partner-1',
        user: expect.objectContaining({
          fileAssets: [expect.objectContaining({ id: 'public-file' })],
        }),
      }),
    ]);
  });
});

function partner(input: Partial<AdminProvider>): AdminProvider {
  return {
    displayName: 'Mai Partner',
    id: 'partner-files-1',
    status: 'PENDING_REVIEW',
    ...input,
  } as AdminProvider;
}
