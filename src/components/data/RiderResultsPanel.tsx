import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { sortPointsRows } from "@/lib/pointsRowOrder";


interface RiderResultsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riderId: string | null;
  riderName: string | null;
  saisonId: string | null;
  cote?: number | null;
}

interface ResultRow {
  course_nom: string;
  type_classement: string;
  etape_numero: number | null;
  position: number | null;
  points: number;
  is_bonus: boolean;
  is_ttt: boolean;
  phase_nom: string;
  phase_index: number;
  course_date?: string;
}

export function RiderResultsPanel({
  open,
  onOpenChange,
  riderId,
  riderName,
  saisonId,
  cote,
}: RiderResultsPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["rider-results-panel", riderId, saisonId],
    queryFn: async () => {
      if (!riderId || !saisonId) return null;

      const { data, error } = await supabase.functions.invoke(
        "get-rider-points-table",
        {
          body: { rider_id: riderId, saison_id: saisonId },
        }
      );

      if (error) throw error;
      return data as {
        rider: { id: string; nom: string; equipe: string; total_points: number };
        rows: ResultRow[];
        total: number;
      };
    },
    enabled: open && !!riderId && !!saisonId,
  });

  // Group rows by course for a cleaner display
  const courseGroups = data?.rows
    ? Object.fromEntries(
        Object.entries(
          data.rows
            .filter((r) => !r.is_bonus)
            .reduce<Record<string, ResultRow[]>>((acc, row) => {
              const key = row.course_nom;
              if (!acc[key]) acc[key] = [];
              acc[key].push(row);
              return acc;
            }, {})
        ).map(([key, rows]) => [key, sortPointsRows(rows)])
      )
    : {};


  const bonusRows = data?.rows?.filter((r) => r.is_bonus) || [];
  const [showDetails, setShowDetails] = useState(true);

  // KPIs — on exclut les porteurs de maillot (points attribués sur étapes)
  const raceRows = data?.rows?.filter((r) => !r.is_bonus) || [];
  const kpiRows = raceRows.filter(
    (r) =>
      !r.type_classement?.startsWith("Porteur") &&
      !r.type_classement?.startsWith("Combatif")
  );
  const total = Math.round(data?.total ?? 0);
  const wins = kpiRows.filter((r) => r.position === 1).length;
  const podiums = kpiRows.filter((r) => r.position && r.position <= 3).length;
  const top10 = kpiRows.filter((r) => r.position && r.position <= 10).length;
  const scoredCourses = new Set(raceRows.filter((r) => r.points > 0).map((r) => r.course_nom)).size;
  const ratio = cote && cote > 0 ? (total / cote).toFixed(1) : null;

  // Points by phase
  const phaseData = (() => {
    const map = new Map<number, number>();
    (data?.rows || []).forEach((r) => {
      if (r.phase_index > 0) map.set(r.phase_index, (map.get(r.phase_index) || 0) + r.points);
    });
    const maxIdx = Math.max(5, ...map.keys());
    return Array.from({ length: maxIdx }, (_, i) => ({
      phase: `P${i + 1}`,
      points: Math.round(map.get(i + 1) || 0),
    }));
  })();

  const getPositionBadge = (position: number | null) => {
    if (!position) return null;
    if (position <= 3) {
      const colors = [
        "bg-bordure-gold/20 text-bordure-gold border-bordure-gold/30",
        "bg-gray-300/20 text-muted-foreground border-gray-400/30",
        "bg-orange-400/20 text-orange-600 border-orange-400/30",
      ];
      return (
        <Badge variant="outline" className={`text-xs font-bold ${colors[position - 1]}`}>
          {position}e
        </Badge>
      );
    }
    return (
      <span className="text-xs text-muted-foreground">{position}e</span>
    );
  };

  const getClassementLabel = (type: string, etape: number | null) => {
    let label = type;
    if (type === "GC" || type === "general") label = "Général";
    else if (type === "stage" || type === "etape") label = "Étape";
    else if (type === "points") label = "Points";
    else if (type === "mountain" || type === "kom") label = "GPM";
    else if (type === "youth") label = "Jeune";
    else if (type === "Porteur Leader") label = "Leader";
    else if (type === "Porteur Vert") label = "Maillot Vert";
    else if (type === "Porteur Pois") label = "Maillot Pois";
    else if (type === "Porteur Blanc") label = "Maillot Blanc";

    if (etape) label += ` ét.${etape}`;
    return label;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-lg">
        <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 pr-12">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{riderName || "Coureur"}</span>
              {cote != null && (
                <Badge variant="outline" className="text-xs shrink-0">Cote {cote}</Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {data?.rider?.equipe && data.rider.equipe !== 'N/A' && (
                <span>{data.rider.equipe} · </span>
              )}
              <span className="font-semibold text-foreground">{total} pts</span>
            </DialogDescription>
          </DialogHeader>
        </div>

        {!isLoading && data && data.rows.length > 0 && (
          <div className="px-4 pt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: "Points", value: total },
                { label: "Points / cote", value: ratio ?? "-" },
                { label: "Victoires · Podiums · Top 10", value: `${wins} · ${podiums} · ${top10}` },
                { label: "Courses scorées", value: scoredCourses },
              ].map((k) => (
                <div key={k.label} className="rounded-lg border bg-card px-3 py-2">
                  <div className="text-[11px] text-muted-foreground leading-tight">{k.label}</div>
                  <div className="text-lg font-bold tabular-nums">{k.value}</div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border bg-card px-3 py-2">
              <div className="text-sm font-semibold mb-1">Points par phase</div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={phaseData} margin={{ top: 20, right: 4, left: 4, bottom: 0 }}>
                    <XAxis dataKey="phase" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <Bar dataKey="points" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="points" position="top" style={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        <div className="px-4 py-4 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ))}
            </div>
          ) : !data || data.rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Aucun résultat cette saison
            </div>
          ) : (
            <>
              {/* Race results grouped by course */}
              {Object.entries(courseGroups).map(([courseName, rows]) => {
                const courseTotal = rows.reduce((s, r) => s + r.points, 0);
                return (
                  <div key={courseName} className="rounded-lg border bg-card">
                    <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                      <span className="text-sm font-semibold truncate">{courseName}</span>
                      <span className="text-xs font-bold text-primary ml-2 whitespace-nowrap">
                        {Math.round(courseTotal)} pts
                      </span>
                    </div>
                    <div className="divide-y">
                      {rows.map((row, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-1.5 text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-muted-foreground shrink-0">
                              {getClassementLabel(row.type_classement, row.etape_numero)}
                            </span>
                            {getPositionBadge(row.position)}
                            {row.is_ttt && (
                              <Badge variant="outline" className="text-[10px] px-1">
                                TTT
                              </Badge>
                            )}
                          </div>
                          <span
                            className={`text-xs font-semibold tabular-nums ${
                              row.points > 0 ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {row.points > 0 ? `+${Math.round(row.points)}` : Math.round(row.points)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Bonus points */}
              {bonusRows.length > 0 && (
                <div className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                    <span className="text-sm font-semibold">Bonus</span>
                    <span className="text-xs font-bold text-primary ml-2">
                      {Math.round(bonusRows.reduce((s, r) => s + r.points, 0))} pts
                    </span>
                  </div>
                  <div className="divide-y">
                    {bonusRows.map((row, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-3 py-1.5 text-sm"
                      >
                        <span className="text-xs text-muted-foreground truncate">
                          {row.type_classement}
                        </span>
                        <span className="text-xs font-semibold tabular-nums">
                          +{Math.round(row.points)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
