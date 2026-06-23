import { renderToStaticMarkup } from 'react-dom/server';
import {
  bookingVietnamOverviewTile,
  BookingVietnamOverviewTileSection,
} from './booking-vietnam-overview-tile';

describe('bookingVietnamOverviewTile', () => {
  it('selects a Hanoi static region tile from a booking service address', () => {
    const tile = bookingVietnamOverviewTile('Đ. Xuân Thủy/241 P. Dịch Vọng Hậu, Cầu Giấy, Hà Nội 10000 Vietnam');

    expect(tile.selectedRegionLabel).toBe('Hà Nội');
    expect(tile.regions.find((region) => region.selected)).toMatchObject({
      code: 'hanoi',
      shortName: 'HAN',
      regionName: 'Hà Nội',
    });
    expect(tile.helper).toContain('No external map tile');
  });

  it('selects a Ho Chi Minh static region tile from a booking service address', () => {
    const tile = bookingVietnamOverviewTile('85/9 Phạm Viết Chánh, Thạnh Mỹ Tây, Hồ Chí Minh 700000 Vietnam');

    expect(tile.selectedRegionLabel).toBe('Hồ Chí Minh');
    expect(tile.regions.find((region) => region.selected)).toMatchObject({
      code: 'ho-chi-minh',
      shortName: 'HCM',
    });
  });

  it('falls back to a Vietnam service-area tile without exposing coordinates', () => {
    const tile = bookingVietnamOverviewTile('Service address pending operator confirmation');

    expect(tile.selectedRegionLabel).toBe('Vietnam service area');
    expect(tile.regions.find((region) => region.selected)).toMatchObject({
      code: 'vietnam',
      shortName: 'VN',
    });
    expect(tile.helper).not.toMatch(/\d{1,2}\.\d{3,}/);
  });
});

describe('BookingVietnamOverviewTileSection', () => {
  it('renders a compact static Vietnam overview tile for booking detail', () => {
    const markup = renderToStaticMarkup(
      <BookingVietnamOverviewTileSection addressLine="Cầu Giấy, Hà Nội" />,
    );
    const text = normalizedText(markup);

    expect(text).toContain('Vietnam overview');
    expect(text).toContain('Static tile');
    expect(text).toContain('Hà Nội');
    expect(text).toContain('No external map tile');
    expect(markup).toContain('booking-vietnam-overview-tile-card');
    expect(markup).toContain('vietnam-region-map is-compact');
    expect(markup).toContain('vietnam-region-block is-selected');
  });
});

function normalizedText(markup: string) {
  return markup
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
