import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RiderResultsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riderId: string | null;
  riderName: string | null;
  saisonId: string | null;
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
    ? data.rows
        .filter((r) => !r.is_bonus)
        .reduce<Record<string, ResultRow[]>>((acc, row) => {
          const key = row.course_nom;
          if (!acc[key]) acc[key] = [];
          acc[key].push(row);
          return acc;
        }, {})
    : {};

  const bonusRows = data?.rows?.filter((r) => r.is_bonus) || [];

  const getPositionBadge = (position: number | null) => {
    if (!position) return null;
    if (position <= 3) {
      const colors = [
        "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
        "bg-gray-300/20 text-gray-500 border-gray-400/30",
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
    if (type === "GC" || type === "general") return "CG";
    if (type === "stage" || type === "etape") return etape ? `Ét. ${etape}` : "Étape";
    if (type === "points") return "Pts";
    if (type === "mountain" || type === "kom") return "GPM";
    if (type === "youth") return "Jeune";
    return type;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        className="w-full sm:w-[420px] md:w-[480px] overflow-y-auto p-0 border-l"
      >
        <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
          <SheetHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base font-bold flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                {riderName || "Coureur"}
              </SheetTitle>
            </div>
            <SheetDescription className="text-xs">
              {data?.rider?.equipe && (
                <span>{data.rider.equipe} · </span>
              )}
              <span className="font-semibold text-foreground">
                {data?.total ?? 0} pts
              </span>
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="px-4 py-3 space-y-3">
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
                        {courseTotal} pts
                      </span>
                    </div>
                    <div className="divide-y">
                      {rows.map((row, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-1.5 text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-muted-foreground w-10 shrink-0">
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
                            {row.points > 0 ? `+${row.points}` : row.points}
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
                      {bonusRows.reduce((s, r) => s + r.points, 0)} pts
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
                          +{row.points}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
