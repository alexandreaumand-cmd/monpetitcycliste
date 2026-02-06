import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, Vote, MessageCircle, Crown } from "lucide-react";
import { PronosticsTab } from "@/components/arena/PronosticsTab";
import { VotesTab } from "@/components/arena/VotesTab";
import { TrashTalkTab } from "@/components/arena/TrashTalkTab";
import { HallOfFameSection } from "@/components/arena/HallOfFameSection";
import { useLeague } from "@/contexts/LeagueContext";

export default function ArenaPage() {
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
    <div className="space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          🏟️ {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="pronostics" className="w-full">
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
