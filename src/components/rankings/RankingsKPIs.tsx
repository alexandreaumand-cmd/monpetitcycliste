import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { useLeague } from "@/contexts/LeagueContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type RankingsKPIsProps = {
  phaseId?: string | null;
};

type AwardType = 'funniest' | 'grumpiest' | 'luckiest';

export const RankingsKPIs = ({ phaseId }: RankingsKPIsProps) => {
  const { isSuperAdmin } = useUserRole();
  const { leagueId } = useLeague();
  const queryClient = useQueryClient();

  // Fetch managers from current league
  const { data: managers } = useQuery({
    queryKey: ["league-managers", leagueId],
    queryFn: async () => {
      if (!leagueId) return [];

      // First get user_ids from league_members
      const { data: members, error: membersError } = await supabase
        .from("league_members")
        .select("user_id")
        .eq("league_id", leagueId);
      
      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];

      // Then get managers for those user_ids
      const userIds = members.map(m => m.user_id);
      const { data: managersData, error: managersError } = await supabase
        .from("managers")
        .select("id, nom")
        .in("user_id", userIds)
        .order("nom");
      
      if (managersError) throw managersError;
      return managersData || [];
    },
  });

  // Fetch fun awards
  const { data: awards, isLoading } = useQuery({
    queryKey: ["fun-awards", phaseId, leagueId],
    queryFn: async () => {
      if (!leagueId) return {};

      let query = supabase
        .from("manager_fun_awards")
        .select(`
          id,
          award_type,
          manager_id,
          managers!manager_fun_awards_manager_id_fkey(nom)
        `)
        .eq("league_id", leagueId);

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
      if (!leagueId) throw new Error("No league selected");

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
          .eq("award_type", awardType)
          .eq("league_id", leagueId);
        
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
            league_id: leagueId,
            phase_id: phaseId || null,
            award_type: awardType,
            manager_id: managerId,
            assigned_by: manager.id,
          }, {
            onConflict: 'league_id,phase_id,award_type',
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fun-awards", phaseId, leagueId] });
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
      emoji: "😂",
      gradient: "from-yellow-100 via-yellow-50 to-white dark:from-yellow-900/30 dark:via-yellow-800/20 dark:to-transparent",
      borderColor: "border-yellow-400",
      shadowColor: "shadow-yellow-200 dark:shadow-yellow-900/50",
    },
    {
      type: 'grumpiest' as AwardType,
      label: "Le plus boudeur",
      emoji: "😤",
      gradient: "from-blue-100 via-blue-50 to-white dark:from-blue-900/30 dark:via-blue-800/20 dark:to-transparent",
      borderColor: "border-blue-400",
      shadowColor: "shadow-blue-200 dark:shadow-blue-900/50",
    },
    {
      type: 'luckiest' as AwardType,
      label: "Le plus chattard",
      emoji: "🍀",
      gradient: "from-green-100 via-green-50 to-white dark:from-green-900/30 dark:via-green-800/20 dark:to-transparent",
      borderColor: "border-green-400",
      shadowColor: "shadow-green-200 dark:shadow-green-900/50",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {kpis.map((kpi) => {
        const award = awards?.[kpi.type];
        
        return (
          <Card 
            key={kpi.type}
            className={cn(
              "border-2 transition-all duration-300",
              kpi.borderColor,
              "hover:shadow-lg",
              kpi.shadowColor
            )}
          >
            <CardContent className={cn(
              "p-6 bg-gradient-to-br",
              kpi.gradient
            )}>
              <div className="space-y-4">
                {/* En-tête avec emoji géant */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-5xl">{kpi.emoji}</div>
                    <h3 className="font-bold text-base">{kpi.label}</h3>
                  </div>
                </div>
                
                {/* Nom du manager */}
                {isSuperAdmin ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <div className="cursor-pointer hover:scale-105 transition-transform">
                        {award?.managerName ? (
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border-2 border-[#FFD500] shadow-md">
                            <p className="text-xl font-bold text-center">
                              {award.managerName}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 border-2 border-dashed border-gray-300">
                            <p className="text-sm text-muted-foreground text-center italic">
                              Cliquer pour attribuer
                            </p>
                          </div>
                        )}
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-64">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm mb-2">Choisir un manager</h4>
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => updateAward.mutate({ awardType: kpi.type, managerId: null })}
                          >
                            Aucun
                          </Button>
                          {managers?.map((m) => (
                            <Button
                              key={m.id}
                              variant="ghost"
                              className="w-full justify-start"
                              onClick={() => updateAward.mutate({ awardType: kpi.type, managerId: m.id })}
                            >
                              {m.nom}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <>
                    {award?.managerName ? (
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border-2 border-[#FFD500] shadow-md">
                        <p className="text-xl font-bold text-center">
                          {award.managerName}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 border-2 border-dashed border-gray-300">
                        <p className="text-sm text-muted-foreground text-center italic">
                          Non attribué
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
