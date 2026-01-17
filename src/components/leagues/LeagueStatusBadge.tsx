import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation('dashboard');

  const getDisplayStatus = () => {
    if (status === 'pending') {
      if (currentPlayerCount < maxPlayers) {
        return {
          label: t('leagueCard.status.waiting'),
          icon: Clock,
          variant: 'secondary' as const,
        };
      } else {
        return {
          label: t('leagueCard.status.readyToLaunch'),
          icon: CheckCircle,
          variant: 'default' as const,
        };
      }
    }
    
    if (status === 'active') {
      return {
        label: t('leagueCard.status.inProgress'),
        icon: Play,
        variant: 'default' as const,
      };
    }
    
    if (status === 'completed') {
      return {
        label: t('leagueCard.status.completed'),
        icon: Trophy,
        variant: 'outline' as const,
      };
    }
    
    return {
      label: t('leagueCard.status.cancelled'),
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
