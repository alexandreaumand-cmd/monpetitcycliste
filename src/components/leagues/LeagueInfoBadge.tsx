import { Badge } from "@/components/ui/badge";
import { Trophy, Calendar } from "lucide-react";
import { useCurrentLeagueInfo } from "@/hooks/useCurrentLeagueInfo";
import { Skeleton } from "@/components/ui/skeleton";

export function LeagueInfoBadge() {
  const { data: leagueInfo, isLoading } = useCurrentLeagueInfo();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-20" />
      </div>
    );
  }

  if (!leagueInfo) return null;

  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary" className="gap-1.5 font-normal">
        <Trophy className="h-3 w-3" />
        {leagueInfo.gameModeName}
      </Badge>
      
      {leagueInfo.seasonYear && (
        <Badge variant="outline" className="gap-1.5 font-normal">
          <Calendar className="h-3 w-3" />
          {leagueInfo.seasonYear}
        </Badge>
      )}
    </div>
  );
}
