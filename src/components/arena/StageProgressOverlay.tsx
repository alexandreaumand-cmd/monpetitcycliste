import { cn } from "@/lib/utils";

export interface StageAxisCalibration {
  /** Position (%) du départ (0 km) sur la largeur de l'image. */
  axisLeftPct?: number | null;
  /** Position (%) de l'arrivée sur la largeur de l'image. */
  axisRightPct?: number | null;
}

interface StageProgressOverlayProps extends StageAxisCalibration {
  /** Kilomètres restants (issus de la situation de course). */
  kmRemaining?: number | null;
  /** Distance totale de l'étape (saisie en admin, sinon estimée). */
  totalKm?: number | null;
  /** Taille réduite du badge (panneaux compacts). */
  compact?: boolean;
  className?: string;
}

/**
 * Repère d'avancée de la course posé sur l'image du profil d'étape.
 * À placer dans un conteneur `relative` entourant l'image.
 */
export const StageProgressOverlay = ({
  kmRemaining,
  totalKm,
  axisLeftPct,
  axisRightPct,
  compact = false,
  className,
}: StageProgressOverlayProps) => {
  const km = Number(kmRemaining);
  const total = Number(totalKm);

  if (!Number.isFinite(km) || !Number.isFinite(total) || total <= 0) return null;
  if (km < 0 || km > total) return null;

  const done = total - km;

  // Bords du dessin sur l'image (départ / arrivée), sinon toute la largeur
  const rawLeft = Number(axisLeftPct);
  const rawRight = Number(axisRightPct);
  const leftPct = Number.isFinite(rawLeft) ? Math.min(100, Math.max(0, rawLeft)) : 0;
  const rightPctCandidate = Number.isFinite(rawRight) ? Math.min(100, Math.max(0, rawRight)) : 100;
  const rightPct = rightPctCandidate > leftPct ? rightPctCandidate : 100;

  const pct = leftPct + (done / total) * (rightPct - leftPct);


  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-md", className)}>
      {/* Portion déjà parcourue */}
      <div
        className="absolute inset-y-0 left-0 bg-foreground/20"
        style={{ width: `${pct}%` }}
      />

      {/* Ligne de position */}
      <div
        className="absolute inset-y-0 w-[2px] bg-primary shadow-[0_0_6px_hsl(var(--primary))]"
        style={{ left: `${pct}%`, transform: "translateX(-1px)" }}
      />

      {/* Pastille */}
      <div
        className="absolute top-1"
        style={{
          left: `${pct}%`,
          transform: pct > 75 ? "translateX(-100%)" : pct < 8 ? "translateX(0)" : "translateX(-50%)",
        }}
      >
        <span
          className={cn(
            "inline-block whitespace-nowrap rounded-full bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground",
            compact ? "text-[9px]" : "text-[10px]"
          )}
        >
          {Math.round(km * 10) / 10} km restants
        </span>
      </div>
    </div>
  );
};
