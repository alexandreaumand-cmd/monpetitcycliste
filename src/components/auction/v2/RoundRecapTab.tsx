import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Loader2, ChevronDown, Search, ListOrdered, Trophy, XCircle } from "lucide-react";
import { formatAmount, cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";

interface RoundRecapTabProps {
  phaseId: string;
  managerId: string;
  leagueId: string | null;
  rounds: Array<{ round_number: number }>;
}

interface BidRow {
  bid_id: string;
  manager_id: string;
  manager_nom: string;
  amount: number;
  isWinner: boolean;
  isMine: boolean;
}

interface RiderGroup {
  coureur_id: string;
  coureur_nom: string;
  coureur_equipe: string | null;
  prix_initial: number | null;
  retainedAmount: number;
  winnerName: string | null;
  bids: BidRow[];
}

export function RoundRecapTab({ phaseId, managerId, leagueId, rounds }: RoundRecapTabProps) {
  const { t } = useTranslation("auction");
  const isMobile = useIsMobile();
  const sortedRounds = useMemo(
    () => [...rounds].sort((a, b) => a.round_number - b.round_number),
    [rounds]
  );
  const lastRound = sortedRounds.length ? sortedRounds[sortedRounds.length - 1].round_number : null;
  const [selectedRound, setSelectedRound] = useState<number | null>(lastRound);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedRound(lastRound);
  }, [lastRound]);

  useEffect(() => {
    setExpanded(new Set());
  }, [selectedRound]);

  const { data, isLoading } = useQuery({
    queryKey: ["round-recap-all-bids", phaseId, leagueId, selectedRound],
    enabled: !!phaseId && selectedRound != null,
    queryFn: async () => {
      let query = supabase
        .from("bids_outcomes")
        .select("bid_id, manager_id, coureur_id, coureur_nom, coureur_equipe, my_bid, outcome, winning_amount, winning_manager, managers!inner(nom)")
        .eq("phase_id", phaseId)
        .eq("round_number", selectedRound!);

      if (leagueId) query = query.eq("league_id", leagueId);

      const { data: rows, error } = await query;
      if (error) throw error;

      const unique = (rows || []).filter(
        (r: any, idx: number, arr: any[]) => arr.findIndex((x: any) => x.bid_id === r.bid_id) === idx
      );

      const coureurIds = [...new Set(unique.map((r: any) => r.coureur_id).filter(Boolean))];
      let prices: Record<string, number | null> = {};
      if (coureurIds.length > 0) {
        const { data: coureurs } = await supabase
          .from("coureurs")
          .select("id, prix_initial")
          .in("id", coureurIds as string[]);
        prices = Object.fromEntries((coureurs || []).map((c: any) => [c.id, c.prix_initial]));
      }

      const map = new Map<string, RiderGroup>();
      for (const r of unique as any[]) {
        if (!r.coureur_id) continue;
        let group = map.get(r.coureur_id);
        if (!group) {
          group = {
            coureur_id: r.coureur_id,
            coureur_nom: r.coureur_nom || "—",
            coureur_equipe: r.coureur_equipe,
            prix_initial: prices[r.coureur_id] ?? null,
            retainedAmount: 0,
            winnerName: null,
            bids: [],
          };
          map.set(r.coureur_id, group);
        }
        const amount = Number(r.my_bid || 0);
        const isWinner = r.outcome === "won";
        group.bids.push({
          bid_id: r.bid_id,
          manager_id: r.manager_id,
          manager_nom: r.managers?.nom || t("teams.unknown"),
          amount,
          isWinner,
          isMine: r.manager_id === managerId,
        });
        if (isWinner) {
          group.winnerName = r.managers?.nom || r.winning_manager || null;
        }
        const winning = r.winning_amount != null ? Number(r.winning_amount) : null;
        group.retainedAmount = Math.max(group.retainedAmount, winning ?? amount);
      }

      const groups = [...map.values()];
      for (const g of groups) {
        g.bids.sort((a, b) => b.amount - a.amount || a.manager_nom.localeCompare(b.manager_nom));
      }
      groups.sort(
        (a, b) => b.retainedAmount - a.retainedAmount || a.coureur_nom.localeCompare(b.coureur_nom)
      );
      return groups;
    },
  });

  const groups = data || [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.coureur_nom.toLowerCase().includes(q) ||
        (g.coureur_equipe || "").toLowerCase().includes(q) ||
        g.bids.some((b) => b.manager_nom.toLowerCase().includes(q))
    );
  }, [groups, search]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (sortedRounds.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          {t("history.noHistory")}
        </CardContent>
      </Card>
    );
  }

  const renderBids = (g: RiderGroup) => (
    <div className="space-y-1.5 pt-2">
      {g.bids.map((b) => (
        <div
          key={b.bid_id}
          className={cn(
            "flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm",
            b.isWinner ? "border-primary/40 bg-primary/5" : "border-border/60",
            b.isMine && "ring-1 ring-primary/40"
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            {b.isWinner ? (
              <Trophy className="h-3.5 w-3.5 shrink-0 text-primary" />
            ) : (
              <XCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className={cn("truncate", b.isMine && "font-semibold")}>{b.manager_nom}</span>
            {b.isMine && (
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {t("roundRecap.me")}
              </Badge>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="font-mono font-semibold">{formatAmount(b.amount)}</span>
            <span className="text-xs text-muted-foreground">
              {b.isWinner ? t("roundRecap.won") : t("roundRecap.lost")}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Round selector */}
      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-2">
          {sortedRounds.map((r) => (
            <Button
              key={r.round_number}
              size="sm"
              variant={selectedRound === r.round_number ? "default" : "outline"}
              onClick={() => setSelectedRound(r.round_number)}
              className="shrink-0"
            >
              {t("round")} {r.round_number}
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <ListOrdered className="h-4 w-4 text-primary" />
            {t("roundRecap.title")}
            <Badge variant="secondary">
              {t("riders_count", { count: filtered.length })}
            </Badge>
          </CardTitle>
          <div className="relative pt-2">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("roundRecap.searchPlaceholder")}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{t("roundRecap.empty")}</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((g) => (
                <Collapsible
                  key={g.coureur_id}
                  open={expanded.has(g.coureur_id)}
                  onOpenChange={() => toggle(g.coureur_id)}
                >
                  <CollapsibleTrigger className="w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold">{g.coureur_nom}</span>
                          {g.winnerName ? (
                            <Badge variant="default" className="shrink-0 text-[10px]">
                              {g.winnerName}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {t("roundRecap.unassigned")}
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {g.coureur_equipe || "—"}
                          {g.prix_initial != null && (
                            <>
                              {" · "}
                              {t("roundRecap.odds")} {formatAmount(g.prix_initial)}
                            </>
                          )}
                          {!isMobile && (
                            <>
                              {" · "}
                              {t("roundRecap.biddersCount", { count: g.bids.length })}
                            </>
                          )}
                        </p>
                        {isMobile && (
                          <p className="text-xs text-muted-foreground">
                            {t("roundRecap.biddersCount", { count: g.bids.length })}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-base font-bold text-primary">
                          {formatAmount(g.retainedAmount)}
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform",
                            expanded.has(g.coureur_id) && "rotate-180"
                          )}
                        />
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>{renderBids(g)}</CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
