import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  usePronosticStandings,
  usePronosticCoursesForLeague,
} from "@/hooks/useArenaPronostics";
import { ManagerPronosticsDialog } from "./ManagerPronosticsDialog";
import { PronosticProgressionChart } from "./PronosticProgressionChart";

interface PronosticStandingsProps {
  leagueId: string;
}

const ALL_COURSES = "__all__";

const getRankStyle = (index: number) => {
  switch (index) {
    case 0:
      return "text-bordure-gold font-bold";
    case 1:
      return "text-muted-foreground font-semibold";
    case 2:
      return "text-amber-700 font-semibold";
    default:
      return "text-muted-foreground";
  }
};

const getRankEmoji = (index: number) => {
  switch (index) {
    case 0:
      return "🥇";
    case 1:
      return "🥈";
    case 2:
      return "🥉";
    default:
      return null;
  }
};

export const PronosticStandings = ({ leagueId }: PronosticStandingsProps) => {
  const { t } = useTranslation("arena");
  const [courseFilter, setCourseFilter] = useState<string>(ALL_COURSES);
  const [selected, setSelected] = useState<{ id: string; nom: string } | null>(
    null,
  );

  const courseId = courseFilter === ALL_COURSES ? null : courseFilter;
  const { data: standings, isLoading } = usePronosticStandings(leagueId, courseId);
  const { data: courses } = usePronosticCoursesForLeague(leagueId);

  return (
    <div className="space-y-4">
    <Card>
      <CardHeader className="pb-3 space-y-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4" />
          {t("pronostics.standings.title")}
        </CardTitle>
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("pronostics.standings.filterByCourse")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_COURSES}>
              {t("pronostics.standings.allCourses")}
            </SelectItem>
            {(courses || []).map((c) => (
              <SelectItem key={c.course_id} value={c.course_id}>
                {c.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !standings || standings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("pronostics.standings.empty")}
          </p>
        ) : (
          <div className="space-y-2">
            {standings.map((entry, index) => (
              <button
                key={entry.manager_id}
                type="button"
                onClick={() =>
                  setSelected({ id: entry.manager_id, nom: entry.manager_nom })
                }
                className="w-full flex items-center gap-3 py-2 px-2 rounded-md hover:bg-muted/50 transition-colors text-left"
              >
                <span className={`w-6 text-center text-sm ${getRankStyle(index)}`}>
                  {getRankEmoji(index) || `${index + 1}.`}
                </span>
                <Avatar className="h-7 w-7">
                  <AvatarImage src={entry.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {entry.manager_nom.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm font-medium truncate">
                  {entry.manager_nom}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {entry.correct_count}/{entry.total_count}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </CardContent>

      <ManagerPronosticsDialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        leagueId={leagueId}
        managerId={selected?.id ?? null}
        managerNom={selected?.nom ?? ""}
        courseId={courseId}
      />
    </Card>
  );
};
