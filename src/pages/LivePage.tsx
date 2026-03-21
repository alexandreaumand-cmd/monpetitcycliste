import { useTranslation } from "react-i18next";
import { LiveCoursesTab } from "@/components/arena/LiveCoursesTab";
import { useLeague } from "@/contexts/LeagueContext";

export default function LivePage() {
  const { t } = useTranslation("arena");
  const { leagueId } = useLeague();

  if (!leagueId) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        {t("selectLeague")}
      </div>
    );
  }

  return (
    <div className="space-y-0 pt-2">
      <LiveCoursesTab leagueId={leagueId} />
    </div>
  );
}
