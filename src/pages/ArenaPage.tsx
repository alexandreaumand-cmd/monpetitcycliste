import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, Vote, MessageCircle, Crown } from "lucide-react";
import { PronosticsTab } from "@/components/arena/PronosticsTab";
import { VotesTab } from "@/components/arena/VotesTab";
import { TrashTalkTab } from "@/components/arena/TrashTalkTab";
import { HallOfFameSection } from "@/components/arena/HallOfFameSection";
import { useLeague } from "@/contexts/LeagueContext";

const VALID_TABS = ["pronostics", "votes", "trashtalk", "halloffame"] as const;

export default function ArenaPage() {
  const { t } = useTranslation("arena");
  const { leagueId } = useLeague();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const tabFromUrl = searchParams.get("tab");
  const defaultTab = VALID_TABS.includes(tabFromUrl as any) ? tabFromUrl! : "pronostics";

  const handleTabChange = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === "pronostics") {
      newParams.delete("tab");
    } else {
      newParams.set("tab", value);
    }
    setSearchParams(newParams, { replace: true });
  };
  if (!leagueId) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        {t("selectLeague")}
      </div>
    );
  }

  return (
    <div className="space-y-0 pt-2 overflow-hidden">
      <Tabs value={defaultTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pronostics" className="gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tabs.pronostics")}</span>
          </TabsTrigger>
          <TabsTrigger value="votes" className="gap-2">
            <Vote className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tabs.votes")}</span>
          </TabsTrigger>
          <TabsTrigger value="trashtalk" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tabs.trashTalk")}</span>
          </TabsTrigger>
          <TabsTrigger value="halloffame" className="gap-2">
            <Crown className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tabs.hallOfFame")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pronostics">
          <PronosticsTab leagueId={leagueId} />
        </TabsContent>
        <TabsContent value="votes">
          <VotesTab leagueId={leagueId} />
        </TabsContent>
        <TabsContent value="trashtalk">
          <TrashTalkTab leagueId={leagueId} />
        </TabsContent>
        <TabsContent value="halloffame">
          <HallOfFameSection leagueId={leagueId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
