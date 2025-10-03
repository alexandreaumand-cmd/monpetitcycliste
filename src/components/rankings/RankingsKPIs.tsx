import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Award, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type RankingsKPIsProps = {
  phaseId?: string | null;
};

export const RankingsKPIs = ({ phaseId }: RankingsKPIsProps) => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["rankings-kpis", phaseId],
    queryFn: async () => {
      const { data: ledgerData, error: ledgerError } = await supabase
        .from("points_ledger")
        .select("points, course_id")
        .eq(phaseId ? "phase_id" : "id", phaseId || "");

      if (ledgerError && phaseId) throw ledgerError;

      const totalPoints = ledgerData?.reduce((sum, item) => sum + item.points, 0) || 0;
      const uniqueCourses = new Set(ledgerData?.map(item => item.course_id) || []).size;
      const avgPerCourse = uniqueCourses > 0 ? Math.round(totalPoints / uniqueCourses) : 0;

      return {
        totalPoints,
        coursesCount: uniqueCourses,
        avgPerCourse,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const kpis = [
    {
      label: "Total de points",
      value: stats?.totalPoints.toLocaleString() || "0",
      icon: TrendingUp,
      color: "text-primary",
    },
    {
      label: "Moyenne / course",
      value: stats?.avgPerCourse.toLocaleString() || "0",
      icon: Award,
      color: "text-secondary",
    },
    {
      label: "Courses scorées",
      value: stats?.coursesCount.toLocaleString() || "0",
      icon: Calendar,
      color: "text-accent",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{kpi.label}</p>
                <p className="text-3xl font-bold">{kpi.value}</p>
              </div>
              <kpi.icon className={`h-10 w-10 ${kpi.color}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
