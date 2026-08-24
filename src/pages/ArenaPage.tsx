import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, MessageCircle } from "lucide-react";
import { PronosticsTab } from "@/components/arena/PronosticsTab";
import { TrashTalkTab } from "@/components/arena/TrashTalkTab";
import { useLeague } from "@/contexts/LeagueContext";

const VALID_TABS = ["pronostics", "trashtalk"] as const;

/** Retired tabs: polls now live inside Trash Talk, prestige inside the pronostic standings. */
const LEGACY_TAB_REDIRECTS: Record<string, (typeof VALID_TABS)[number]> = {
  votes: "trashtalk",
  halloffame: "pronostics",
};

export default function ArenaPage() {
  const { t } = useTranslation("arena");
  const { leagueId } = useLeague();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabFromUrl = searchParams.get("tab");
  const redirected = tabFromUrl ? LEGACY_TAB_REDIRECTS[tabFromUrl] : undefined;
  const activeTab = VALID_TABS.includes(tabFromUrl as any)
    ? (tabFromUrl as (typeof VALID_TABS)[number])
    : (redirected ?? "pronostics");

  // Keep old bookmarks working without leaving a dead ?tab= value in the URL.
  useEffect(() => {
    if (!tabFromUrl || VALID_TABS.includes(tabFromUrl as any)) return;
    const newParams = new URLSearchParams(searchParams);
    const target = LEGACY_TAB_REDIRECTS[tabFromUrl];
    if (target && target !== "pronostics") newParams.set("tab", target);
    else newParams.delete("tab");
    setSearchParams(newParams, { replace: true });
  }, [tabFromUrl, searchParams, setSearchParams]);

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
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="sticky top-0 z-20 grid w-full grid-cols-2">
          <TabsTrigger value="pronostics" className="gap-2">
            <Target className="h-4 w-4" />
            {t("tabs.pronostics")}
          </TabsTrigger>
          <TabsTrigger value="trashtalk" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            {t("tabs.trashTalk")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pronostics">
          <PronosticsTab leagueId={leagueId} />
        </TabsContent>
        <TabsContent value="trashtalk">
          <TrashTalkTab leagueId={leagueId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
