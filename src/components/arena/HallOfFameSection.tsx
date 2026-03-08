import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Trophy, Star, Heart } from "lucide-react";
import { usePrestigeStandings } from "@/hooks/usePrestigeStandings";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface HallOfFameSectionProps {
  leagueId: string;
}

const PODIUM_CONFIG = [
  { rank: 1, icon: "🥇", size: "h-16 w-16", textSize: "text-lg", ring: "ring-2 ring-yellow-400" },
  { rank: 2, icon: "🥈", size: "h-14 w-14", textSize: "text-base", ring: "ring-2 ring-gray-300" },
  { rank: 3, icon: "🥉", size: "h-12 w-12", textSize: "text-sm", ring: "ring-2 ring-amber-600" },
];

export const HallOfFameSection = ({ leagueId }: HallOfFameSectionProps) => {
  const { t } = useTranslation("arena");
  const { data: standings, isLoading } = usePrestigeStandings(leagueId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            {t("hallOfFame.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (!standings || standings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            {t("hallOfFame.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Crown className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">{t("hallOfFame.empty")}</p>
            <p className="text-sm">{t("hallOfFame.emptyDesc")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const podium = standings.slice(0, 3);
  const rest = standings.slice(3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-yellow-500" />
          {t("hallOfFame.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Podium */}
        <div className="flex items-end justify-center gap-4 py-4">
          {[1, 0, 2].map((idx) => {
            const entry = podium[idx];
            if (!entry) return null;
            const config = PODIUM_CONFIG[idx];
            return (
              <div key={entry.manager_id} className="flex flex-col items-center gap-1">
                <span className="text-2xl">{config.icon}</span>
                <Avatar className={`${config.size} ${config.ring}`}>
                  <AvatarImage src={entry.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {entry.manager_nom.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className={`font-semibold ${config.textSize} text-foreground`}>
                  {entry.manager_nom}
                </span>
                <Badge variant="secondary" className="gap-1">
                  <Trophy className="h-3 w-3" />
                  {entry.total_points} {t("hallOfFame.pts")}
                </Badge>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  {entry.pronostic_points > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Star className="h-3 w-3" /> {entry.pronostic_points}
                    </span>
                  )}
                  {entry.reaction_points > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Heart className="h-3 w-3" /> {entry.reaction_points}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rest of leaderboard */}
        {rest.length > 0 && (
          <div className="space-y-2">
            {rest.map((entry, idx) => (
              <div
                key={entry.manager_id}
                className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
              >
                <span className="w-6 text-center font-mono text-sm text-muted-foreground">
                  {idx + 4}
                </span>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={entry.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {entry.manager_nom.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 font-medium text-sm text-foreground">
                  {entry.manager_nom}
                </span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {entry.pronostic_points > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Star className="h-3 w-3" /> {entry.pronostic_points}
                    </span>
                  )}
                  {entry.reaction_points > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Heart className="h-3 w-3" /> {entry.reaction_points}
                    </span>
                  )}
                </div>
                <Badge variant="outline" className="gap-1">
                  <Trophy className="h-3 w-3" />
                  {entry.total_points}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
