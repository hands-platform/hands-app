import {
  adminVietnamOverviewDateWhere,
  adminVietnamOverviewRangeWindow,
  normalizeAdminVietnamOverviewRange,
  vietnamRegionCodeFromCoordinate,
  vietnamRegionCodeFromValues,
  vietnamRegionLabel,
} from './admin-vietnam-region-overview';

describe('admin Vietnam region overview helpers', () => {
  const now = new Date('2026-06-22T10:20:30.000Z');

  it('normalizes map range filters and defaults to the live operating day', () => {
    expect(normalizeAdminVietnamOverviewRange(undefined)).toBe('today');
    expect(normalizeAdminVietnamOverviewRange('today')).toBe('today');
    expect(normalizeAdminVietnamOverviewRange('yesterday')).toBe('yesterday');
    expect(normalizeAdminVietnamOverviewRange('7d')).toBe('7d');
    expect(normalizeAdminVietnamOverviewRange('30d')).toBe('30d');
    expect(normalizeAdminVietnamOverviewRange('all')).toBe('all');
    expect(normalizeAdminVietnamOverviewRange('month')).toBe('today');
  });

  it('builds bounded Vietnam overview windows without GPS polling', () => {
    expect(adminVietnamOverviewRangeWindow('today', now)).toMatchObject({
      range: 'today',
      label: 'Today',
      startAt: new Date('2026-06-21T17:00:00.000Z'),
      endAt: new Date('2026-06-22T17:00:00.000Z'),
    });
    expect(adminVietnamOverviewRangeWindow('yesterday', now)).toMatchObject({
      range: 'yesterday',
      label: 'Yesterday',
      startAt: new Date('2026-06-20T17:00:00.000Z'),
      endAt: new Date('2026-06-21T17:00:00.000Z'),
    });
    expect(adminVietnamOverviewRangeWindow('7d', now)).toMatchObject({
      range: '7d',
      label: 'Last 7 days',
      startAt: new Date('2026-06-15T17:00:00.000Z'),
      endAt: new Date('2026-06-22T17:00:00.000Z'),
    });
    expect(adminVietnamOverviewRangeWindow('30d', now)).toMatchObject({
      range: '30d',
      label: 'Last 30 days',
      startAt: new Date('2026-05-23T17:00:00.000Z'),
      endAt: new Date('2026-06-22T17:00:00.000Z'),
    });
    expect(adminVietnamOverviewRangeWindow('all', now)).toMatchObject({
      range: 'all',
      label: 'All time',
      startAt: null,
      endAt: null,
    });
  });

  it('emits Prisma-compatible filters only for bounded Vietnam overview ranges', () => {
    expect(adminVietnamOverviewDateWhere(adminVietnamOverviewRangeWindow('all', now))).toBeUndefined();
    expect(adminVietnamOverviewDateWhere(adminVietnamOverviewRangeWindow('today', now))).toEqual({
      gte: new Date('2026-06-21T17:00:00.000Z'),
      lt: new Date('2026-06-22T17:00:00.000Z'),
    });
  });

  it('switches Today exactly at Vietnam midnight even when the UTC date differs', () => {
    expect(
      adminVietnamOverviewRangeWindow('today', new Date('2026-06-21T16:59:59.999Z')),
    ).toMatchObject({
      startAt: new Date('2026-06-20T17:00:00.000Z'),
      endAt: new Date('2026-06-21T17:00:00.000Z'),
    });
    expect(
      adminVietnamOverviewRangeWindow('today', new Date('2026-06-21T17:00:00.000Z')),
    ).toMatchObject({
      startAt: new Date('2026-06-21T17:00:00.000Z'),
      endAt: new Date('2026-06-22T17:00:00.000Z'),
    });
  });

  it('keeps Yesterday end-exclusive at the current Vietnam midnight', () => {
    const yesterday = adminVietnamOverviewRangeWindow(
      'yesterday',
      new Date('2026-06-21T17:00:00.000Z'),
    );

    expect(adminVietnamOverviewDateWhere(yesterday)).toEqual({
      gte: new Date('2026-06-20T17:00:00.000Z'),
      lt: new Date('2026-06-21T17:00:00.000Z'),
    });
  });

  it('maps Vietnamese booking address text to the operating region bucket', () => {
    expect(
      vietnamRegionCodeFromValues([
        'Đ. Xuân Thủy/241 P. Dịch Vọng Hậu, Cầu Giấy, Hà Nội 10000 Việt Nam',
      ]),
    ).toBe('hanoi');

    expect(
      vietnamRegionCodeFromValues([
        '85/9 Phạm Viết Chánh, Thạnh Mỹ Tây, Hồ Chí Minh 700000 Việt Nam',
      ]),
    ).toBe('hcm');

    expect(
      vietnamRegionCodeFromValues(['32 Phan Huy Ích, Vũng Tàu, Hồ Chí Minh 790000 Việt Nam']),
    ).toBe('vung-tau');
  });

  it('maps English city text and nested records without exposing coordinates', () => {
    expect(
      vietnamRegionCodeFromValues([
        {
          addressText: '22 Le Thanh Ton, Ben Nghe Ward, District 1, Ho Chi Minh City',
          latitude: 10.776,
          longitude: 106.7,
        },
      ]),
    ).toBe('hcm');
  });

  it('uses stored coordinates as an aggregate-only fallback when address text is incomplete', () => {
    expect(
      vietnamRegionCodeFromValues(['Custom price payout smoke flow'], {
        latitude: '10.7769',
        longitude: '106.7009',
      }),
    ).toBe('hcm');

    expect(vietnamRegionCodeFromCoordinate({ latitude: 21.0278, longitude: 105.8342 })).toBe(
      'hanoi',
    );
  });

  it('keeps unknown Vietnamese addresses in the other Vietnam bucket', () => {
    expect(vietnamRegionCodeFromValues(['Vietnam service address'])).toBe('other-vietnam');
    expect(vietnamRegionLabel('unknown')).toBe('Other Vietnam');
  });
});
