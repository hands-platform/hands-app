'use client';

import { Minus, Plus, RotateCcw } from 'lucide-react';
import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';

import { vietnamOverviewMapZoomLevels } from './vietnam-overview-model';

type VietnamOverviewMapZoomProps = {
  readonly children: ReactNode;
  readonly overlay?: ReactNode;
};

type MapPan = {
  readonly x: number;
  readonly y: number;
};

type MapDragState = {
  readonly originX: number;
  readonly originY: number;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
};

const initialMapPan: MapPan = { x: 0, y: 0 };

export function VietnamOverviewMapZoom({ children, overlay }: VietnamOverviewMapZoomProps) {
  const [zoomIndex, setZoomIndex] = useState(0);
  const [pan, setPan] = useState<MapPan>(initialMapPan);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<MapDragState | null>(null);
  const zoomLevel = vietnamOverviewMapZoomLevels[zoomIndex] ?? vietnamOverviewMapZoomLevels[0];
  const canZoomOut = zoomIndex > 0;
  const canZoomIn = zoomIndex < vietnamOverviewMapZoomLevels.length - 1;
  const hasMoved = pan.x !== 0 || pan.y !== 0;
  const zoomStyle = {
    '--vietnam-map-pan-x': `${pan.x}px`,
    '--vietnam-map-pan-y': `${pan.y}px`,
    '--vietnam-map-zoom-scale': `${zoomLevel.scale}`,
  } as CSSProperties & {
    readonly '--vietnam-map-pan-x': string;
    readonly '--vietnam-map-pan-y': string;
    readonly '--vietnam-map-zoom-scale': string;
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('.vietnam-map-event-point')) return;

    dragStateRef.current = {
      originX: pan.x,
      originY: pan.y,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) return;

    event.preventDefault();
    setPan({
      x: dragState.originX + event.clientX - dragState.startX,
      y: dragState.originY + event.clientY - dragState.startY,
    });
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current = null;
    setIsDragging(false);
  };

  const resetMap = () => {
    setZoomIndex(0);
    setPan(initialMapPan);
  };

  return (
    <div className="vietnam-map-zoom-shell" style={zoomStyle}>
      <div
        className={`vietnam-map-zoom-content${isDragging ? ' is-dragging' : ''}`}
        onPointerCancel={endDrag}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
      >
        {children}
      </div>
      {overlay}
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
          disabled={zoomIndex === 0 && !hasMoved}
          onClick={resetMap}
        >
          <RotateCcw size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
