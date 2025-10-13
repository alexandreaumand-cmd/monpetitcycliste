import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type ManagerBreakdownProps = {
  managerId: string;
  phaseId?: string | null;
};

export const ManagerBreakdown = ({ managerId, phaseId }: ManagerBreakdownProps) => {
  const { data: breakdown, isLoading } = useQuery({
    queryKey: ["manager-breakdown", managerId, phaseId],
    queryFn: async () => {
      let query = supabase
        .from("v_manager_breakdown")
        .select("*")
        .eq("manager_id", managerId);
      
      if (phaseId) {
        query = query.eq("phase_id", phaseId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Grouper les points par course
  const groupedByCourse = breakdown?.reduce((acc, item) => {
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

  const courses = Object.values(groupedByCourse || {}).sort((a, b) => {
    const dateA = new Date(a.date_debut || a.date_fin || 0);
    const dateB = new Date(b.date_debut || b.date_fin || 0);
    return dateB.getTime() - dateA.getTime();
  });

  const totalPoints = breakdown?.reduce((sum, item) => sum + item.points, 0) || 0;

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
            Détails - {managerName}
          </CardTitle>
          <Badge variant="default" className="text-lg px-4 py-1">
            Total: {totalPoints} pts
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {courses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Aucune donnée disponible
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {courses.map((course, courseIdx) => {
              const courseTotal = course.points.reduce((sum: number, p: any) => sum + p.points, 0);
              
              return (
                <AccordionItem key={courseIdx} value={`course-${courseIdx}`} className="border rounded-lg">
                  <AccordionTrigger className="hover:no-underline px-3 py-3">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold text-sm">{course.course_nom}</h3>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Calendar className="h-3 w-3" />
                          {course.date_debut && format(new Date(course.date_debut), "dd MMM yyyy", { locale: fr })}
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
                        
                        return (
                          <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                            <div className="flex items-center gap-3 flex-1">
                              <Badge variant="outline" className="text-xs shrink-0">
                                {typeLabel}{etapeInfo}
                              </Badge>
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
