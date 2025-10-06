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
      <div className="flex gap-3 justify-center items-center flex-wrap">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-48" />
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
    <div className="flex gap-3 justify-center items-center flex-wrap">
      {kpis.map((kpi) => (
        <div 
          key={kpi.label} 
          className="flex items-center gap-3 px-5 py-3 rounded-lg bg-card border shadow-sm hover:shadow-md transition-shadow"
        >
          <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
          <div>
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="text-xl font-bold">{kpi.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
