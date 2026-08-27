import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLeague } from "@/contexts/LeagueContext";
import { useCurrentManagerId } from "@/hooks/useArenaPronostics";
import { useCurrentManager } from "@/hooks/useCurrentManager";
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
  ChevronDown,
  Check,
  X,
} from "lucide-react";

type FilterKey = "all" | "mine" | "pronostics";

const KIND_META: Record<
  ActivityItem["kind"],
  { icon: typeof Trophy; tone: string }
> = {
  result: { icon: Trophy, tone: "text-bordure-gold" },
  pronostic: { icon: Target, tone: "text-primary" },
  pronostic_result: { icon: Target, tone: "text-bordure-gold" },
  injury: { icon: HeartPulse, tone: "text-destructive" },
  startlist: { icon: ListChecks, tone: "text-muted-foreground" },
  chat: { icon: MessageCircle, tone: "text-secondary-foreground" },
  auction: { icon: Gavel, tone: "text-primary" },
};

/** A timeline entry is either a race group (results / startlist moves) or a single item. */
type TimelineEntry =
  | {
      type: "group";
      variant: "result" | "startlist";
      key: string;
      courseNom: string;
      occurredAt: string;
      items: ActivityItem[];
    }
  | { type: "single"; key: string; item: ActivityItem };

export const LeagueActivityFeed = () => {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const locale = useDateLocale();
  const isMobile = useIsMobile();
  const { leagueId } = useLeague();
  const { data: managerId } = useCurrentManagerId();
  const { data: currentManager } = useCurrentManager();
  const myName = currentManager?.nom ?? t("activity.me");
  const { data: items, isLoading } = useLeagueActivityFeed(leagueId, managerId);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [expanded, setExpanded] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

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

  const timeAgo = (iso: string) =>
    formatDistanceToNow(new Date(iso), { addSuffix: true, locale });

  const { todo, timeline } = useMemo(() => {
    const now = Date.now();
    const all = items ?? [];
    const todoItems =
      filter === "mine"
        ? []
        : all.filter(
            (i) => i.kind === "pronostic" && !i.is_mine && new Date(i.occurred_at).getTime() > now
          );
    let rest = all.filter((i) => !todoItems.includes(i));
    if (filter === "mine") {
      // No pronostic information at all, and startlist moves limited to my own riders.
      rest = rest.filter((i) => i.kind !== "pronostic" && i.kind !== "pronostic_result");
      rest = rest.filter((i) => (i.kind === "startlist" ? i.manager_is_me === true : i.is_mine));
    }
    if (filter === "pronostics") {
      rest = rest.filter((i) => i.kind === "pronostic" || i.kind === "pronostic_result");
    }
    rest = rest.filter((i) => new Date(i.occurred_at).getTime() <= now || i.kind !== "pronostic");

    // Group result rows and startlist moves by race, keeping chronological order.
    const entries: TimelineEntry[] = [];
    const groupIndex = new Map<string, number>();
    rest.forEach((item, idx) => {
      const groupable =
        (item.kind === "result" || item.kind === "startlist") && !!item.course_id;
      if (groupable) {
        const key = `${item.kind}-${item.course_id}`;
        const existing = groupIndex.get(key);
        if (existing !== undefined) {
          (entries[existing] as Extract<TimelineEntry, { type: "group" }>).items.push(item);
          return;
        }
        groupIndex.set(key, entries.length);
        entries.push({
          type: "group",
          variant: item.kind === "startlist" ? "startlist" : "result",
          key,
          courseNom: item.course_nom ?? item.title,
          occurredAt: item.occurred_at,
          items: [item],
        });
        return;
      }
      entries.push({ type: "single", key: `${item.kind}-${idx}`, item });
    });

    // Sub-rows: results = final classifications first then stages; startlist = newest first.
    entries.forEach((e) => {
      if (e.type !== "group") return;
      if (e.variant === "startlist") {
        e.items.sort(
          (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
        );
      } else {
        e.items.sort((a, b) => (a.etape_numero ?? -1) - (b.etape_numero ?? -1));
      }
    });

    return { todo: todoItems, timeline: entries };
  }, [items, filter]);


  const go = (path: string) => {
    navigate(leagueId ? `${path}${path.includes("?") ? "&" : "?"}leagueId=${leagueId}` : path);
  };

  const describe = (item: ActivityItem) => {
    switch (item.kind) {
      case "result": {
        if (!item.my_points || item.my_points <= 0) return t("activity.resultNoPoints", { name: myName });
        const base = t("activity.resultWithPoints", {
          points: Math.round(item.my_points),
          rank: item.my_rank ?? "-",
          name: myName,
        });
        return item.riders ? `${base} — ${item.riders}` : base;
      }
      case "pronostic":
        return item.is_mine ? t("activity.pronosticDone") : t("activity.pronosticTodo", { name: myName });
      case "pronostic_result": {
        const outcome =
          item.count_value === 1
            ? t("activity.pronosticCorrect")
            : item.count_value === 0
              ? t("activity.pronosticWrong")
              : t("activity.pronosticDone");
        return item.riders ? `${outcome} — ${item.riders}` : outcome;
      }
      case "injury":
        return item.subtitle || t("activity.injury");
      case "startlist": {
        const change =
          item.subtitle === "added"
            ? t("activity.startlistAdded")
            : item.subtitle === "removed"
              ? t("activity.startlistRemoved")
              : (item.subtitle ?? "");
        const owner = item.manager_is_me ? myName : item.manager_nom;
        const parts = [change, item.league_name, owner].filter(Boolean);
        return parts.join(" · ");
      }
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

  const subRowTitle = (item: ActivityItem) => {
    if (item.kind === "startlist") return item.riders ?? item.title;
    return item.etape_numero != null
      ? t("activity.stageLabel", { stage: item.etape_numero })
      : t("activity.finalClassifications");
  };


  const isNewAt = (iso: string) => {
    const ts = new Date(iso).getTime();
    return ts > lastSeen && ts <= Date.now();
  };

  const renderRow = (item: ActivityItem, key: string, title: string, nested = false) => {
    const meta = KIND_META[item.kind];
    const Icon = meta.icon;
    const isNew = isNewAt(item.occurred_at);
    const OutcomeIcon =
      item.kind === "pronostic_result" && item.count_value === 1
        ? Check
        : item.kind === "pronostic_result" && item.count_value === 0
          ? X
          : null;

    if (isMobile) {
      return (
        <button
          key={key}
          onClick={() => go(item.link_path)}
          className={cn(
            "w-full flex items-start gap-2 rounded-lg border bg-card px-2 py-1.5 text-left transition-colors hover:bg-muted/40",
            nested && "border-dashed bg-card/60"
          )}
        >
          {OutcomeIcon ? (
            <OutcomeIcon
              className={cn(
                "h-3.5 w-3.5 shrink-0 mt-0.5",
                item.count_value === 1 ? "text-bordure-gold" : "text-destructive"
              )}
            />
          ) : (
            <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", meta.tone)} />
          )}
          <div className="min-w-0 flex-1 flex flex-col gap-0.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-medium truncate">{title}</span>
                {isNew && (
                  <Badge
                    variant="secondary"
                    className="shrink-0 px-1 py-0 text-[9px] leading-tight"
                  >
                    {t("activity.new")}
                  </Badge>
                )}
              </div>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground truncate">{describe(item)}</p>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {timeAgo(item.occurred_at)}
              </span>
            </div>
          </div>
        </button>
      );
    }

    return (
      <button
        key={key}
        onClick={() => go(item.link_path)}
        className={cn(
          "w-full flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/40",
          nested && "border-dashed bg-card/60"
        )}
      >
        {OutcomeIcon ? (
          <OutcomeIcon
            className={cn(
              "h-4 w-4 shrink-0",
              item.count_value === 1 ? "text-bordure-gold" : "text-destructive"
            )}
          />
        ) : (
          <Icon className={cn("h-4 w-4 shrink-0", meta.tone)} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{title}</span>
            {isNew && (
              <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px] leading-tight">
                {t("activity.new")}
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{describe(item)}</p>
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {timeAgo(item.occurred_at)}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    );
  };

  const renderGroup = (entry: Extract<TimelineEntry, { type: "group" }>) => {
    const isOpen = openGroups[entry.key] ?? false;
    const totalPoints = entry.items.reduce((sum, i) => sum + (i.my_points ?? 0), 0);
    const hasNew = entry.items.some((i) => isNewAt(i.occurred_at));
    const isStartlist = entry.variant === "startlist";
    const GroupIcon = isStartlist ? ListChecks : Trophy;
    const groupIconTone = isStartlist ? "text-muted-foreground" : "text-bordure-gold";
    const summary = isStartlist
      ? t("activity.startlistGroupSummary", { count: entry.items.length })
      : t("activity.groupSummary", {
          count: entry.items.length,
          points: Math.round(totalPoints),
        });



    if (isMobile) {
      return (
        <div key={entry.key} className="space-y-1">
          <button
            onClick={() => setOpenGroups((prev) => ({ ...prev, [entry.key]: !isOpen }))}
            className="w-full flex items-start gap-2 rounded-lg border bg-card px-2 py-1.5 text-left transition-colors hover:bg-muted/40"
          >
            <GroupIcon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", groupIconTone)} />
            <div className="min-w-0 flex-1 flex flex-col gap-0.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm font-semibold truncate">{entry.courseNom}</span>
                  {hasNew && (
                    <Badge
                      variant="secondary"
                      className="shrink-0 px-1 py-0 text-[9px] leading-tight"
                    >
                      {t("activity.new")}
                    </Badge>
                  )}
                </div>
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
              </div>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground truncate">{summary}</p>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {timeAgo(entry.occurredAt)}
                </span>
              </div>
            </div>
          </button>
          {isOpen && (
            <div className="ml-2 space-y-1 border-l pl-2 md:ml-4 md:pl-3">
              {entry.items.map((item, idx) =>
                renderRow(item, `${entry.key}-${idx}`, subRowTitle(item), true)
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={entry.key} className="space-y-1.5">
        <button
          onClick={() => setOpenGroups((prev) => ({ ...prev, [entry.key]: !isOpen }))}
          className="w-full flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/40"
        >
          <GroupIcon className={cn("h-4 w-4 shrink-0", groupIconTone)} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">{entry.courseNom}</span>
              {hasNew && (
                <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px] leading-tight">
                  {t("activity.new")}
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">{summary}</p>
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {timeAgo(entry.occurredAt)}
          </span>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </button>
        {isOpen && (
          <div className="ml-4 space-y-1.5 border-l pl-3">
            {entry.items.map((item, idx) =>
              renderRow(item, `${entry.key}-${idx}`, subRowTitle(item), true)
            )}
          </div>
        )}
      </div>
    );
  };

  if (!leagueId) return null;

  const visible = expanded ? timeline : timeline.slice(0, 8);

  return (
    <Card>
      <CardHeader className="p-4 md:p-6 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 font-montserrat text-base md:text-lg">
            <Activity className="h-5 w-5 text-bordure-gold" />
            {t("activity.title")}
          </CardTitle>
          <div className="flex gap-1">
            {(["all", "mine", "pronostics"] as FilterKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-full px-2 md:px-3 py-1 text-xs font-medium transition-colors",
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
      <CardContent className="p-4 pt-0 md:p-6 space-y-3">
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
                      className="flex w-full items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-2 py-1.5 md:px-3 md:py-2 text-left transition-colors hover:bg-primary/10"
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
                {visible.map((entry) =>
                  entry.type === "group"
                    ? renderGroup(entry)
                    : renderRow(entry.item, entry.key, titleOf(entry.item))
                )}
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
