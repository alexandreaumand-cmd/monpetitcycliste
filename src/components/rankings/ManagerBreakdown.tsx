import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeagueClient } from "@/lib/supabase/leagueClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { useLeague } from "@/contexts/LeagueContext";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDateLocale } from "@/hooks/useDateLocale";

type ManagerBreakdownProps = {
  managerId: string;
  phaseId?: string | null;
};

export const ManagerBreakdown = ({ managerId, phaseId }: ManagerBreakdownProps) => {
  const { t } = useTranslation('rankings');
  const dateLocale = useDateLocale();
  const { leagueId, isLoading: leagueLoading } = useLeague();
  const leagueClient = useLeagueClient();
  
  const { data: breakdown, isLoading } = useQuery({
    queryKey: ["manager-breakdown", managerId, phaseId, leagueId] as const,
    queryFn: async (): Promise<any[]> => {
      if (!leagueId) return [];
      
      const client: any = leagueClient;
      let query = client
        .from("v_manager_breakdown")
        .select("*")
        .eq("manager_id", managerId)
        .eq("league_id", leagueId);
      
      if (phaseId) {
        query = query.eq("phase_id", phaseId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
    enabled: !leagueLoading && !!leagueId,
  });

  // Fetch TTT info for courses
  const courseIds = useMemo(() => {
    if (!breakdown) return [];
    return [...new Set(breakdown.map((item: any) => item.course_id).filter(Boolean))];
  }, [breakdown]);

  const { data: tttData } = useQuery({
    queryKey: ["ttt-status", courseIds],
    queryFn: async () => {
      if (courseIds.length === 0) return [];
      const { data, error } = await supabase
        .from("race_result_sets")
        .select("course_id, type_classement, etape_numero, is_ttt")
        .in("course_id", courseIds)
        .eq("is_ttt", true);
      if (error) throw error;
      return data || [];
    },
    enabled: courseIds.length > 0,
  });

  // Create TTT lookup map
  const tttMap = useMemo(() => {
    const map = new Map<string, boolean>();
    tttData?.forEach((rrs: any) => {
      const key = `${rrs.course_id}_${rrs.type_classement}_${rrs.etape_numero || 'null'}`;
      map.set(key, true);
    });
    return map;
  }, [tttData]);

  // Grouper les points par course
  const groupedByCourse = breakdown?.reduce((acc: any, item: any) => {
    const courseId = item.course_id;
    if (!acc[courseId]) {
      acc[courseId] = {
        course_nom: item.course_nom,
        date_debut: item.date_debut,
        date_fin: item.date_fin,
        points: []
      };
    }
    acc[courseId].points.push(item);
    return acc;
  }, {} as Record<string, any>);

  const courses = Object.values(groupedByCourse || {}).sort((a: any, b: any) => {
    const dateA = new Date(a.date_debut || a.date_fin || 0);
    const dateB = new Date(b.date_debut || b.date_fin || 0);
    return dateB.getTime() - dateA.getTime();
  });

  const totalPoints = breakdown?.reduce((sum: number, item: any) => sum + item.points, 0) || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const managerName = breakdown?.[0]?.manager_nom || "Manager";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {t('breakdown.details', { name: managerName })}
          </CardTitle>
          <Badge variant="default" className="text-lg px-4 py-1">
            {t('breakdown.total', { points: totalPoints })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {courses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t('breakdown.noData')}
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {courses.map((course: any, courseIdx: number) => {
              const courseTotal = course.points.reduce((sum: number, p: any) => sum + p.points, 0);
              
              return (
                <AccordionItem key={courseIdx} value={`course-${courseIdx}`} className="border rounded-lg">
                  <AccordionTrigger className="hover:no-underline px-3 py-3">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold text-sm">{course.course_nom}</h3>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Calendar className="h-3 w-3" />
                          {course.date_debut && format(new Date(course.date_debut), "dd MMM yyyy", { locale: dateLocale })}
                        </div>
                      </div>
                      <Badge variant="default" className="px-3 py-1">
                        {courseTotal} pts
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent>
                    <div className="ml-4 mr-3 space-y-1 pt-2 pb-2">
                      {course.points.map((item: any, idx: number) => {
                        const typeLabel = item.type_classement;
                        const etapeInfo = item.etape_numero > 0 ? ` #${item.etape_numero}` : "";
                        const tttKey = `${item.course_id}_${item.type_classement}_${item.etape_numero || 'null'}`;
                        const isTtt = tttMap.get(tttKey) || false;
                        
                        return (
                          <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                            <div className="flex items-center gap-3 flex-1">
                              <Badge variant="outline" className="text-xs shrink-0">
                                {typeLabel}{etapeInfo}
                              </Badge>
                              {isTtt && (
                                <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-300 shrink-0">
                                  TTT
                                </Badge>
                              )}
                              <span className="text-sm">{item.coureur_nom}</span>
                            </div>
                            <Badge variant={item.points > 0 ? "secondary" : "outline"} className="text-xs">
                              {item.points} pts
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};
