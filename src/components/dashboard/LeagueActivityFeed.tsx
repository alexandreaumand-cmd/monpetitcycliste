import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLeague } from "@/contexts/LeagueContext";
import { useCurrentManagerId } from "@/hooks/useArenaPronostics";
import { useDateLocale } from "@/hooks/useDateLocale";
import {
  useLeagueActivityFeed,
  getActivityLastSeen,
  setActivityLastSeen,
  type ActivityItem,
} from "@/hooks/useLeagueActivityFeed";
import {
  Activity,
  Trophy,
  Target,
  HeartPulse,
  ListChecks,
  MessageCircle,
  Gavel,
  ChevronRight,
} from "lucide-react";

type FilterKey = "all" | "mine" | "pronostics";

const KIND_META: Record<
  ActivityItem["kind"],
  { icon: typeof Trophy; tone: string }
> = {
  result: { icon: Trophy, tone: "text-bordure-gold" },
  pronostic: { icon: Target, tone: "text-primary" },
  injury: { icon: HeartPulse, tone: "text-destructive" },
  startlist: { icon: ListChecks, tone: "text-muted-foreground" },
  chat: { icon: MessageCircle, tone: "text-secondary-foreground" },
  auction: { icon: Gavel, tone: "text-primary" },
};

export const LeagueActivityFeed = () => {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const locale = useDateLocale();
  const { leagueId } = useLeague();
  const { data: managerId } = useCurrentManagerId();
  const { data: items, isLoading } = useLeagueActivityFeed(leagueId, managerId);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [expanded, setExpanded] = useState(false);

  // Snapshot of the previous visit, kept stable for this render session.
  const lastSeenRef = useRef<number | null>(null);
  if (lastSeenRef.current === null && leagueId) {
    lastSeenRef.current = getActivityLastSeen(leagueId);
  }
  const lastSeen = lastSeenRef.current ?? 0;

  useEffect(() => {
    if (leagueId && items && items.length > 0) {
      setActivityLastSeen(leagueId);
    }
  }, [leagueId, items]);

  const { todo, timeline } = useMemo(() => {
    const now = Date.now();
    const all = items ?? [];
    const todoItems = all.filter(
      (i) => i.kind === "pronostic" && !i.is_mine && new Date(i.occurred_at).getTime() > now
    );
    let rest = all.filter((i) => !todoItems.includes(i));
    if (filter === "mine") rest = rest.filter((i) => i.is_mine);
    if (filter === "pronostics") rest = rest.filter((i) => i.kind === "pronostic");
    rest = rest.filter((i) => new Date(i.occurred_at).getTime() <= now || i.kind !== "pronostic");
    return { todo: todoItems, timeline: rest };
  }, [items, filter]);

  const go = (path: string) => {
    navigate(leagueId ? `${path}${path.includes("?") ? "&" : "?"}leagueId=${leagueId}` : path);
  };

  const describe = (item: ActivityItem) => {
    switch (item.kind) {
      case "result":
        return item.my_points && item.my_points > 0
          ? t("activity.resultWithPoints", {
              points: Math.round(item.my_points),
              rank: item.my_rank ?? "-",
            })
          : t("activity.resultNoPoints");
      case "pronostic":
        return item.is_mine ? t("activity.pronosticDone") : t("activity.pronosticTodo");
      case "injury":
        return item.subtitle || t("activity.injury");
      case "startlist":
        return t("activity.startlist", { change: item.subtitle ?? "" });
      case "chat":
        return t("activity.chat", { count: item.count_value ?? 0 });
      case "auction":
        return t("activity.auction", { round: item.count_value ?? "" });
      default:
        return item.subtitle ?? "";
    }
  };

  const titleOf = (item: ActivityItem) => {
    if (item.kind === "chat") return t("activity.trashTalkTitle");
    if (item.kind === "auction") return t("activity.auctionTitle", { round: item.count_value ?? "" });
    return item.title;
  };

  const renderRow = (item: ActivityItem, idx: number) => {
    const meta = KIND_META[item.kind];
    const Icon = meta.icon;
    const ts = new Date(item.occurred_at).getTime();
    const isNew = ts > lastSeen && ts <= Date.now();
    return (
      <button
        key={`${item.kind}-${item.title}-${item.occurred_at}-${idx}`}
        onClick={() => go(item.link_path)}
        className="w-full flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/40"
      >
        <Icon className={cn("h-4 w-4 shrink-0", meta.tone)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{titleOf(item)}</span>
            {isNew && (
              <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px] leading-tight">
                {t("activity.new")}
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{describe(item)}</p>
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {formatDistanceToNow(new Date(item.occurred_at), { addSuffix: true, locale })}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    );
  };

  if (!leagueId) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 font-montserrat text-lg">
            <Activity className="h-5 w-5 text-bordure-gold" />
            {t("activity.title")}
          </CardTitle>
          <div className="flex gap-1">
            {(["all", "mine", "pronostics"] as FilterKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  filter === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                )}
              >
                {t(`activity.filters.${key}`)}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <>
            {todo.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("activity.todo", { count: todo.length })}
                </p>
                <div className="space-y-1.5">
                  {todo.slice(0, 4).map((item, idx) => (
                    <button
                      key={`todo-${idx}`}
                      onClick={() => go(item.link_path)}
                      className="flex w-full items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-left transition-colors hover:bg-primary/10"
                    >
                      <Target className="h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {t("activity.closesIn", {
                            time: formatDistanceToNow(new Date(item.occurred_at), { locale }),
                          })}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {timeline.length === 0 && todo.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("activity.empty")}
              </p>
            ) : (
              <div className="space-y-1.5">
                {(expanded ? timeline : timeline.slice(0, 8)).map(renderRow)}
              </div>
            )}

            {timeline.length > 8 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="w-full text-center text-xs font-medium text-primary hover:underline"
              >
                {expanded ? t("activity.showLess") : t("activity.showMore")}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
