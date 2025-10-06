import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Laugh, Frown, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

type RankingsKPIsProps = {
  phaseId?: string | null;
};

type AwardType = 'funniest' | 'grumpiest' | 'luckiest';

export const RankingsKPIs = ({ phaseId }: RankingsKPIsProps) => {
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();

  // Fetch all managers
  const { data: managers } = useQuery({
    queryKey: ["managers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("managers")
        .select("id, nom")
        .order("nom");
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch fun awards
  const { data: awards, isLoading } = useQuery({
    queryKey: ["fun-awards", phaseId],
    queryFn: async () => {
      let query = supabase
        .from("manager_fun_awards")
        .select(`
          id,
          award_type,
          manager_id,
          managers!manager_fun_awards_manager_id_fkey(nom)
        `);

      if (phaseId) {
        query = query.eq("phase_id", phaseId);
      } else {
        query = query.is("phase_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data?.reduce((acc, award: any) => {
        acc[award.award_type as AwardType] = {
          managerId: award.manager_id,
          managerName: award.managers?.nom || "Unknown",
        };
        return acc;
      }, {} as Record<AwardType, { managerId: string; managerName: string }>);
    },
  });

  // Update award mutation
  const updateAward = useMutation({
    mutationFn: async ({ awardType, managerId }: { awardType: AwardType; managerId: string | null }) => {
      // Get current user's manager ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: manager } = await supabase
        .from("managers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!manager) throw new Error("Manager not found");

      if (managerId === null) {
        // Delete award
        let deleteQuery = supabase
          .from("manager_fun_awards")
          .delete()
          .eq("award_type", awardType);
        
        if (phaseId) {
          deleteQuery = deleteQuery.eq("phase_id", phaseId);
        } else {
          deleteQuery = deleteQuery.is("phase_id", null);
        }
        
        const { error } = await deleteQuery;
        if (error) throw error;
      } else {
        // Upsert award
        const { error } = await supabase
          .from("manager_fun_awards")
          .upsert({
            phase_id: phaseId || null,
            award_type: awardType,
            manager_id: managerId,
            assigned_by: manager.id,
          }, {
            onConflict: 'phase_id,award_type',
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fun-awards", phaseId] });
      toast.success("Attribution mise à jour");
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const kpis = [
    {
      type: 'funniest' as AwardType,
      label: "Le plus drôle",
      icon: Laugh,
      color: "text-yellow-500",
    },
    {
      type: 'grumpiest' as AwardType,
      label: "Le plus boudeur",
      icon: Frown,
      color: "text-blue-500",
    },
    {
      type: 'luckiest' as AwardType,
      label: "Le plus chattard",
      icon: Sparkles,
      color: "text-purple-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {kpis.map((kpi) => {
        const award = awards?.[kpi.type];
        
        return (
          <Card key={kpi.type}>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                  <h3 className="font-semibold">{kpi.label}</h3>
                </div>
                
                <p className="text-2xl font-bold">
                  {award?.managerName || (
                    <span className="text-muted-foreground text-lg">Non attribué</span>
                  )}
                </p>
                
                {isAdmin && (
                  <Select
                    value={award?.managerId || "none"}
                    onValueChange={(value) => {
                      updateAward.mutate({
                        awardType: kpi.type,
                        managerId: value === "none" ? null : value,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {managers?.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
