import type { AdminProvider } from '../../lib/admin-api';
import {
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
});

function partner(input: Partial<AdminProvider>): AdminProvider {
  return {
    displayName: 'Mai Partner',
    id: 'partner-files-1',
    status: 'PENDING_REVIEW',
    ...input,
  } as AdminProvider;
}
