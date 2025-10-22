import { Badge } from "@/components/ui/badge";
import type { LeagueStatus } from "@/lib/leagues/types";
import { Clock, Play, Trophy, Ban } from "lucide-react";

type LeagueStatusBadgeProps = {
  status: LeagueStatus;
  className?: string;
};

const statusConfig = {
  pending: {
    label: 'En attente',
    icon: Clock,
    variant: 'secondary' as const,
  },
  active: {
    label: 'En cours',
    icon: Play,
    variant: 'default' as const,
  },
  completed: {
    label: 'Terminée',
    icon: Trophy,
    variant: 'outline' as const,
  },
  cancelled: {
    label: 'Annulée',
    icon: Ban,
    variant: 'destructive' as const,
  },
};

export function LeagueStatusBadge({ status, className }: LeagueStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}
