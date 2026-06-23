import type { CSSProperties } from 'react';
import { MapPinned } from 'lucide-react';

export type BookingVietnamOverviewTileRegionCode =
  | 'hanoi'
  | 'ho-chi-minh'
  | 'da-nang'
  | 'vung-tau'
  | 'vietnam';

export type BookingVietnamOverviewTileRegion = {
  readonly code: BookingVietnamOverviewTileRegionCode;
  readonly helper: string;
  readonly intensity: number;
  readonly regionName: string;
  readonly selected: boolean;
  readonly shortName: string;
};

export type BookingVietnamOverviewTile = {
  readonly helper: string;
  readonly regions: readonly BookingVietnamOverviewTileRegion[];
  readonly selectedRegionLabel: string;
  readonly title: string;
};

type BookingVietnamOverviewTileSectionProps = {
  readonly addressLine: string;
};

const baseRegions: Array<Pick<BookingVietnamOverviewTileRegion, 'code' | 'regionName' | 'shortName'>> = [
  { code: 'hanoi', regionName: 'Hà Nội', shortName: 'HAN' },
  { code: 'ho-chi-minh', regionName: 'Hồ Chí Minh', shortName: 'HCM' },
  { code: 'da-nang', regionName: 'Đà Nẵng', shortName: 'DAD' },
  { code: 'vung-tau', regionName: 'Vũng Tàu', shortName: 'VT' },
  { code: 'vietnam', regionName: 'Vietnam service area', shortName: 'VN' },
];

export function bookingVietnamOverviewTile(addressLine: string): BookingVietnamOverviewTile {
  const selectedCode = detectVietnamRegion(addressLine);
  const selectedRegion = baseRegions.find((region) => region.code === selectedCode) ?? baseRegions.at(-1);

  return {
    helper:
      'No external map tile is loaded. This static tile highlights the booking service-address region only.',
    regions: baseRegions.map((region) => {
      const selected = region.code === selectedCode;

      return {
        ...region,
        helper: selected ? 'Booking service address region' : 'Vietnam overview reference',
        intensity: selected ? 100 : region.code === 'vietnam' ? 22 : 14,
        selected,
      };
    }),
    selectedRegionLabel: selectedRegion?.regionName ?? 'Vietnam service area',
    title: 'Vietnam overview',
  };
}

export function BookingVietnamOverviewTileSection({ addressLine }: BookingVietnamOverviewTileSectionProps) {
  const tile = bookingVietnamOverviewTile(addressLine);

  return (
    <section className="card booking-vietnam-overview-tile-card" id="booking-vietnam-overview">
      <div className="booking-vietnam-overview-tile-header">
        <div>
          <span className="metric-label">Static tile</span>
          <h2>{tile.title}</h2>
        </div>
        <span className="pill pill-info">{tile.selectedRegionLabel}</span>
      </div>

      <div className="booking-vietnam-overview-tile-layout">
        <div className="vietnam-region-map is-compact" aria-label="Static Vietnam service-area overview">
          {tile.regions.map((region) => (
            <article
              className={`vietnam-region-block${region.selected ? ' is-selected' : ''}`}
              key={region.code}
              style={{ '--region-intensity': `${region.intensity}%` } as CSSProperties & Record<'--region-intensity', string>}
            >
              <div>
                <span>{region.shortName}</span>
                <strong>{region.regionName}</strong>
              </div>
              <MapPinned size={18} aria-hidden="true" />
              <small>{region.helper}</small>
            </article>
          ))}
        </div>

        <div className="booking-vietnam-overview-tile-copy">
          <span className="metric-label">Booking service region</span>
          <strong>{tile.selectedRegionLabel}</strong>
          <p className="muted">{tile.helper}</p>
        </div>
      </div>
    </section>
  );
}

function detectVietnamRegion(addressLine: string): BookingVietnamOverviewTileRegionCode {
  const normalized = normalizeAddress(addressLine);

  if (normalized.includes('vung tau')) {
    return 'vung-tau';
  }

  if (normalized.includes('ho chi minh') || normalized.includes('sai gon') || normalized.includes('saigon')) {
    return 'ho-chi-minh';
  }

  if (normalized.includes('ha noi') || normalized.includes('hanoi')) {
    return 'hanoi';
  }

  if (normalized.includes('da nang')) {
    return 'da-nang';
  }

  return 'vietnam';
}

function normalizeAddress(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}
