import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeagueClient } from "@/lib/supabase/leagueClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLeague } from "@/contexts/LeagueContext";
import { ManagerSelect } from "@/components/shared/ManagerSelect";

interface ManagerComparisonProps {
  phaseId?: string | null;
  saisonId?: string | null;
}

export function ManagerComparison({ phaseId, saisonId }: ManagerComparisonProps) {
  const [managerA, setManagerA] = useState<string | null>(null);
  const [managerB, setManagerB] = useState<string | null>(null);
  const { leagueId } = useLeague();
  const leagueClient = useLeagueClient();

  // Récupérer les noms des managers sélectionnés
  const { data: selectedManagers } = useQuery({
    queryKey: ["selected-managers", managerA, managerB],
    queryFn: async () => {
      const ids = [managerA, managerB].filter(Boolean) as string[];
      if (ids.length === 0) return [];
      
      const { data, error } = await supabase
        .from("managers")
        .select("id, nom, avatar_url")
        .in("id", ids);
      
      if (error) throw error;
      return data;
    },
    enabled: !!(managerA || managerB),
  });

  // Récupérer les rosters des deux managers
  
  const { data: rostersA } = useQuery({
    queryKey: ["roster-manager-a", managerA, phaseId, saisonId, leagueId],
    queryFn: async () => {
      if (!managerA) return null;
      
      let query = leagueClient
        .from("rosters")
        .select("coureur_id, prix_signature, phase_id")
        .eq("manager_id", managerA);

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
      // ELSE: No filter = all phases (global standings)

      const { data, error } = await query;
      if (error) throw error;
      
      // Aggregate by coureur_id (handle multi-phase rosters)
      const aggregated = new Map<string, { coureur_id: string; prix_signature: number }>();
      data?.forEach(r => {
        if (!aggregated.has(r.coureur_id)) {
          aggregated.set(r.coureur_id, { coureur_id: r.coureur_id, prix_signature: r.prix_signature });
        } else {
          // Sum prices if coureur appears in multiple phases
          const existing = aggregated.get(r.coureur_id)!;
          existing.prix_signature += r.prix_signature;
        }
      });
      
      return Array.from(aggregated.values());
    },
    enabled: !!managerA,
  });

  const { data: rostersB } = useQuery({
    queryKey: ["roster-manager-b", managerB, phaseId, saisonId, leagueId],
    queryFn: async () => {
      if (!managerB) return null;
      
      let query = leagueClient
        .from("rosters")
        .select("coureur_id, prix_signature, phase_id")
        .eq("manager_id", managerB);

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
      // ELSE: No filter = all phases (global standings)

      const { data, error } = await query;
      if (error) throw error;
      
      // Aggregate by coureur_id (handle multi-phase rosters)
      const aggregated = new Map<string, { coureur_id: string; prix_signature: number }>();
      data?.forEach(r => {
        if (!aggregated.has(r.coureur_id)) {
          aggregated.set(r.coureur_id, { coureur_id: r.coureur_id, prix_signature: r.prix_signature });
        } else {
          // Sum prices if coureur appears in multiple phases
          const existing = aggregated.get(r.coureur_id)!;
          existing.prix_signature += r.prix_signature;
        }
      });
      
      return Array.from(aggregated.values());
    },
    enabled: !!managerB,
  });

  // 3. Récupérer les points des coureurs pour les deux managers
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
      // ELSE: No filter = all phases (global standings)

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!managerA && !!rostersA,
  });

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
      // ELSE: No filter = all phases (global standings)

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
        .select("points, phase_id")
        .or(`target_manager_id.eq.${managerA},manager_id.eq.${managerA}`);

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

  // Fetch bonus_points for manager B
  const { data: bonusPointsB } = useQuery({
    queryKey: ["bonus-points-b", managerB, phaseId, saisonId],
    queryFn: async () => {
      if (!managerB) return null;

      let query = supabase
        .from("bonus_points")
        .select("points, phase_id")
        .or(`target_manager_id.eq.${managerB},manager_id.eq.${managerB}`);

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

  // Fetch manager_bonus_points for manager A
  const { data: managerBonusA } = useQuery({
    queryKey: ["manager-bonus-a", managerA, phaseId, saisonId],
    queryFn: async () => {
      if (!managerA) return null;

      let query = leagueClient
        .from("manager_bonus_points")
        .select("bonus_itt, bonus_ttt, bonus_first_win, bonus_coureurs, bonus_scoreurs, phase_id")
        .eq("manager_id", managerA);

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

  // Fetch manager_bonus_points for manager B
  const { data: managerBonusB } = useQuery({
    queryKey: ["manager-bonus-b", managerB, phaseId, saisonId],
    queryFn: async () => {
      if (!managerB) return null;

      let query = leagueClient
        .from("manager_bonus_points")
        .select("bonus_itt, bonus_ttt, bonus_first_win, bonus_coureurs, bonus_scoreurs, phase_id")
        .eq("manager_id", managerB);

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

  // 4. Récupérer les infos des coureurs avec équipe de saison
  const { data: coureurs } = useQuery({
    queryKey: ["coureurs-comparison", managerA, managerB, saisonId],
    queryFn: async () => {
      if (!rostersA || !rostersB) return null;

      const allCoureurIds = [
        ...new Set([
          ...rostersA.map(r => r.coureur_id),
          ...rostersB.map(r => r.coureur_id)
        ])
      ];

      // Récupérer d'abord les coureurs avec leur équipe de base
      const { data, error } = await supabase
        .from("coureurs")
        .select("id, nom, equipe")
        .in("id", allCoureurIds);
      
      if (error) throw error;

      // Enrichir avec l'équipe de la saison si saisonId disponible
      if (!saisonId) {
        return (data || []).map(c => ({ ...c, equipe: c.equipe || 'N/A' as string }));
      }

      const enrichedData = await Promise.all(
        (data || []).map(async (coureur) => {
          const { data: seasonData } = await supabase
            .from('coureurs_saisons')
            .select(`
              equipe_id,
              equipes_saisons!coureurs_saisons_equipe_id_saison_id_fkey(nom_affiche)
            `)
            .eq('coureur_id', coureur.id)
            .eq('saison_id', saisonId)
            .maybeSingle();

          return {
            ...coureur,
            equipe: (seasonData?.equipes_saisons as any)?.nom_affiche || coureur.equipe || 'N/A' as string
          };
        })
      );

      return enrichedData;
    },
    enabled: !!rostersA && !!rostersB,
  });

  // 5. Récupérer les infos des courses pour catégoriser les points
  const { data: courses } = useQuery({
    queryKey: ["courses-for-comparison", phaseId, saisonId],
    queryFn: async () => {
      let query = supabase
        .from("courses")
        .select("id, type_course, categorie");

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
      // ELSE: No filter = all courses (global standings)

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Helper: fetch victories for a manager, excluding ties
  const fetchVictories = async (managerId: string) => {
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

    // Fetch ALL position=1 results to detect ties
    const { data: allWins, error } = await supabase
      .from("race_results")
      .select(`
        id, coureur_id, course_id, type_classement, etape_numero,
        courses!inner(phase_id)
      `)
      .eq("position", 1)
      .eq("statut", "finished")
      .in("type_classement", ["Etape", "General"]);

    if (error) throw error;

    // Exclude ties: group by (course_id, type_classement, etape_numero)
    const groupKey = (v: any) => `${v.course_id}|${v.type_classement}|${v.etape_numero ?? 'null'}`;
    const groups = new Map<string, any[]>();
    allWins?.forEach(v => {
      const key = groupKey(v);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(v);
    });
    const uniqueWins = Array.from(groups.values())
      .filter(g => g.length === 1)
      .map(g => g[0]);

    // Get manager's rosters (league-scoped)
    let rostersQuery = leagueClient
      .from("rosters")
      .select("coureur_id, phase_id")
      .eq("manager_id", managerId);
    if (phaseIds.length > 0) {
      rostersQuery = rostersQuery.in("phase_id", phaseIds);
    }

    const { data: rostersData, error: rostersError } = await rostersQuery;
    if (rostersError) throw rostersError;

    const rostersByRider = new Map<string, Set<string>>();
    rostersData?.forEach(r => {
      if (!rostersByRider.has(r.coureur_id)) {
        rostersByRider.set(r.coureur_id, new Set());
      }
      rostersByRider.get(r.coureur_id)!.add(r.phase_id);
    });

    return uniqueWins.filter(v => {
      const coursePhaseId = v.courses?.phase_id;
      if (!coursePhaseId) return false;
      const riderPhases = rostersByRider.get(v.coureur_id);
      if (!riderPhases) return false;
      return riderPhases.has(coursePhaseId) &&
        (phaseIds.length === 0 || phaseIds.includes(coursePhaseId));
    });
  };

  // 6. Récupérer les victoires (position = 1) - excluant les ex-aequo
  const { data: victoriesA } = useQuery({
    queryKey: ["victories-manager-a", managerA, phaseId, saisonId],
    queryFn: () => fetchVictories(managerA!),
    enabled: !!managerA,
  });

  const { data: victoriesB } = useQuery({
    queryKey: ["victories-manager-b", managerB, phaseId, saisonId],
    queryFn: () => fetchVictories(managerB!),
    enabled: !!managerB,
  });

  // Calculer les points par type de barème (9 catégories détaillées)
  const pointsByBaremeType = useMemo(() => {
    if (!pointsA || !pointsB || !courses) return null;

    const baremes = [
      { 
        key: "1.1", 
        label: "1.1", 
        filterCourse: (c: any) => {
          const cat = c.categorie || "";
          return cat.startsWith("1.1");
        }
      },
      { 
        key: "2.1", 
        label: "2.1", 
        filterCourse: (c: any) => {
          const cat = c.categorie || "";
          return cat.startsWith("2.1");
        }
      },
      { 
        key: "1.PRO", 
        label: "1.pro", 
        filterCourse: (c: any) => {
          const cat = (c.categorie || "").toLowerCase();
          return cat.startsWith("1.pro");
        }
      },
      { 
        key: "2.PRO", 
        label: "2.pro", 
        filterCourse: (c: any) => {
          const cat = (c.categorie || "").toLowerCase();
          return cat.startsWith("2.pro");
        }
      },
      { 
        key: "TOURS_WT", 
        label: "Tours WT", 
        filterCourse: (c: any) => {
          const cat = c.categorie || "";
          return cat.startsWith("Tours WT");
        }
      },
      { 
        key: "CLASSIQUES_WT", 
        label: "Classiques WT", 
        filterCourse: (c: any) => {
          const cat = c.categorie || "";
          return cat.startsWith("Classiques WT");
        }
      },
      { 
        key: "GT", 
        label: "GT", 
        filterCourse: (c: any) => {
          return c.categorie === "WT GT";
        }
      },
      { 
        key: "MONUMENTS", 
        label: "Monuments", 
        filterCourse: (c: any) => {
          return c.categorie === "WT Monument";
        }
      },
      { 
        key: "CHAMPIONNATS", 
        label: "Championnats", 
        filterCourse: (c: any) => {
          const cat = c.categorie || "";
          return cat.startsWith("CN") || cat.startsWith("WC") || cat.startsWith("EC");
        }
      },
    ];

    const coursesMap = new Map(courses.map(c => [c.id, c]));

    return baremes.map(bareme => {
      let ptsA = 0;
      let ptsB = 0;

      ptsA = pointsA.filter(p => {
        const course = coursesMap.get(p.course_id);
        return course && bareme.filterCourse(course);
      }).reduce((sum, p) => sum + (p.points || 0), 0);

      ptsB = pointsB.filter(p => {
        const course = coursesMap.get(p.course_id);
        return course && bareme.filterCourse(course);
      }).reduce((sum, p) => sum + (p.points || 0), 0);

      return {
        category: bareme.label,
        points_a: ptsA,
        points_b: ptsB,
        delta: ptsA - ptsB,
      };
    });
  }, [pointsA, pointsB, courses]);

  // Calculer les points par catégorie
  const pointsByCategory = useMemo(() => {
    if (!pointsA || !pointsB || !courses) return null;

    const categories = [
      { key: "1J", label: "Courses 1 Jour", filterCourse: (c: any) => !isStageRace(c.type_course) },
      { 
        key: "ETAPES", 
        label: "Courses par étapes", 
        filterType: (typeClass: string) => typeClass === "Etape"
      },
      { key: "GC", label: "Classement Général", filterType: (typeClass: string) => typeClass === "General" },
      { key: "PTS", label: "Points", filterType: (typeClass: string) => typeClass === "Points" },
      { key: "MONT", label: "Montagne", filterType: (typeClass: string) => typeClass === "Montagne" },
      { key: "JEUNE", label: "Jeune", filterType: (typeClass: string) => typeClass === "Jeune" },
      { key: "PORTEUR", label: "Porteur Maillot", filterType: (typeClass: string) => typeClass?.startsWith("Porteur") },
    ];

    const coursesMap = new Map(courses.map(c => [c.id, c]));

    return categories.map(cat => {
      let ptsA = 0;
      let ptsB = 0;

      if (cat.filterCourse) {
        // Pour les autres catégories avec filterCourse (1J uniquement)
        ptsA = pointsA.filter(p => {
          const course = coursesMap.get(p.course_id);
          return course && cat.filterCourse(course);
        }).reduce((sum, p) => sum + (p.points || 0), 0);

        ptsB = pointsB.filter(p => {
          const course = coursesMap.get(p.course_id);
          return course && cat.filterCourse(course);
        }).reduce((sum, p) => sum + (p.points || 0), 0);
      } else if (cat.filterType) {
        // Filtrer par type_classement uniquement
        ptsA = pointsA.filter(p => cat.filterType(p.type_classement)).reduce((sum, p) => sum + (p.points || 0), 0);
        ptsB = pointsB.filter(p => cat.filterType(p.type_classement)).reduce((sum, p) => sum + (p.points || 0), 0);
      }

      return {
        category: cat.label,
        points_a: ptsA,
        points_b: ptsB,
        delta: ptsA - ptsB,
      };
    });
  }, [pointsA, pointsB, courses]);

  // Données pour le graphique Radar - Catégories (normalisé base 100)
  const radarData = useMemo(() => {
    if (!pointsByCategory) return [];

    return pointsByCategory.map(cat => {
      const maxPoints = Math.max(cat.points_a, cat.points_b);
      
      // Si aucun manager n'a de points, on retourne 0
      if (maxPoints === 0) {
        return {
          category: cat.category,
          managerA: 0,
          managerB: 0,
        };
      }

      // Normaliser sur base 100
      return {
        category: cat.category,
        managerA: (cat.points_a / maxPoints) * 100,
        managerB: (cat.points_b / maxPoints) * 100,
      };
    });
  }, [pointsByCategory]);

  // Données pour le graphique Radar - Type de barème (normalisé base 100)
  const radarDataBareme = useMemo(() => {
    if (!pointsByBaremeType) return [];

    return pointsByBaremeType.map(item => {
      const maxPoints = Math.max(item.points_a, item.points_b);
      
      // Si aucun manager n'a de points, on retourne 0
      if (maxPoints === 0) {
        return {
          category: item.category,
          managerA: 0,
          managerB: 0,
        };
      }

      // Normaliser sur base 100
      return {
        category: item.category,
        managerA: (item.points_a / maxPoints) * 100,
        managerB: (item.points_b / maxPoints) * 100,
      };
    });
  }, [pointsByBaremeType]);

  // Composant Tooltip personnalisé pour afficher les points réels
  const CustomRadarTooltip = ({ active, payload, sourceData }: any) => {
    if (!active || !payload || !payload.length || !sourceData) return null;

    const category = payload[0].payload.category;
    const dataPoint = sourceData.find((item: any) => item.category === category);
    
    if (!dataPoint) return null;

    return (
      <div className="bg-background border rounded-lg shadow-lg p-3">
        <p className="font-semibold text-sm mb-2">{category}</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3b82f6' }}></div>
            <span className="text-xs">{managerAName}:</span>
            <span className="font-mono font-bold text-xs">{dataPoint.points_a} pts</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }}></div>
            <span className="text-xs">{managerBName}:</span>
            <span className="font-mono font-bold text-xs">{dataPoint.points_b} pts</span>
          </div>
        </div>
      </div>
    );
  };

  // Calculer les métriques globales - CORRIGÉ: ajouter bonus
  const totalPointsA =
    (pointsA?.reduce((sum, p) => sum + (p.points || 0), 0) || 0) +
    (bonusPointsA?.reduce((sum, b) => sum + (b.points || 0), 0) || 0) +
    (managerBonusA?.reduce((sum, mb) => 
      sum + (mb.bonus_itt || 0) + (mb.bonus_ttt || 0) + 
      (mb.bonus_first_win || 0) + (mb.bonus_coureurs || 0) + 
      (mb.bonus_scoreurs || 0), 0) || 0);

  const totalPointsB = 
    (pointsB?.reduce((sum, p) => sum + (p.points || 0), 0) || 0) +
    (bonusPointsB?.reduce((sum, b) => sum + (b.points || 0), 0) || 0) +
    (managerBonusB?.reduce((sum, mb) => 
      sum + (mb.bonus_itt || 0) + (mb.bonus_ttt || 0) + 
      (mb.bonus_first_win || 0) + (mb.bonus_coureurs || 0) + 
      (mb.bonus_scoreurs || 0), 0) || 0);

  const scoreursA = new Set(pointsA?.filter(p => (p.points || 0) > 0).map(p => `${p.coureur_id}|${p.phase_id}`)).size || 0;
  const scoreursB = new Set(pointsB?.filter(p => (p.points || 0) > 0).map(p => `${p.coureur_id}|${p.phase_id}`)).size || 0;

  const budgetA = rostersA?.reduce((sum, r) => sum + (r.prix_signature || 0), 0) || 1;
  const budgetB = rostersB?.reduce((sum, r) => sum + (r.prix_signature || 0), 0) || 1;

   const roiA = Math.round(totalPointsA / budgetA).toString();
   const roiB = Math.round(totalPointsB / budgetB).toString();

  const victoiresA = victoriesA?.length || 0;
  const victoiresB = victoriesB?.length || 0;

  const managerAData = selectedManagers?.find(m => m.id === managerA);
  const managerBData = selectedManagers?.find(m => m.id === managerB);
  const managerAName = managerAData?.nom || "Manager A";
  const managerBName = managerBData?.nom || "Manager B";
  const managerAAvatar = managerAData?.avatar_url;
  const managerBAvatar = managerBData?.avatar_url;

  const scopeLabel = phaseId ? "Phase" : saisonId ? "Saison" : "Global";

  return (
    <div className="space-y-6">
      {/* En-tête avec sélecteurs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>🔀 Comparaison de Managers</span>
            <Badge variant="secondary">{scopeLabel}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Manager A</label>
              <ManagerSelect 
                value={managerA || undefined} 
                onValueChange={setManagerA}
                placeholder="Sélectionner un manager"
                leagueId={leagueId}
              />
              {managerA && (
                <div className="flex items-center gap-2 mt-2">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={managerAAvatar || undefined} alt={managerAName} />
                    <AvatarFallback className="text-xs">{managerAName[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{managerAName}</span>
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Manager B</label>
              <ManagerSelect 
                value={managerB || undefined} 
                onValueChange={setManagerB}
                placeholder="Sélectionner un manager"
                leagueId={leagueId}
              />
              {managerB && (
                <div className="flex items-center gap-2 mt-2">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={managerBAvatar || undefined} alt={managerBName} />
                    <AvatarFallback className="text-xs">{managerBName[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{managerBName}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Message si aucun manager sélectionné */}
      {(!managerA || !managerB) && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Sélectionnez deux managers pour afficher la comparaison
          </CardContent>
        </Card>
      )}

      {/* Contenu de la comparaison */}
      {managerA && managerB && (
        <>
          {/* Métriques globales */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Total Points</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{managerAName}</span>
                    <span className={cn(
                      "font-mono font-bold text-lg",
                      totalPointsA > totalPointsB && "text-green-600"
                    )}>{totalPointsA}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{managerBName}</span>
                    <span className={cn(
                      "font-mono font-bold text-lg",
                      totalPointsB > totalPointsA && "text-green-600"
                    )}>{totalPointsB}</span>
                  </div>
                  <div className="pt-2 border-t flex justify-between items-center">
                    <span className="text-sm font-medium">Écart</span>
                    <Badge variant={totalPointsA > totalPointsB ? "default" : "destructive"}>
                      {totalPointsA > totalPointsB ? "+" : ""}{totalPointsA - totalPointsB}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nombre de scoreurs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{managerAName}</span>
                    <span className={cn(
                      "font-mono font-bold text-lg",
                      scoreursA > scoreursB && "text-green-600"
                    )}>{scoreursA}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{managerBName}</span>
                    <span className={cn(
                      "font-mono font-bold text-lg",
                      scoreursB > scoreursA && "text-green-600"
                    )}>{scoreursB}</span>
                  </div>
                  <div className="pt-2 border-t flex justify-between items-center">
                    <span className="text-sm font-medium">Écart</span>
                    <Badge variant={scoreursA > scoreursB ? "default" : "destructive"}>
                      {scoreursA > scoreursB ? "+" : ""}{scoreursA - scoreursB}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">ROI moyen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{managerAName}</span>
                    <span className={cn(
                      "font-mono font-bold text-lg",
                      parseFloat(roiA) > parseFloat(roiB) && "text-green-600"
                    )}>×{roiA}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{managerBName}</span>
                    <span className={cn(
                      "font-mono font-bold text-lg",
                      parseFloat(roiB) > parseFloat(roiA) && "text-green-600"
                    )}>×{roiB}</span>
                  </div>
                  <div className="pt-2 border-t flex justify-between items-center">
                    <span className="text-sm font-medium">Meilleur ROI</span>
                    <Badge variant="default">
                      {parseFloat(roiA) > parseFloat(roiB) ? managerAName : managerBName}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nombre de victoires</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{managerAName}</span>
                    <span className={cn(
                      "font-mono font-bold text-lg",
                      victoiresA > victoiresB && "text-green-600"
                    )}>{victoiresA}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{managerBName}</span>
                    <span className={cn(
                      "font-mono font-bold text-lg",
                      victoiresB > victoiresA && "text-green-600"
                    )}>{victoiresB}</span>
                  </div>
                  <div className="pt-2 border-t flex justify-between items-center">
                    <span className="text-sm font-medium">Écart</span>
                    <Badge variant={victoiresA > victoiresB ? "default" : victoiresA < victoiresB ? "destructive" : "outline"}>
                      {victoiresA === victoiresB ? "=" : (victoiresA > victoiresB ? "+" : "")}{victoiresA - victoiresB}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Statistiques de comparaison */}
          <div className="grid grid-cols-2 gap-4">
            {/* Points par catégorie - Tableau */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Points par catégorie</CardTitle>
              </CardHeader>
              <CardContent>
                {!pointsByCategory ? (
                  <Skeleton className="h-64" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Catégorie</TableHead>
                        <TableHead className="text-right">{managerAName}</TableHead>
                        <TableHead className="text-right">{managerBName}</TableHead>
                        <TableHead className="text-right">Écart</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pointsByCategory.map((row, idx) => {
                        const isABetter = row.points_a > row.points_b;
                        return (
                          <TableRow key={idx}>
                            <TableCell className="text-sm">{row.category}</TableCell>
                            <TableCell className={cn(
                              "text-right font-mono text-sm",
                              isABetter && "text-primary font-bold"
                            )}>
                              {row.points_a}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right font-mono text-sm",
                              !isABetter && row.points_b > row.points_a && "text-primary font-bold"
                            )}>
                              {row.points_b}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right font-mono text-sm",
                              row.delta > 0 ? "text-green-600" : row.delta < 0 ? "text-destructive" : "text-muted-foreground"
                            )}>
                              {row.delta > 0 ? `+${row.delta}` : row.delta}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Graphique Radar - Catégories */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Radar - Catégories</CardTitle>
              </CardHeader>
              <CardContent>
                {radarData.length === 0 ? (
                  <Skeleton className="h-64" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis />
                      <Radar name={managerAName} dataKey="managerA" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                      <Radar name={managerBName} dataKey="managerB" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
                      <Legend />
                      <Tooltip content={<CustomRadarTooltip sourceData={pointsByCategory} />} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Points par type de barème - Tableau */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Points par type de barème</CardTitle>
              </CardHeader>
              <CardContent>
                {!pointsByBaremeType ? (
                  <Skeleton className="h-40" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Barème</TableHead>
                        <TableHead className="text-right">{managerAName}</TableHead>
                        <TableHead className="text-right">{managerBName}</TableHead>
                        <TableHead className="text-right">Écart</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pointsByBaremeType.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-sm">{item.category}</TableCell>
                          <TableCell className={cn(
                            "text-right font-mono text-sm",
                            item.points_a > item.points_b && "font-bold text-primary"
                          )}>
                            {item.points_a}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-mono text-sm",
                            item.points_b > item.points_a && "font-bold text-primary"
                          )}>
                            {item.points_b}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-mono text-sm",
                            item.delta > 0 ? "text-green-600" : item.delta < 0 ? "text-destructive" : "text-muted-foreground"
                          )}>
                            {item.delta > 0 ? `+${item.delta}` : item.delta}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Graphique Radar - Type de barème */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Radar - Type de barème</CardTitle>
              </CardHeader>
              <CardContent>
                {radarDataBareme.length === 0 ? (
                  <Skeleton className="h-40" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarDataBareme}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="category" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis />
                      <Radar name={managerAName} dataKey="managerA" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                      <Radar name={managerBName} dataKey="managerB" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
                      <Legend />
                      <Tooltip content={<CustomRadarTooltip sourceData={pointsByBaremeType} />} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

        </>
      )}
    </div>
  );
}
