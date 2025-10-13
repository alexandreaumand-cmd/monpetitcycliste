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
    prestige.hasMonument || 
    prestige.hasWorldChamp;

  if (!hasAnyPrestige) return null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {prestige.hasTourDeFrance && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-lg cursor-help">🇫🇷</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Vainqueur du Tour de France</p>
            </TooltipContent>
          </Tooltip>
        )}
        
        {prestige.hasGiro && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-lg cursor-help">🇮🇹</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Vainqueur du Giro d'Italia</p>
            </TooltipContent>
          </Tooltip>
        )}
        
        {prestige.hasVuelta && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-lg cursor-help">🇪🇸</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Vainqueur de la Vuelta a España</p>
            </TooltipContent>
          </Tooltip>
        )}
        
        {prestige.hasMonument && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-lg cursor-help">🏛️</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Vainqueur d'un Monument</p>
            </TooltipContent>
          </Tooltip>
        )}
        
        {prestige.hasWorldChamp && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-lg cursor-help">🌈</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Champion du Monde</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
};
