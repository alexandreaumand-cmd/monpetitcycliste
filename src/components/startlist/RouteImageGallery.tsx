import { useState } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RouteImage {
  etape_numero: number | null;
  image_url: string;
  label: string | null;
  sort_order: number;
}

interface RouteImageGalleryProps {
  images: RouteImage[];
  fallbackUrl?: string | null;
  onImageClick?: (imageUrl: string) => void;
  className?: string;
  compact?: boolean;
  defaultStageNumber?: number;
}

function computeDefaultIndex(images: RouteImage[], defaultStageNumber?: number): number {
  if (defaultStageNumber == null || images.length === 0) return 0;
  const idx = images.findIndex(img => img.etape_numero === defaultStageNumber);
  return idx >= 0 ? idx : 0;
}

export function RouteImageGallery({ images, fallbackUrl, onImageClick, className, compact = false, defaultStageNumber }: RouteImageGalleryProps) {
  const allImages = images.length > 0 ? images : (fallbackUrl ? [{ etape_numero: null, image_url: fallbackUrl, label: 'Parcours', sort_order: 0 }] : []);
  const [activeIndex, setActiveIndex] = useState(() => computeDefaultIndex(allImages, defaultStageNumber));

  if (allImages.length === 0) return null;

  const currentImage = allImages[activeIndex] || allImages[0];

  // Single image: simple display
  if (allImages.length === 1) {
    return (
      <div className={cn("overflow-hidden rounded-lg border-2 shadow-md", className)}>
        <img 
          src={currentImage.image_url} 
          alt={currentImage.label || 'Parcours'} 
          className={cn("w-full h-auto object-cover", onImageClick && "cursor-zoom-in")}
          onClick={() => onImageClick?.(currentImage.image_url)}
        />
      </div>
    );
  }

  // Multiple images: tabs + navigation
  return (
    <div className={cn("space-y-2", className)}>
      {/* Tabs for stage selection */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-1 p-0.5">
          {allImages.map((img, idx) => (
            <button
              key={img.etape_numero ?? 'overview'}
              className={cn(
                "shrink-0 px-2 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                idx === activeIndex 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              onClick={() => setActiveIndex(idx)}
            >
              {img.label || (img.etape_numero ? `Ét. ${img.etape_numero}` : 'Vue d\'ensemble')}
            </button>
          ))}
        </div>
      </div>

      {/* Image display with nav arrows */}
      <div className="relative overflow-hidden rounded-lg border-2 shadow-md">
        <img 
          src={currentImage.image_url} 
          alt={currentImage.label || 'Parcours'} 
          className={cn("w-full h-auto object-cover", onImageClick && "cursor-zoom-in")}
          onClick={() => onImageClick?.(currentImage.image_url)}
        />
        
        {/* Navigation arrows */}
        {!compact && allImages.length > 1 && (
          <>
            {activeIndex > 0 && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full opacity-80 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); setActiveIndex(activeIndex - 1); }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            {activeIndex < allImages.length - 1 && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full opacity-80 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); setActiveIndex(activeIndex + 1); }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
        
        {/* Dots indicator */}
        {allImages.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {allImages.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all",
                  idx === activeIndex ? "bg-primary w-3" : "bg-white/60"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Full-screen modal gallery for multi-stage images
 */
export function RouteImageModalContent({ images, fallbackUrl, initialIndex = 0, defaultStageNumber }: { 
  images: RouteImage[]; 
  fallbackUrl?: string | null;
  initialIndex?: number;
  defaultStageNumber?: number;
}) {
  const allImages = images.length > 0 ? images : (fallbackUrl ? [{ etape_numero: null, image_url: fallbackUrl, label: 'Parcours', sort_order: 0 }] : []);
  const [activeIndex, setActiveIndex] = useState(() => {
    if (defaultStageNumber != null) return computeDefaultIndex(allImages, defaultStageNumber);
    return initialIndex;
  });

  if (allImages.length === 0) return null;
  const currentImage = allImages[activeIndex] || allImages[0];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-4 gap-4">
      {/* Stage tabs in modal */}
      {allImages.length > 1 && (
        <div className="flex gap-1 overflow-x-auto scrollbar-hide max-w-full pb-1">
          {allImages.map((img, idx) => (
            <button
              key={img.etape_numero ?? 'overview'}
              className={cn(
                "shrink-0 px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap",
                idx === activeIndex 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              onClick={() => setActiveIndex(idx)}
            >
              {img.label || (img.etape_numero ? `Étape ${img.etape_numero}` : 'Vue d\'ensemble')}
            </button>
          ))}
        </div>
      )}

      {/* Main image */}
      <div className="relative flex-1 flex items-center justify-center w-full min-h-0">
        <img 
          src={currentImage.image_url} 
          alt={currentImage.label || 'Parcours'} 
          className="max-w-full max-h-[80vh] object-contain rounded-lg"
        />
        
        {allImages.length > 1 && (
          <>
            {activeIndex > 0 && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full"
                onClick={() => setActiveIndex(activeIndex - 1)}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            {activeIndex < allImages.length - 1 && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full"
                onClick={() => setActiveIndex(activeIndex + 1)}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}