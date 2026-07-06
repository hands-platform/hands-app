import { readFileSync } from 'node:fs';

describe('VietnamOverviewMapClusters', () => {
  it('uses the shared Vuexy segmented atom for map display mode controls', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-map-clusters.tsx', 'utf8');

    expect(source).toContain('AdminSegmentedControl');
    expect(source).not.toContain('<span className={!isDensityVisible ? \'is-active\' : \'\'}>Signals</span>');
    expect(source).not.toContain('<button\n        aria-pressed={isDensityVisible}');
  });

  it('uses the shared Vuexy button atom for cluster panel close controls', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-map-clusters.tsx', 'utf8');

    expect(source).toContain('AdminFormControlButton');
    expect(source).not.toContain('<button\n          aria-label="Close selected map signals"');
  });

  it('uses the shared Vuexy drawer surface atom for cluster detail panels', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-map-clusters.tsx', 'utf8');

    expect(source).toContain('AdminDrawerSurface');
    expect(source).not.toContain('<aside className="vietnam-map-cluster-panel"');
  });

  it('uses the shared Vuexy text link atom for cluster detail navigation', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-map-clusters.tsx', 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('<a className="vietnam-map-cluster-latest-link"');
    expect(source).not.toContain('<a className="vietnam-map-cluster-focus-link"');
    expect(source).not.toContain('<a className="vietnam-map-cluster-event-link"');
  });

  it('keeps clickable map dots inside the shared Vuexy icon button atom', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-map-clusters.tsx', 'utf8');

    expect(source).toContain("import { AdminIconButton } from '../../components/admin-icon-button';");
    expect(source).toContain('<AdminIconButton');
    expect(source).not.toContain('<button');
  });

  it('uses the shared number formatter for cluster counters', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-map-clusters.tsx', 'utf8');

    expect(source).toContain('formatWholeNumber as formatNumber');
    expect(source).toContain('formatPendingDateTime as formatDateTime');
    expect(source).not.toContain('function formatNumber(value: number)');
    expect(source).not.toContain('function formatDateTime(value: string)');
  });

  it('uses the shared DateTimeText atom for visible cluster timestamps', () => {
    const source = readFileSync('app/vietnam-overview/vietnam-overview-map-clusters.tsx', 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).toContain('<DateTimeText value={latestPoint.occurredAt} />');
    expect(source).toContain("detailDateTimePrefix: item.latestPoint ? 'Latest ' : undefined");
    expect(source).toContain("detailDateTimeFallback: 'pending'");
    expect(source).toContain('detailDateTimeValue: item.latestPoint?.occurredAt');
    expect(source).toContain('<DateTimeText value={point.occurredAt} />');
    expect(source).not.toContain('{metricLabel(latestPoint.kind)} / {formatDateTime(latestPoint.occurredAt)}');
    expect(source).not.toContain('Latest {item.latestPoint ? formatDateTime(item.latestPoint.occurredAt) : \'pending\'}');
    expect(source).not.toContain("detail: <>Latest {item.latestPoint ? <DateTimeText value={item.latestPoint.occurredAt} /> : 'pending'}</>");
    expect(source).not.toContain('{formatDateTime(point.occurredAt)}');
  });
});
