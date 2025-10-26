import { MobileBottomSheet } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ManagerPrestigeIcons } from "./ManagerPrestigeIcons";
import { ManagerNameWithJersey } from "./ManagerNameWithJersey";
import { TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLeague } from "@/contexts/LeagueContext";

interface ManagerDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  managerId: string;
  managerName: string;
  rank: number;
  totalPoints: number;
  evolution: number | null;
  isNew: boolean;
  percentage: string;
  scoreursCount: number;
  victoriesCount: number;
  phaseId?: string | null;
  saisonId?: string | null;
}

export function ManagerDetailsDrawer({
  open,
  onOpenChange,
  managerId,
  managerName,
  rank,
  totalPoints,
  evolution,
  isNew,
  percentage,
  scoreursCount,
  victoriesCount,
  phaseId,
  saisonId,
}: ManagerDetailsDrawerProps) {
  const navigate = useNavigate();
  const { leagueId } = useLeague();

  const getRankLabel = (rank: number) => {
    if (rank === 1) return "1ère position";
    return `${rank}${rank === 1 ? "ère" : "e"} position`;
  };

  const getEvolutionDisplay = () => {
    if (isNew) {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            NEW
          </Badge>
        </div>
      );
    }

    if (evolution === null || evolution === 0) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Minus className="h-4 w-4" />
          <span>Pas de changement</span>
        </div>
      );
    }

    if (evolution > 0) {
      return (
        <div className="flex items-center gap-2 text-green-600">
          <TrendingUp className="h-4 w-4" />
          <span className="font-semibold">+{evolution} places</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-red-600">
        <TrendingDown className="h-4 w-4" />
        <span className="font-semibold">{evolution} places</span>
      </div>
    );
  };

  const handleViewDetails = () => {
    onOpenChange(false);
    navigate(`/dashboard/classement/manager/${managerId}?leagueId=${leagueId}`);
  };

  return (
    <MobileBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Détails du manager"
    >
      <div className="space-y-6">
        {/* Manager Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ManagerNameWithJersey managerId={managerId} managerName={managerName} />
            <ManagerPrestigeIcons
              managerId={managerId}
              phaseId={phaseId}
              saisonId={saisonId}
              isMobile
            />
            {rank === 10 && <span className="text-xl">🤡</span>}
          </div>
        </div>

        {/* Rank */}
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-1">
            {getRankLabel(rank)}
          </div>
        </div>

        {/* Total Points - Big Display */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-6 text-center">
          <div className="text-4xl font-bold text-primary mb-1">
            {totalPoints.toLocaleString('fr-FR')}
          </div>
          <div className="text-sm text-muted-foreground">
            points totaux
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted/50 rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">Évolution</div>
            {getEvolutionDisplay()}
          </div>

          <div className="bg-muted/50 rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">Pourcentage</div>
            <div className="text-lg font-semibold">{percentage}%</div>
          </div>

          <div className="bg-muted/50 rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">Scoreurs</div>
            <div className="text-lg font-semibold">{scoreursCount ?? 0}</div>
          </div>

          <div className="bg-muted/50 rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">Victoires</div>
            <div className="text-lg font-semibold">{victoriesCount ?? 0}</div>
          </div>
        </div>

        {/* View Full Details Button */}
        <Button
          onClick={handleViewDetails}
          className="w-full"
          size="lg"
        >
          Voir le détail complet
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </MobileBottomSheet>
  );
}
