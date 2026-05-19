import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useInjuryFor } from "@/hooks/useActiveInjuries";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface InjuryBadgeProps {
  coureurId: string | null | undefined;
  className?: string;
  size?: "sm" | "md";
}

export function InjuryBadge({ coureurId, className, size = "sm" }: InjuryBadgeProps) {
  const injury = useInjuryFor(coureurId);
  if (!injury) return null;

  const txt = size === "sm" ? "text-sm" : "text-base";
  const returnDate = new Date(injury.estimated_return_date);
  const injuryDate = new Date(injury.injury_date);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Voir détail de la blessure"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center justify-center leading-none align-middle hover:scale-110 transition-transform",
            txt,
            className,
          )}
        >
          🤕
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 text-sm space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-semibold flex items-center gap-2">
          <span>🤕</span>
          <span>{injury.injury}</span>
        </div>
        {injury.injury_context && (
          <p className="text-muted-foreground">{injury.injury_context}</p>
        )}
        <div className="grid grid-cols-2 gap-1 text-xs pt-1 border-t">
          <span className="text-muted-foreground">Date</span>
          <span>{format(injuryDate, "d MMM yyyy", { locale: fr })}</span>
          <span className="text-muted-foreground">Absence estimée</span>
          <span>{injury.weeks_out} semaine{injury.weeks_out > 1 ? "s" : ""}</span>
          <span className="text-muted-foreground">Retour estimé</span>
          <span className="font-medium">
            {format(returnDate, "d MMM yyyy", { locale: fr })}
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
