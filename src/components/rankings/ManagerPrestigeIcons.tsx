import { useManagerPrestigeWins } from "@/hooks/useManagerPrestigeWins";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ManagerPrestigeIconsProps {
  managerId: string;
  phaseId?: string | null;
  saisonId?: string | null;
}

export const ManagerPrestigeIcons = ({ managerId, phaseId, saisonId }: ManagerPrestigeIconsProps) => {
  const { data: prestigeData } = useManagerPrestigeWins(phaseId, saisonId);
  
  const prestige = prestigeData?.[managerId];
  if (!prestige) return null;

  const hasAnyPrestige = 
    prestige.hasTourDeFrance || 
    prestige.hasGiro || 
    prestige.hasVuelta || 
    prestige.monuments.length > 0 || 
    (prestige.worldChampionships.hasRR || prestige.worldChampionships.hasITT);

  if (!hasAnyPrestige) return null;

  const getWorldChampTooltip = () => {
    if (prestige.worldChampionships.hasRR && prestige.worldChampionships.hasITT) {
      return "Champion du Monde - Course en ligne & Contre-la-montre";
    } else if (prestige.worldChampionships.hasRR) {
      return "Champion du Monde - Course en ligne";
    } else if (prestige.worldChampionships.hasITT) {
      return "Champion du Monde - Contre-la-montre";
    }
    return "Champion du Monde";
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-0.5 text-sm opacity-70">
        {prestige.hasTourDeFrance && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">🇫🇷</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Vainqueur du Tour de France</p>
            </TooltipContent>
          </Tooltip>
        )}
        
        {prestige.hasGiro && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">🇮🇹</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Vainqueur du Giro d'Italia</p>
            </TooltipContent>
          </Tooltip>
        )}
        
        {prestige.hasVuelta && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">🇪🇸</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Vainqueur de la Vuelta a España</p>
            </TooltipContent>
          </Tooltip>
        )}
        
        {prestige.monuments.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex gap-0.5 cursor-help">
                {prestige.monuments.map((monument, idx) => (
                  <span key={idx}>🏛️</span>
                ))}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Monument(s) : {prestige.monuments.join(', ')}</p>
            </TooltipContent>
          </Tooltip>
        )}
        
        {(prestige.worldChampionships.hasRR || prestige.worldChampionships.hasITT) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">🌈</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{getWorldChampTooltip()}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
};
