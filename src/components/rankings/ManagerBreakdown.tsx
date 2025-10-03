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
};

export const ManagerBreakdown = ({ managerId }: ManagerBreakdownProps) => {
  const { data: breakdown, isLoading } = useQuery({
    queryKey: ["manager-breakdown", managerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_manager_breakdown")
        .select("*")
        .eq("manager_id", managerId);
      
      if (error) throw error;
      return data;
    },
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
            <FileText className="h-5 w-5" />
            Détails - {managerName}
          </CardTitle>
          <Badge variant="default" className="text-lg px-4 py-1">
            Total: {totalPoints} pts
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Coureur</TableHead>
              <TableHead className="text-right">Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {breakdown?.map((item, idx) => {
              const typeLabel = item.type_classement;
              const etapeInfo = item.etape_numero > 0 ? ` #${item.etape_numero}` : "";
              
              return (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{item.course_nom}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {item.date_debut && format(new Date(item.date_debut), "dd MMM", { locale: fr })}
                    </div>
                  </TableCell>
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
        {!breakdown || breakdown.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Aucune donnée disponible
          </div>
        )}
      </CardContent>
    </Card>
  );
};
