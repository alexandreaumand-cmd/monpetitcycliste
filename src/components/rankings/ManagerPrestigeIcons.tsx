import { useManagerPrestigeWins } from "@/hooks/useManagerPrestigeWins";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

interface ManagerPrestigeIconsProps {
  managerId: string;
  phaseId?: string | null;
  saisonId?: string | null;
  leagueId?: string | null;
  isMobile?: boolean;
}

export const ManagerPrestigeIcons = ({ managerId, phaseId, saisonId, leagueId, isMobile = false }: ManagerPrestigeIconsProps) => {
  const { data: prestigeData } = useManagerPrestigeWins(phaseId, saisonId, leagueId);
  const [dialogOpen, setDialogOpen] = useState(false);
  
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

  const IconWrapper = ({ children, tooltip }: { children: React.ReactNode; tooltip: string }) => {
    if (isMobile) {
      return <span className={isMobile ? "cursor-pointer" : "cursor-help"}>{children}</span>;
    }
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{children}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  const handleClick = () => {
    if (isMobile) {
      setDialogOpen(true);
    }
  };

  return (
    <>
      <TooltipProvider>
        <div 
          className={`flex items-center gap-0.5 opacity-70 ${isMobile ? 'text-xs cursor-pointer' : 'text-sm'}`}
          onClick={handleClick}
        >
        {prestige.hasTourDeFrance && (
          <IconWrapper tooltip="Vainqueur du Tour de France">
            🇫🇷
          </IconWrapper>
        )}
        
        {prestige.hasGiro && (
          <IconWrapper tooltip="Vainqueur du Giro d'Italia">
            🇮🇹
          </IconWrapper>
        )}
        
        {prestige.hasVuelta && (
          <IconWrapper tooltip="Vainqueur de la Vuelta a España">
            🇪🇸
          </IconWrapper>
        )}
        
        {prestige.monuments.length > 0 && (
          <IconWrapper tooltip={`Monument(s) : ${prestige.monuments.join(', ')}`}>
            <span className="flex gap-0.5">
              {prestige.monuments.map((monument, idx) => (
                <span key={idx}>🏛️</span>
              ))}
            </span>
          </IconWrapper>
        )}
        
        {(prestige.worldChampionships.hasRR || prestige.worldChampionships.hasITT) && (
          <IconWrapper tooltip={getWorldChampTooltip()}>
            🌈
          </IconWrapper>
        )}
        </div>
      </TooltipProvider>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🏆 Palmarès
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {prestige.hasTourDeFrance && (
              <div className="flex items-center gap-3">
                <span className="text-xl">🇫🇷</span>
                <span className="text-sm">Vainqueur du Tour de France</span>
              </div>
            )}
            {prestige.hasGiro && (
              <div className="flex items-center gap-3">
                <span className="text-xl">🇮🇹</span>
                <span className="text-sm">Vainqueur du Giro d'Italia</span>
              </div>
            )}
            {prestige.hasVuelta && (
              <div className="flex items-center gap-3">
                <span className="text-xl">🇪🇸</span>
                <span className="text-sm">Vainqueur de la Vuelta a España</span>
              </div>
            )}
            {prestige.monuments.map((monument, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-xl">🏛️</span>
                <span className="text-sm">{monument}</span>
              </div>
            ))}
            {(prestige.worldChampionships.hasRR || prestige.worldChampionships.hasITT) && (
              <div className="flex items-center gap-3">
                <span className="text-xl">🌈</span>
                <span className="text-sm">{getWorldChampTooltip()}</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
