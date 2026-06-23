'use client';

import { Minus, Plus, RotateCcw } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';

import { vietnamOverviewMapZoomLevels } from './vietnam-overview-model';

type VietnamOverviewMapZoomProps = {
  readonly children: ReactNode;
};

export function VietnamOverviewMapZoom({ children }: VietnamOverviewMapZoomProps) {
  const [zoomIndex, setZoomIndex] = useState(0);
  const zoomLevel = vietnamOverviewMapZoomLevels[zoomIndex] ?? vietnamOverviewMapZoomLevels[0];
  const canZoomOut = zoomIndex > 0;
  const canZoomIn = zoomIndex < vietnamOverviewMapZoomLevels.length - 1;
  const zoomStyle = {
    '--vietnam-map-zoom-scale': `${zoomLevel.scale}`,
  } as CSSProperties & Record<'--vietnam-map-zoom-scale', string>;

  return (
    <div className="vietnam-map-zoom-shell" style={zoomStyle}>
      <div className="vietnam-map-zoom-content">{children}</div>
      <div className="vietnam-map-zoom-controls" aria-label="Map zoom controls">
        <button
          type="button"
          className="vietnam-map-zoom-button"
          aria-label="Zoom out"
          disabled={!canZoomOut}
          onClick={() => setZoomIndex((current) => Math.max(0, current - 1))}
        >
          <Minus size={16} aria-hidden="true" />
        </button>
        <span className="vietnam-map-zoom-value" aria-live="polite">
          {zoomLevel.label}
        </span>
        <button
          type="button"
          className="vietnam-map-zoom-button"
          aria-label="Zoom in"
          disabled={!canZoomIn}
          onClick={() =>
            setZoomIndex((current) => Math.min(vietnamOverviewMapZoomLevels.length - 1, current + 1))
          }
        >
          <Plus size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="vietnam-map-zoom-button"
          aria-label="Reset map zoom"
          disabled={zoomIndex === 0}
          onClick={() => setZoomIndex(0)}
        >
          <RotateCcw size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
