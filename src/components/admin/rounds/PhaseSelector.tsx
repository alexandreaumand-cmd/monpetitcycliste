import { Trophy, Calendar, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Phase {
  id: string;
  index_dans_saison: number;
  saisons: {
    annee: number;
  } | null;
}

interface Auction {
  statut: 'open' | 'closed' | 'scheduled';
}

interface PhaseSelectorProps {
  phases: Phase[];
  selectedPhaseId: string;
  onPhaseChange: (phaseId: string) => void;
  currentAuction?: Auction | null;
  isLoading?: boolean;
}

export const PhaseSelector = ({
  phases,
  selectedPhaseId,
  onPhaseChange,
  currentAuction,
  isLoading = false,
}: PhaseSelectorProps) => {
  const selectedPhase = phases.find(p => p.id === selectedPhaseId);
  
  // Group phases by season
  const phasesBySeason = phases.reduce((acc, phase) => {
    const year = phase.saisons?.annee || 0;
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(phase);
    return acc;
  }, {} as Record<number, Phase[]>);

  // Sort seasons descending
  const sortedSeasons = Object.keys(phasesBySeason)
    .map(Number)
    .sort((a, b) => b - a);

  const getRoundStatus = () => {
    if (!currentAuction) {
      return { label: "Aucun round", color: "bg-muted text-muted-foreground" };
    }
    switch (currentAuction.statut) {
      case 'open':
        return { label: "Round ouvert", color: "bg-green-500/10 text-green-600 dark:text-green-400" };
      case 'scheduled':
        return { label: "Round programmé", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
      case 'closed':
      default:
        return { label: "Round fermé", color: "bg-red-500/10 text-red-600 dark:text-red-400" };
    }
  };

  const status = getRoundStatus();

  return (
    <div className="bg-gradient-to-br from-primary/5 via-background to-secondary/5 border rounded-lg p-6">
      <div className="flex flex-col gap-4">
        {/* Title */}
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Phase Active</h3>
        </div>

        {/* Main selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          {/* Season Badge */}
          <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-lg">
            <Trophy className="h-4 w-4 text-primary" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Saison</span>
              <span className="text-lg font-bold text-primary">
                {selectedPhase?.saisons?.annee || '—'}
              </span>
            </div>
          </div>

          {/* Separator */}
          <Separator orientation="vertical" className="hidden sm:block h-12" />

          {/* Phase Badge */}
          <div className="flex items-center gap-2 bg-secondary/50 px-4 py-2 rounded-lg">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Phase</span>
              <span className="text-lg font-bold">
                {selectedPhase?.index_dans_saison || '—'}
              </span>
            </div>
          </div>

          {/* Status Badge */}
          <Badge variant="outline" className={`${status.color} border-0 px-3 py-1`}>
            <div className="flex items-center gap-1">
              {currentAuction?.statut === 'open' && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              )}
              {currentAuction?.statut === 'scheduled' && (
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              )}
              <span className="text-xs font-medium">{status.label}</span>
            </div>
          </Badge>

          {/* Change Phase Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className="ml-auto sm:ml-0 gap-2"
                disabled={isLoading}
              >
                Changer de phase
                <ChevronDown className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <ScrollArea className="h-[400px]">
                <div className="p-4 space-y-4">
                  {sortedSeasons.map((year) => (
                    <div key={year}>
                      <div className="flex items-center gap-2 mb-2">
                        <Trophy className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm text-primary">
                          Saison {year}
                        </span>
                      </div>
                      <div className="space-y-1 ml-6">
                        {phasesBySeason[year]
                          .sort((a, b) => b.index_dans_saison - a.index_dans_saison)
                          .map((phase) => {
                            const isSelected = phase.id === selectedPhaseId;
                            return (
                              <button
                                key={phase.id}
                                onClick={() => onPhaseChange(phase.id)}
                                className={`
                                  w-full text-left px-3 py-2 rounded-md text-sm
                                  transition-colors flex items-center justify-between
                                  ${isSelected 
                                    ? 'bg-primary text-primary-foreground font-medium' 
                                    : 'hover:bg-muted'
                                  }
                                `}
                              >
                                <span>Phase {phase.index_dans_saison}</span>
                                {isSelected && (
                                  <Check className="h-4 w-4" />
                                )}
                              </button>
                            );
                          })}
                      </div>
                      {year !== sortedSeasons[sortedSeasons.length - 1] && (
                        <Separator className="mt-3" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
};
