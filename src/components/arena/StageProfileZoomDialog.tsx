import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

interface StageProfileZoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  title: string;
  alt: string;
}

export const StageProfileZoomDialog = ({
  open,
  onOpenChange,
  imageUrl,
  title,
  alt,
}: StageProfileZoomDialogProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const stateRef = useRef({ zoom, offset });
  stateRef.current = { zoom, offset };

  const reset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const zoomAt = useCallback((nextZoomRaw: number, px: number, py: number) => {
    const { zoom: z, offset: o } = stateRef.current;
    const next = clamp(nextZoomRaw, MIN_ZOOM, MAX_ZOOM);
    if (next === z) return;
    const k = next / z;
    setZoom(next);
    setOffset({ x: px - (px - o.x) * k, y: py - (py - o.y) * k });
  }, []);

  const handleWheelRef = useRef<(e: WheelEvent) => void>(() => {});
  handleWheelRef.current = (e: WheelEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    const next = stateRef.current.zoom * Math.exp(-dy * 0.002);
    zoomAt(next, e.clientX - rect.left, e.clientY - rect.top);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !open) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      handleWheelRef.current(e);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open]);

  // Pointer drag + two-pointer pinch
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinchRef.current = null;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    if (pointers.current.size >= 2) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2 - rect.left;
      const cy = (a.y + b.y) / 2 - rect.top;
      if (pinchRef.current && pinchRef.current.dist > 0) {
        zoomAt((stateRef.current.zoom * dist) / pinchRef.current.dist, cx, cy);
      }
      pinchRef.current = { dist, cx, cy };
      return;
    }

    setOffset((o) => ({ x: o.x + (e.clientX - prev.x), y: o.y + (e.clientY - prev.y) }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinchRef.current = null;
  };

  const zoomButton = (factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    zoomAt(stateRef.current.zoom * factor, rect.width / 2, rect.height / 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] w-[96vw] h-[92vh] p-0 gap-0 overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
          <h2 className="text-sm font-semibold truncate">{title}</h2>
          <div className="ml-auto flex items-center gap-1 mr-8">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => zoomButton(1 / 1.4)} aria-label="Dézoomer">
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground w-10 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => zoomButton(1.4)} aria-label="Zoomer">
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={reset} aria-label="Réinitialiser le zoom">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div
          ref={containerRef}
          className="relative flex-1 overflow-hidden bg-muted/30 select-none"
          style={{ touchAction: "none", cursor: zoom > 1 ? "grab" : "zoom-in" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => (zoom > 1 ? reset() : zoomButton(2))}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
            }}
          >
            <img
              src={imageUrl}
              alt={alt}
              draggable={false}
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
