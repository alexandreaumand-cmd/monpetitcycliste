import { cn } from "@/lib/utils";

interface StageProgressOverlayProps {
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
  compact = false,
  className,
}: StageProgressOverlayProps) => {
  const km = Number(kmRemaining);
  const total = Number(totalKm);

  if (!Number.isFinite(km) || !Number.isFinite(total) || total <= 0) return null;
  if (km < 0 || km > total) return null;

  const ratio = Math.min(1, Math.max(0, (total - km) / total));
  const pct = ratio * 100;

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
