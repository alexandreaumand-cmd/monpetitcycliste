import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownUp, Plus, Minus } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface StartlistTrackerMovementsProps {
  phaseId: string;
  leagueId: string;
}

export function StartlistTrackerMovements({ phaseId, leagueId }: StartlistTrackerMovementsProps) {
  // 1. Get course_ids for the current phase
  const { data: phaseCourseIds } = useQuery({
    queryKey: ["phase-courses-for-movements", phaseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id")
        .eq("phase_id", phaseId);
      return (data || []).map(c => c.id);
    },
    enabled: !!phaseId,
  });

  // 2. Get tracker changes for those courses
  const { data: changes, isLoading } = useQuery({
    queryKey: ["startlist-tracker-movements", phaseCourseIds],
    queryFn: async () => {
      if (!phaseCourseIds?.length) return [];
      const { data } = await supabase
        .from("startlist_tracker_changes")
        .select("id, change_type, rider_name, team_name, course_name, course_id, coureur_id, detected_at")
        .in("course_id", phaseCourseIds)
        .order("detected_at", { ascending: false })
        .limit(200);
      return data || [];
    },
    enabled: !!phaseCourseIds?.length,
  });

  // 3. Get rosters for the league to map coureur_id -> manager name
  const { data: rosterMap } = useQuery({
    queryKey: ["roster-manager-map", leagueId],
    queryFn: async () => {
      const { data } = await supabase
        .from("rosters")
        .select("coureur_id, manager_id, managers!inner(nom)")
        .eq("league_id", leagueId);
      
      const map = new Map<string, string>();
      (data || []).forEach((r: any) => {
        map.set(r.coureur_id, r.managers?.nom || "-");
      });
      return map;
    },
    enabled: !!leagueId,
  });

  // Group changes by course
  const groupedByCourse = useMemo(() => {
    if (!changes) return [];
    const groups = new Map<string, { courseName: string; items: typeof changes }>();
    for (const c of changes) {
      if (!groups.has(c.course_id)) {
        groups.set(c.course_id, { courseName: c.course_name, items: [] });
      }
      groups.get(c.course_id)!.items.push(c);
    }
    return Array.from(groups.entries()).map(([courseId, { courseName, items }]) => ({
      courseId,
      courseName,
      items,
    }));
  }, [changes]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ArrowDownUp className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Mouvements startlists</h3>
      </div>

      {groupedByCourse.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun mouvement détecté pour cette phase.</p>
      ) : (
        <Accordion type="multiple" className="w-full">
          {groupedByCourse.map(({ courseId, courseName, items }) => (
            <AccordionItem key={courseId} value={courseId}>
              <AccordionTrigger className="text-sm py-3">
                <span className="flex items-center gap-2">
                  {courseName}
                  <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Type</TableHead>
                        <TableHead>Coureur</TableHead>
                        <TableHead>Équipe</TableHead>
                        <TableHead>Manager</TableHead>
                        <TableHead className="w-32">Détecté</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {item.change_type === "added" ? (
                              <Badge className="bg-green-600 text-white text-xs gap-1">
                                <Plus className="h-3 w-3" /> Ajout
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs gap-1">
                                <Minus className="h-3 w-3" /> Retrait
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{item.rider_name}</TableCell>
                          <TableCell className="text-muted-foreground">{item.team_name || "-"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {rosterMap?.get(item.coureur_id || "") || "-"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(item.detected_at), "dd MMM HH:mm", { locale: fr })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg border bg-card">
                      <div className={`flex-shrink-0 rounded-full p-1.5 ${
                        item.change_type === "added"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {item.change_type === "added" ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{item.rider_name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {item.team_name || "-"} • {rosterMap?.get(item.coureur_id || "") || "-"}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(item.detected_at), "dd MMM HH:mm", { locale: fr })}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
