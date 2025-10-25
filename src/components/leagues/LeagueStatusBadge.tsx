import { Badge } from "@/components/ui/badge";
import type { LeagueStatus } from "@/lib/leagues/types";
import { Clock, Play, Trophy, Ban, CheckCircle } from "lucide-react";

type LeagueStatusBadgeProps = {
  status: LeagueStatus;
  currentPlayerCount: number;
  maxPlayers: number;
  className?: string;
};

export function LeagueStatusBadge({ status, currentPlayerCount, maxPlayers, className }: LeagueStatusBadgeProps) {
  const getDisplayStatus = () => {
    if (status === 'pending') {
      if (currentPlayerCount < maxPlayers) {
        return {
          label: 'En attente',
          icon: Clock,
          variant: 'secondary' as const,
        };
      } else {
        return {
          label: 'Prêt à lancer',
          icon: CheckCircle,
          variant: 'default' as const,
        };
      }
    }
    
    if (status === 'active') {
      return {
        label: 'En cours',
        icon: Play,
        variant: 'default' as const,
      };
    }
    
    if (status === 'completed') {
      return {
        label: 'Terminée',
        icon: Trophy,
        variant: 'outline' as const,
      };
    }
    
    return {
      label: 'Annulée',
      icon: Ban,
      variant: 'destructive' as const,
    };
  };

  const config = getDisplayStatus();
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}
