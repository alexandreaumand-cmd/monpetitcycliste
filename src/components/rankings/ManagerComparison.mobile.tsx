import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MobileCard } from "@/components/mobile/MobileCard";
import { MobileEmptyState } from "@/components/mobile/MobileEmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, Users, TrendingUp, Target } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, ResponsiveContainer } from "recharts";
import { useLeague } from "@/contexts/LeagueContext";
import { ManagerSelect } from "@/components/shared/ManagerSelect";

interface ManagerComparisonMobileProps {
  phaseId: string | null;
  saisonId: string | null;
}

export const ManagerComparisonMobile = ({ phaseId, saisonId }: ManagerComparisonMobileProps) => {
  const [managerA, setManagerA] = useState<string>("");
  const [managerB, setManagerB] = useState<string>("");
  const { leagueId } = useLeague();

  // Récupérer les noms des managers sélectionnés
  const { data: selectedManagers } = useQuery({
    queryKey: ["selected-managers", managerA, managerB],
    queryFn: async () => {
      const ids = [managerA, managerB].filter(Boolean);
      if (ids.length === 0) return [];
      
      const { data, error } = await supabase
        .from("managers")
        .select("id, nom")
        .in("id", ids);
      
      if (error) throw error;
      return data;
    },
    enabled: !!(managerA || managerB),
  });

  // Fetch rosters for manager A
  const { data: rostersA } = useQuery({
    queryKey: ["rosters-a", managerA, phaseId, saisonId, leagueId],
    queryFn: async () => {
      if (!managerA) return null;

      let query = supabase
        .from("rosters")
        .select(`
          coureur_id,
          prix_signature,
          coureurs (nom, equipe)
        `)
        .eq("manager_id", managerA);

      if (leagueId) {
        query = query.eq("league_id", leagueId);
      }

      if (phaseId) {
        query = query.eq("phase_id", phaseId);
      } else if (saisonId) {
        const { data: phases } = await supabase
          .from("phases")
          .select("id")
          .eq("saison_id", saisonId);
        
        if (phases) {
          const phaseIds = phases.map(p => p.id);
          query = query.in("phase_id", phaseIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!managerA,
  });

  // Fetch rosters for manager B
  const { data: rostersB } = useQuery({
    queryKey: ["rosters-b", managerB, phaseId, saisonId, leagueId],
    queryFn: async () => {
      if (!managerB) return null;

      let query = supabase
        .from("rosters")
        .select(`
          coureur_id,
          prix_signature,
          coureurs (nom, equipe)
        `)
        .eq("manager_id", managerB);

      if (leagueId) {
        query = query.eq("league_id", leagueId);
      }

      if (phaseId) {
        query = query.eq("phase_id", phaseId);
      } else if (saisonId) {
        const { data: phases } = await supabase
          .from("phases")
          .select("id")
          .eq("saison_id", saisonId);
        
        if (phases) {
          const phaseIds = phases.map(p => p.id);
          query = query.in("phase_id", phaseIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!managerB,
  });

  // Fetch points for manager A
  const { data: pointsA } = useQuery({
    queryKey: ["points-manager-a", managerA, phaseId, saisonId, rostersA],
    queryFn: async () => {
      if (!managerA || !rostersA) return null;

      const coureurIds = rostersA.map(r => r.coureur_id);

    let query = supabase
      .from("points_ledger")
      .select("coureur_id, points, type_classement, course_id, phase_id")
      .in("coureur_id", coureurIds);

      if (phaseId) {
        query = query.eq("phase_id", phaseId);
      } else if (saisonId) {
        const { data: phases } = await supabase
          .from("phases")
          .select("id")
          .eq("saison_id", saisonId);
        
        if (phases) {
          const phaseIds = phases.map(p => p.id);
          query = query.in("phase_id", phaseIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!managerA && !!rostersA,
  });

  // Fetch points for manager B
  const { data: pointsB } = useQuery({
    queryKey: ["points-manager-b", managerB, phaseId, saisonId, rostersB],
    queryFn: async () => {
      if (!managerB || !rostersB) return null;

      const coureurIds = rostersB.map(r => r.coureur_id);

    let query = supabase
      .from("points_ledger")
      .select("coureur_id, points, type_classement, course_id, phase_id")
      .in("coureur_id", coureurIds);

      if (phaseId) {
        query = query.eq("phase_id", phaseId);
      } else if (saisonId) {
        const { data: phases } = await supabase
          .from("phases")
          .select("id")
          .eq("saison_id", saisonId);
        
        if (phases) {
          const phaseIds = phases.map(p => p.id);
          query = query.in("phase_id", phaseIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!managerB && !!rostersB,
  });

  // Fetch bonus_points for manager A
  const { data: bonusPointsA } = useQuery({
    queryKey: ["bonus-points-a", managerA, phaseId, saisonId],
    queryFn: async () => {
      if (!managerA) return null;

      let query = supabase
        .from("bonus_points")
        .select("points")
        .or(`target_manager_id.eq.${managerA},manager_id.eq.${managerA}`);

      if (phaseId) {
        query = query.eq("phase_id", phaseId);
      } else if (saisonId) {
        const { data: phases } = await supabase
          .from("phases")
          .select("id")
          .eq("saison_id", saisonId);
        
        if (phases) {
          query = query.in("phase_id", phases.map(p => p.id));
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!managerA,
  });

  // Fetch bonus_points for manager B
  const { data: bonusPointsB } = useQuery({
    queryKey: ["bonus-points-b", managerB, phaseId, saisonId],
    queryFn: async () => {
      if (!managerB) return null;

      let query = supabase
        .from("bonus_points")
        .select("points")
        .or(`target_manager_id.eq.${managerB},manager_id.eq.${managerB}`);

      if (phaseId) {
        query = query.eq("phase_id", phaseId);
      } else if (saisonId) {
        const { data: phases } = await supabase
          .from("phases")
          .select("id")
          .eq("saison_id", saisonId);
        
        if (phases) {
          query = query.in("phase_id", phases.map(p => p.id));
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!managerB,
  });

  // Fetch manager_bonus_points for manager A
  const { data: managerBonusA } = useQuery({
    queryKey: ["manager-bonus-a", managerA, phaseId, saisonId],
    queryFn: async () => {
      if (!managerA) return null;

      let query = supabase
        .from("manager_bonus_points")
        .select("bonus_itt, bonus_ttt, bonus_first_win, bonus_coureurs, bonus_scoreurs")
        .eq("manager_id", managerA);

      if (phaseId) {
        query = query.eq("phase_id", phaseId);
      } else if (saisonId) {
        const { data: phases } = await supabase
          .from("phases")
          .select("id")
          .eq("saison_id", saisonId);
        
        if (phases) {
          query = query.in("phase_id", phases.map(p => p.id));
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!managerA,
  });

  // Fetch manager_bonus_points for manager B
  const { data: managerBonusB } = useQuery({
    queryKey: ["manager-bonus-b", managerB, phaseId, saisonId],
    queryFn: async () => {
      if (!managerB) return null;

      let query = supabase
        .from("manager_bonus_points")
        .select("bonus_itt, bonus_ttt, bonus_first_win, bonus_coureurs, bonus_scoreurs")
        .eq("manager_id", managerB);

      if (phaseId) {
        query = query.eq("phase_id", phaseId);
      } else if (saisonId) {
        const { data: phases } = await supabase
          .from("phases")
          .select("id")
          .eq("saison_id", saisonId);
        
        if (phases) {
          query = query.in("phase_id", phases.map(p => p.id));
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!managerB,
  });

  // Fetch courses
  const { data: courses } = useQuery({
    queryKey: ["courses-comparison", phaseId, saisonId],
    queryFn: async () => {
      let query = supabase
        .from("courses")
        .select("id, nom, type_course, categorie");

      if (phaseId) {
        query = query.eq("phase_id", phaseId);
      } else if (saisonId) {
        const { data: phases } = await supabase
          .from("phases")
          .select("id")
          .eq("saison_id", saisonId);
        
        if (phases) {
          const phaseIds = phases.map(p => p.id);
          query = query.in("phase_id", phaseIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch victories for manager A - CORRIGÉ: avec jointure rosters
  const { data: victoriesA } = useQuery({
    queryKey: ["victories-a", managerA, phaseId, saisonId],
    queryFn: async () => {
      if (!managerA) return null;

      // Récupérer les phase_ids concernés
      let phaseIds: string[] = [];
      if (phaseId) {
        phaseIds = [phaseId];
      } else if (saisonId) {
        const { data: phases } = await supabase
          .from("phases")
          .select("id")
          .eq("saison_id", saisonId);
        phaseIds = phases?.map(p => p.id) || [];
      }

      // Récupérer les victoires avec courses
      const { data: victories, error } = await supabase
        .from("race_results")
        .select(`
          id, 
          coureur_id, 
          course_id,
          courses!inner(phase_id)
        `)
        .eq("position", 1)
        .eq("statut", "finished")
        .in("type_classement", ["Etape", "General"]);

      if (error) throw error;

      // Récupérer tous les rosters du manager
      let rostersQuery = supabase
        .from("rosters")
        .select("coureur_id, phase_id")
        .eq("manager_id", managerA);

      if (phaseIds.length > 0) {
        rostersQuery = rostersQuery.in("phase_id", phaseIds);
      }

      const { data: rostersData, error: rostersError } = await rostersQuery;
      if (rostersError) throw rostersError;

      // Map coureur -> phases
      const rostersByRider = new Map<string, Set<string>>();
      rostersData?.forEach(r => {
        if (!rostersByRider.has(r.coureur_id)) {
          rostersByRider.set(r.coureur_id, new Set());
        }
        rostersByRider.get(r.coureur_id)!.add(r.phase_id);
      });

      // Filtrer victoires
      const filtered = victories?.filter(v => {
        const coursePhaseId = v.courses?.phase_id;
        if (!coursePhaseId) return false;
        
        const riderPhases = rostersByRider.get(v.coureur_id);
        if (!riderPhases) return false;
        
        return riderPhases.has(coursePhaseId) && 
               (phaseIds.length === 0 || phaseIds.includes(coursePhaseId));
      }) || [];

      return filtered;
    },
    enabled: !!managerA,
  });

  // Fetch victories for manager B - CORRIGÉ: avec jointure rosters
  const { data: victoriesB } = useQuery({
    queryKey: ["victories-b", managerB, phaseId, saisonId],
    queryFn: async () => {
      if (!managerB) return null;

      // Récupérer les phase_ids concernés
      let phaseIds: string[] = [];
      if (phaseId) {
        phaseIds = [phaseId];
      } else if (saisonId) {
        const { data: phases } = await supabase
          .from("phases")
          .select("id")
          .eq("saison_id", saisonId);
        phaseIds = phases?.map(p => p.id) || [];
      }

      // Récupérer les victoires avec courses
      const { data: victories, error } = await supabase
        .from("race_results")
        .select(`
          id, 
          coureur_id, 
          course_id,
          courses!inner(phase_id)
        `)
        .eq("position", 1)
        .eq("statut", "finished")
        .in("type_classement", ["Etape", "General"]);

      if (error) throw error;

      // Récupérer tous les rosters du manager
      let rostersQuery = supabase
        .from("rosters")
        .select("coureur_id, phase_id")
        .eq("manager_id", managerB);

      if (phaseIds.length > 0) {
        rostersQuery = rostersQuery.in("phase_id", phaseIds);
      }

      const { data: rostersData, error: rostersError } = await rostersQuery;
      if (rostersError) throw rostersError;

      // Map coureur -> phases
      const rostersByRider = new Map<string, Set<string>>();
      rostersData?.forEach(r => {
        if (!rostersByRider.has(r.coureur_id)) {
          rostersByRider.set(r.coureur_id, new Set());
        }
        rostersByRider.get(r.coureur_id)!.add(r.phase_id);
      });

      // Filtrer victoires
      const filtered = victories?.filter(v => {
        const coursePhaseId = v.courses?.phase_id;
        if (!coursePhaseId) return false;
        
        const riderPhases = rostersByRider.get(v.coureur_id);
        if (!riderPhases) return false;
        
        return riderPhases.has(coursePhaseId) && 
               (phaseIds.length === 0 || phaseIds.includes(coursePhaseId));
      }) || [];

      return filtered;
    },
    enabled: !!managerB,
  });

  // Fetch coureurs details with season team
  const { data: coureurs } = useQuery({
    queryKey: ["coureurs-all-comparison", saisonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coureurs")
        .select("id, nom");
      if (error) throw error;

      // Enrichir avec l'équipe de la saison si disponible
      if (!saisonId) {
        return (data || []).map(c => ({ ...c, equipe: 'N/A' as string }));
      }

      const enrichedData = await Promise.all(
        (data || []).map(async (coureur) => {
          const { data: seasonData } = await supabase
            .from('coureurs_saisons')
            .select('equipe')
            .eq('coureur_id', coureur.id)
            .eq('saison_id', saisonId)
            .maybeSingle();

          return {
            ...coureur,
            equipe: seasonData?.equipe || 'N/A' as string
          };
        })
      );

      return enrichedData;
    },
  });

  // Calculate metrics - CORRIGÉ: ajouter bonus
  const totalPointsA = useMemo(() => {
    const racePts = pointsA?.reduce((sum, p) => sum + (p.points || 0), 0) || 0;
    const bonusPts = bonusPointsA?.reduce((sum, b) => sum + (b.points || 0), 0) || 0;
    const mgrBonus = managerBonusA?.reduce((sum, mb) => 
      sum + (mb.bonus_itt || 0) + (mb.bonus_ttt || 0) + 
      (mb.bonus_first_win || 0) + (mb.bonus_coureurs || 0) + 
      (mb.bonus_scoreurs || 0), 0) || 0;
    return racePts + bonusPts + mgrBonus;
  }, [pointsA, bonusPointsA, managerBonusA]);

  const totalPointsB = useMemo(() => {
    const racePts = pointsB?.reduce((sum, p) => sum + (p.points || 0), 0) || 0;
    const bonusPts = bonusPointsB?.reduce((sum, b) => sum + (b.points || 0), 0) || 0;
    const mgrBonus = managerBonusB?.reduce((sum, mb) => 
      sum + (mb.bonus_itt || 0) + (mb.bonus_ttt || 0) + 
      (mb.bonus_first_win || 0) + (mb.bonus_coureurs || 0) + 
      (mb.bonus_scoreurs || 0), 0) || 0;
    return racePts + bonusPts + mgrBonus;
  }, [pointsB, bonusPointsB, managerBonusB]);

  const scoreursA = useMemo(() => {
    if (!pointsA) return 0;
    return new Set(
      pointsA
        .filter(p => (p.points || 0) > 0)
        .map(p => `${p.coureur_id}|${p.phase_id}`)
    ).size;
  }, [pointsA]);

  const scoreursB = useMemo(() => {
    if (!pointsB) return 0;
    return new Set(
      pointsB
        .filter(p => (p.points || 0) > 0)
        .map(p => `${p.coureur_id}|${p.phase_id}`)
    ).size;
  }, [pointsB]);

  const budgetA = useMemo(() => {
    if (!rostersA) return 0;
    return rostersA.reduce((sum, r) => sum + (r.prix_signature || 0), 0);
  }, [rostersA]);

  const budgetB = useMemo(() => {
    if (!rostersB) return 0;
    return rostersB.reduce((sum, r) => sum + (r.prix_signature || 0), 0);
  }, [rostersB]);

  const roiA = budgetA > 0 ? totalPointsA / budgetA : 0;
  const roiB = budgetB > 0 ? totalPointsB / budgetB : 0;

  const victoiresA = victoriesA?.length || 0;
  const victoiresB = victoriesB?.length || 0;

  // Points by category
  const categoriesConfig = [
    { key: "ONE_DAY", label: "Courses d'un jour", filterCourse: (c: any) => c.type_course === "One-day race" },
    { key: "ETAPES", label: "Courses par étapes", filterType: (typeClass: string) => typeClass === "Etape" },
    { key: "GC", label: "CG", filterType: (typeClass: string) => typeClass === "GC" },
    { key: "POINTS", label: "Points", filterType: (typeClass: string) => typeClass === "Points" },
    { key: "MOUNTAIN", label: "Montagne", filterType: (typeClass: string) => typeClass === "Mountain" },
    { key: "YOUTH", label: "Jeunes", filterType: (typeClass: string) => typeClass === "Youth" },
    { key: "PORTEUR", label: "Porteur", filterType: (typeClass: string) => typeClass === "Porteur" },
  ];

  const coursesMap = useMemo(() => {
    if (!courses) return new Map();
    return new Map(courses.map(c => [c.id, c]));
  }, [courses]);

  const pointsByCategory = useMemo(() => {
    if (!pointsA || !pointsB || !courses) return [];

    return categoriesConfig.map(cat => {
      let ptsA = 0;
      let ptsB = 0;

      if (cat.filterCourse) {
        ptsA = pointsA.filter(p => {
          const course = coursesMap.get(p.course_id);
          return course && cat.filterCourse(course);
        }).reduce((sum, p) => sum + (p.points || 0), 0);

        ptsB = pointsB.filter(p => {
          const course = coursesMap.get(p.course_id);
          return course && cat.filterCourse(course);
        }).reduce((sum, p) => sum + (p.points || 0), 0);
      } else if (cat.filterType) {
        ptsA = pointsA.filter(p => cat.filterType(p.type_classement)).reduce((sum, p) => sum + (p.points || 0), 0);
        ptsB = pointsB.filter(p => cat.filterType(p.type_classement)).reduce((sum, p) => sum + (p.points || 0), 0);
      }

      return {
        category: cat.label,
        managerA: ptsA,
        managerB: ptsB,
      };
    });
  }, [pointsA, pointsB, courses, coursesMap]);

  // Top scorers
  const topScorersA = useMemo(() => {
    if (!rostersA || !pointsA || !coureurs) return [];

    const coureurPoints = new Map<string, number>();
    const rosterCoureurIds = new Set(rostersA.map(r => r.coureur_id));

    pointsA.forEach(p => {
      if (rosterCoureurIds.has(p.coureur_id)) {
        const current = coureurPoints.get(p.coureur_id) || 0;
        coureurPoints.set(p.coureur_id, current + (p.points || 0));
      }
    });

    return Array.from(coureurPoints.entries())
      .map(([coureurId, points]) => {
        const coureur = coureurs.find(c => c.id === coureurId);
        const roster = rostersA.find(r => r.coureur_id === coureurId);
        return {
          coureur_id: coureurId,
          nom: coureur?.nom || "",
          equipe: coureur?.equipe || "",
          points,
          prix: roster?.prix_signature || 0,
          ratio: roster?.prix_signature ? points / roster.prix_signature : 0,
        };
      })
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);
  }, [rostersA, pointsA, coureurs]);

  const topScorersB = useMemo(() => {
    if (!rostersB || !pointsB || !coureurs) return [];

    const coureurPoints = new Map<string, number>();
    const rosterCoureurIds = new Set(rostersB.map(r => r.coureur_id));

    pointsB.forEach(p => {
      if (rosterCoureurIds.has(p.coureur_id)) {
        const current = coureurPoints.get(p.coureur_id) || 0;
        coureurPoints.set(p.coureur_id, current + (p.points || 0));
      }
    });

    return Array.from(coureurPoints.entries())
      .map(([coureurId, points]) => {
        const coureur = coureurs.find(c => c.id === coureurId);
        const roster = rostersB.find(r => r.coureur_id === coureurId);
        return {
          coureur_id: coureurId,
          nom: coureur?.nom || "",
          equipe: coureur?.equipe || "",
          points,
          prix: roster?.prix_signature || 0,
          ratio: roster?.prix_signature ? points / roster.prix_signature : 0,
        };
      })
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);
  }, [rostersB, pointsB, coureurs]);

  const managerAName = selectedManagers?.find(m => m.id === managerA)?.nom || "Manager A";
  const managerBName = selectedManagers?.find(m => m.id === managerB)?.nom || "Manager B";

  if (!managerA || !managerB) {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <div>
            <Label htmlFor="manager-a" className="text-xs text-muted-foreground mb-2 block">
              Manager A
            </Label>
            <ManagerSelect 
              value={managerA} 
              onValueChange={setManagerA}
              placeholder="Sélectionner un manager"
              leagueId={leagueId}
            />
          </div>

          <div>
            <Label htmlFor="manager-b" className="text-xs text-muted-foreground mb-2 block">
              Manager B
            </Label>
            <ManagerSelect 
              value={managerB} 
              onValueChange={setManagerB}
              placeholder="Sélectionner un manager"
              leagueId={leagueId}
            />
          </div>
        </div>

        <MobileEmptyState
          icon={<Users className="h-12 w-12" />}
          title="Comparer deux managers"
          description="Sélectionnez deux managers pour voir leur comparaison détaillée"
        />
      </div>
    );
  }

  const isLoading = !pointsA || !pointsB || !rostersA || !rostersB;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const ComparisonMetricCard = ({
    icon: Icon,
    label,
    valueA,
    valueB,
    suffix = "",
    decimal = 0,
  }: {
    icon: any;
    label: string;
    valueA: number;
    valueB: number;
    suffix?: string;
    decimal?: number;
  }) => {
    const diff = valueA - valueB;
    const formatValue = (v: number) => decimal > 0 ? v.toFixed(decimal) : v.toString();

    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{managerAName}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-primary">{formatValue(valueA)}</span>
                <span className="text-xs text-muted-foreground">{suffix}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{managerBName}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-destructive">{formatValue(valueB)}</span>
                <span className="text-xs text-muted-foreground">{suffix}</span>
              </div>
            </div>

            {diff !== 0 && (
              <div className="pt-2 border-t">
                <Badge variant={diff > 0 ? "default" : "destructive"} className="w-full justify-center text-xs">
                  {diff > 0 ? `+${formatValue(Math.abs(diff))}` : formatValue(diff)} {suffix}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Manager Selection */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="manager-a-selected" className="text-xs text-muted-foreground mb-2 block">
            Manager A
          </Label>
          <ManagerSelect 
            value={managerA} 
            onValueChange={setManagerA}
            placeholder="Manager A"
            leagueId={leagueId}
          />
        </div>

        <div>
          <Label htmlFor="manager-b-selected" className="text-xs text-muted-foreground mb-2 block">
            Manager B
          </Label>
          <ManagerSelect 
            value={managerB} 
            onValueChange={setManagerB}
            placeholder="Manager B"
            leagueId={leagueId}
          />
        </div>
      </div>

      {/* Global Metrics */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Métriques globales</h3>
        <ComparisonMetricCard
          icon={Trophy}
          label="Total Points"
          valueA={totalPointsA}
          valueB={totalPointsB}
          suffix="pts"
        />
        <ComparisonMetricCard
          icon={Users}
          label="Nombre de scoreurs"
          valueA={scoreursA}
          valueB={scoreursB}
        />
        <ComparisonMetricCard
          icon={TrendingUp}
          label="ROI moyen"
          valueA={roiA}
          valueB={roiB}
          decimal={2}
        />
        <ComparisonMetricCard
          icon={Target}
          label="Nombre de victoires"
          valueA={victoiresA}
          valueB={victoiresB}
        />
      </div>

      {/* Radar Chart */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Performance par catégorie</h3>
        <Card>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={pointsByCategory}>
                <PolarGrid />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis tick={{ fontSize: 10 }} />
                <Radar name={managerAName} dataKey="managerA" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                <Radar name={managerBName} dataKey="managerB" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Points by Category Table */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Points par catégorie</h3>
        <Card>
          <ScrollArea className="w-full">
            <div className="min-w-[500px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Catégorie</th>
                    <th className="text-right p-3 font-medium text-primary">{managerAName}</th>
                    <th className="text-right p-3 font-medium text-destructive">{managerBName}</th>
                    <th className="text-right p-3 font-medium">Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {pointsByCategory.map((row, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-3">{row.category}</td>
                      <td className="p-3 text-right font-mono font-semibold text-primary">{row.managerA}</td>
                      <td className="p-3 text-right font-mono font-semibold text-destructive">{row.managerB}</td>
                      <td className="p-3 text-right">
                        <Badge variant={row.managerA > row.managerB ? "default" : "destructive"}>
                          {row.managerA > row.managerB ? "+" : ""}
                          {row.managerA - row.managerB}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Top Scorers */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Top 10 scoreurs - {managerAName}</h3>
        {topScorersA.map((scorer, idx) => (
          <MobileCard
            key={scorer.coureur_id}
            title={scorer.nom}
            subtitle={scorer.equipe}
            meta={`Ratio: ${scorer.ratio.toFixed(2)}`}
            avatar={
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  #{idx + 1}
                </AvatarFallback>
              </Avatar>
            }
            badge={
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-primary">{scorer.points}</span>
                <span className="text-xs text-muted-foreground">pts</span>
              </div>
            }
          />
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Top 10 scoreurs - {managerBName}</h3>
        {topScorersB.map((scorer, idx) => (
          <MobileCard
            key={scorer.coureur_id}
            title={scorer.nom}
            subtitle={scorer.equipe}
            meta={`Ratio: ${scorer.ratio.toFixed(2)}`}
            avatar={
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-destructive/10 text-destructive font-bold">
                  #{idx + 1}
                </AvatarFallback>
              </Avatar>
            }
            badge={
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-destructive">{scorer.points}</span>
                <span className="text-xs text-muted-foreground">pts</span>
              </div>
            }
          />
        ))}
      </div>
    </div>
  );
};
