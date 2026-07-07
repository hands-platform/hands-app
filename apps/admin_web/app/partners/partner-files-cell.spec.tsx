import { readFileSync } from 'node:fs';

import type { ActionMenuItem } from '../../components/action-menu';
import type { AdminProvider } from '../../lib/admin-api';
import {
  PartnerFilesCell,
  type PartnerFilesCellPublicMedia,
} from './partner-files-cell';

describe('PartnerFilesCell', () => {
  it('uses shared Vuexy badge atoms instead of raw file review pill spans', () => {
    const source = readFileSync('app/partners/partner-files-cell.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).toContain('AdminFilterChipGroup');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('AdminFormControlLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain("` / uploaded ${formatDateTime(file.uploadedAt)}`");
    expect(source).not.toContain('<span className="pill pill-info">{file.purpose ?? \'Partner verification\'}</span>');
    expect(source).not.toContain('<span className={`pill ${file.uploadStatus === \'UPLOADED\' ? \'pill-success\' : \'pill-warn\'}`}>');
    expect(source).not.toContain('<span className="pill pill-info">{file.purpose}</span>');
    expect(source).not.toContain('<span className={`pill ${publicMediaReviewPillClass(file.reviewStatus)}`}>');
    expect(source).not.toContain('<p className="muted">No private verification files.</p>');
  });

  it('renders private verification files and public media review actions', () => {
    const cell = PartnerFilesCell({
      partnerName: 'Linh Wellness',
      provider: {
        id: 'partner-files',
        user: {
          fileAssets: [
            {
              contentType: 'image/png',
              id: 'media-1',
              key: 'public/profile.png',
              purpose: 'PROFILE_PHOTO',
              reviewReason: 'Needs clearer framing',
              reviewStatus: 'PENDING_REVIEW',
              sizeBytes: 1024,
              uploadedAt: '2026-06-08T09:00:00.000Z',
              url: 'https://cdn.example.test/profile.png',
            },
          ],
        },
        verification: {
          files: [
            {
              contentType: 'image/jpeg',
              id: 'file-1',
              key: 'private/provider-verification/identity.jpg',
              purpose: 'Partner verification',
              sizeBytes: 2048,
              uploadStatus: 'UPLOADED',
              uploadedAt: '2026-06-08T08:00:00.000Z',
            },
          ],
        },
      } as AdminProvider,
      publicMediaActions: publicMediaActions,
    });

    const rendered = normalizedText(cell);

    expect(rendered).toContain('Partner verification');
    expect(rendered).toContain('UPLOADED');
    expect(rendered).toContain('image/jpeg');
    expect(rendered).toContain('private/partner-verification/identity.jpg');
    expect(rendered).not.toContain('private/provider-verification');
    expect(rendered).toContain('Public media review');
    expect(rendered).toContain('PROFILE_PHOTO');
    expect(rendered).toContain('PENDING_REVIEW');
    expect(rendered).toContain('Reason: Needs clearer framing');
    expect(rendered).toContain('Approve media');
    expect(hrefsIn(cell)).toEqual(
      expect.arrayContaining([
        '/partners/partner-files#documents',
        'https://cdn.example.test/profile.png',
        '/partners/partner-files/media/media-1/approve',
      ]),
    );
    expect(ariaLabelsIn(cell)).toEqual(
      expect.arrayContaining(['Public media review actions for Linh Wellness']),
    );
    expect(classNamesIn(cell)).toEqual(
      expect.arrayContaining([
        'provider-file-row',
        'pill pill-success',
        'pill pill-warn',
        'text-link',
      ]),
    );
  });

  it('renders empty private and public media fallbacks', () => {
    const cell = PartnerFilesCell({
      partnerName: 'No Files',
      provider: {
        id: 'partner-empty-files',
      } as AdminProvider,
      publicMediaActions: publicMediaActions,
    });

    const rendered = normalizedText(cell);

    expect(rendered).toContain('No private verification files.');
    expect(rendered).toContain('No public profile media uploaded.');
  });
});

function publicMediaActions(
  providerId: string,
  file: PartnerFilesCellPublicMedia,
): readonly ActionMenuItem[] {
  return [
    {
      href: `/partners/${providerId}/media/${file.id}/approve`,
      kind: 'link',
      label: 'Approve media',
      tone: 'success',
    },
  ];
}

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

function normalizedText(value: unknown): string {
  return textContent(value).replace(/\s+/g, ' ').trim();
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

function ariaLabelsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(ariaLabelsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const label = typeof props?.['aria-label'] === 'string' ? [props['aria-label']] : [];
  return [...label, ...ariaLabelsIn(props?.children)];
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
