import { Bike, CalendarDays } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface Race {
  race_id: string;
  race_nom: string;
  categorie: string | null;
  date_debut: string;
  date_fin: string;
}

interface RiderRaceIconsProps {
  currentRaces?: Race[];
  upcomingRaces?: Race[];
}

const formatRaceDate = (dateDebut: string, dateFin: string) => {
  const start = parseISO(dateDebut);
  const end = parseISO(dateFin);
  
  if (dateDebut === dateFin) {
    return format(start, "d MMM", { locale: fr });
  }
  
  return `${format(start, "d")} - ${format(end, "d MMM", { locale: fr })}`;
};

export const RiderRaceIcons = ({ currentRaces, upcomingRaces }: RiderRaceIconsProps) => {
  const hasCurrentRaces = currentRaces && currentRaces.length > 0;
  const hasUpcomingRaces = upcomingRaces && upcomingRaces.length > 0;

  if (!hasCurrentRaces && !hasUpcomingRaces) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1">
        {hasCurrentRaces && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help">
                <Bike className="h-3.5 w-3.5 text-green-600" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="font-semibold text-green-600 mb-1">🚴 En course</p>
              <ul className="text-xs space-y-0.5">
                {currentRaces.map((race) => (
                  <li key={race.race_id} className="flex items-start gap-1">
                    <span>•</span>
                    <span>
                      {race.race_nom}
                      <span className="text-muted-foreground ml-1">
                        ({formatRaceDate(race.date_debut, race.date_fin)})
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        )}

        {hasUpcomingRaces && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help">
                <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="font-semibold text-blue-500 mb-1">📅 Prochaines courses</p>
              <ul className="text-xs space-y-0.5">
                {upcomingRaces.map((race) => (
                  <li key={race.race_id} className="flex items-start gap-1">
                    <span>•</span>
                    <span>
                      {race.race_nom}
                      <span className="text-muted-foreground ml-1">
                        ({formatRaceDate(race.date_debut, race.date_fin)})
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
};
