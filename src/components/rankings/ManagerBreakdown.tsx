import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Calendar } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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

  const totalPoints = breakdown?.reduce((sum, item) => sum + item.points, 0) || 0;

  // Regrouper les points par course
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

  const courses = Object.values(groupedByCourse || {});

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
            <FileText className="h-5 w-5" />
            Détails - {managerName}
          </CardTitle>
          <Badge variant="default" className="text-lg px-4 py-1">
            Total: {totalPoints} pts
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {courses.length > 0 ? (
          <div className="space-y-6">
            {courses.map((course: any) => {
              const courseTotal = course.points.reduce((sum: number, p: any) => sum + p.points, 0);
              return (
                <div key={course.course_nom} className="space-y-2">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">{course.course_nom}</h3>
                      {course.date_debut && (
                        <span className="text-xs text-muted-foreground">
                          ({format(new Date(course.date_debut), "dd MMM", { locale: fr })})
                        </span>
                      )}
                    </div>
                    <Badge variant="default" className="px-3">
                      {courseTotal} pts
                    </Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Coureur</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {course.points.map((item: any, idx: number) => {
                        const typeLabel = item.type_classement;
                        const etapeInfo = item.etape_numero > 0 ? ` #${item.etape_numero}` : "";
                        
                        return (
                          <TableRow key={idx}>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {typeLabel}{etapeInfo}
                              </Badge>
                            </TableCell>
                            <TableCell>{item.coureur_nom}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={item.points > 0 ? "default" : "secondary"}>
                                {item.points} pts
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Aucune donnée disponible
          </div>
        )}
      </CardContent>
    </Card>
  );
};
