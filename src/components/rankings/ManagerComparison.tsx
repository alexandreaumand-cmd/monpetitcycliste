import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ManagerComparisonProps {
  phaseId?: string | null;
  saisonId?: string | null;
}

export function ManagerComparison({ phaseId, saisonId }: ManagerComparisonProps) {
  const [managerA, setManagerA] = useState<string | null>(null);
  const [managerB, setManagerB] = useState<string | null>(null);

  // 1. Récupérer la liste de tous les managers
  const { data: managers } = useQuery({
    queryKey: ["managers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("managers")
        .select("id, nom")
        .order("nom");
      
      if (error) throw error;
      return data;
    },
  });

  // 2. Récupérer les rosters des deux managers
  const { data: rostersA } = useQuery({
    queryKey: ["roster-manager-a", managerA, phaseId, saisonId],
    queryFn: async () => {
      if (!managerA) return null;
      
      let query = supabase
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
    queryKey: ["roster-manager-b", managerB, phaseId, saisonId],
    queryFn: async () => {
      if (!managerB) return null;
      
      let query = supabase
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
      .eq("manager_id", managerA)
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
      .eq("manager_id", managerB)
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

      let query = supabase
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

      let query = supabase
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

      const { data, error } = await supabase
        .from("coureurs")
        .select("id, nom")
        .in("id", allCoureurIds);
      
      if (error) throw error;

      // Enrichir avec l'équipe de la saison si saisonId disponible
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

  // 6. Récupérer les victoires (position = 1) - CORRIGÉ: avec jointure rosters
  const { data: victoriesA } = useQuery({
    queryKey: ["victories-manager-a", managerA, phaseId, saisonId],
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

      // Récupérer les victoires avec rosters pour vérifier appartenance au roster
      const { data: victories, error } = await supabase
        .from("race_results")
        .select(`
          id, 
          coureur_id, 
          course_id, 
          type_classement,
          courses!inner(phase_id)
        `)
        .eq("position", 1)
        .eq("statut", "finished")
        .in("type_classement", ["Etape", "General"]);

      if (error) throw error;

      // Récupérer tous les rosters du manager pour les phases concernées
      let rostersQuery = supabase
        .from("rosters")
        .select("coureur_id, phase_id")
        .eq("manager_id", managerA);

      if (phaseIds.length > 0) {
        rostersQuery = rostersQuery.in("phase_id", phaseIds);
      }

      const { data: rostersData, error: rostersError } = await rostersQuery;
      if (rostersError) throw rostersError;

      // Créer un Map pour accès rapide: coureur_id -> Set<phase_id>
      const rostersByRider = new Map<string, Set<string>>();
      rostersData?.forEach(r => {
        if (!rostersByRider.has(r.coureur_id)) {
          rostersByRider.set(r.coureur_id, new Set());
        }
        rostersByRider.get(r.coureur_id)!.add(r.phase_id);
      });

      // Filtrer les victoires pour ne garder que celles où le coureur était dans le roster
      const filtered = victories?.filter(v => {
        const coursePhaseId = v.courses?.phase_id;
        if (!coursePhaseId) return false;
        
        // Vérifier si le coureur était dans le roster pour cette phase
        const riderPhases = rostersByRider.get(v.coureur_id);
        if (!riderPhases) return false;
        
        return riderPhases.has(coursePhaseId) && 
               (phaseIds.length === 0 || phaseIds.includes(coursePhaseId));
      }) || [];

      return filtered;
    },
    enabled: !!managerA,
  });

  const { data: victoriesB } = useQuery({
    queryKey: ["victories-manager-b", managerB, phaseId, saisonId],
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

      // Récupérer les victoires avec rosters pour vérifier appartenance au roster
      const { data: victories, error } = await supabase
        .from("race_results")
        .select(`
          id, 
          coureur_id, 
          course_id, 
          type_classement,
          courses!inner(phase_id)
        `)
        .eq("position", 1)
        .eq("statut", "finished")
        .in("type_classement", ["Etape", "General"]);

      if (error) throw error;

      // Récupérer tous les rosters du manager pour les phases concernées
      let rostersQuery = supabase
        .from("rosters")
        .select("coureur_id, phase_id")
        .eq("manager_id", managerB);

      if (phaseIds.length > 0) {
        rostersQuery = rostersQuery.in("phase_id", phaseIds);
      }

      const { data: rostersData, error: rostersError } = await rostersQuery;
      if (rostersError) throw rostersError;

      // Créer un Map pour accès rapide: coureur_id -> Set<phase_id>
      const rostersByRider = new Map<string, Set<string>>();
      rostersData?.forEach(r => {
        if (!rostersByRider.has(r.coureur_id)) {
          rostersByRider.set(r.coureur_id, new Set());
        }
        rostersByRider.get(r.coureur_id)!.add(r.phase_id);
      });

      // Filtrer les victoires pour ne garder que celles où le coureur était dans le roster
      const filtered = victories?.filter(v => {
        const coursePhaseId = v.courses?.phase_id;
        if (!coursePhaseId) return false;
        
        // Vérifier si le coureur était dans le roster pour cette phase
        const riderPhases = rostersByRider.get(v.coureur_id);
        if (!riderPhases) return false;
        
        return riderPhases.has(coursePhaseId) && 
               (phaseIds.length === 0 || phaseIds.includes(coursePhaseId));
      }) || [];

      return filtered;
    },
    enabled: !!managerB,
  });

  // Calculs : coureurs communs et exclusifs
  const coureursCommuns = useMemo(() => {
    if (!rostersA || !rostersB || !pointsA || !pointsB || !coureurs) return [];

    const coureursAIds = new Set(rostersA.map(r => r.coureur_id));
    const coureursBIds = new Set(rostersB.map(r => r.coureur_id));

    const commonIds = Array.from(coureursAIds).filter(id => coureursBIds.has(id));

    return commonIds.map(coureurId => {
      const coureur = coureurs.find(c => c.id === coureurId);
      const ptsA = pointsA.filter(p => p.coureur_id === coureurId).reduce((sum, p) => sum + (p.points || 0), 0);
      const ptsB = pointsB.filter(p => p.coureur_id === coureurId).reduce((sum, p) => sum + (p.points || 0), 0);

      return {
        coureur_id: coureurId,
        nom: coureur?.nom || coureurId,
        equipe: coureur?.equipe || "",
        points_a: ptsA,
        points_b: ptsB,
        delta: ptsA - ptsB,
      };
    }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [rostersA, rostersB, pointsA, pointsB, coureurs]);

  const coureursExclusifA = useMemo(() => {
    if (!rostersA || !rostersB || !pointsA || !coureurs) return [];

    const coureursAIds = new Set(rostersA.map(r => r.coureur_id));
    const coureursBIds = new Set(rostersB.map(r => r.coureur_id));

    const exclusifAIds = Array.from(coureursAIds).filter(id => !coureursBIds.has(id));

    return exclusifAIds.map(coureurId => {
      const coureur = coureurs.find(c => c.id === coureurId);
      const pts = pointsA.filter(p => p.coureur_id === coureurId).reduce((sum, p) => sum + (p.points || 0), 0);

      return {
        coureur_id: coureurId,
        nom: coureur?.nom || coureurId,
        equipe: coureur?.equipe || "",
        points: pts,
      };
    }).sort((a, b) => b.points - a.points);
  }, [rostersA, rostersB, pointsA, coureurs]);

  const coureursExclusifB = useMemo(() => {
    if (!rostersA || !rostersB || !pointsB || !coureurs) return [];

    const coureursAIds = new Set(rostersA.map(r => r.coureur_id));
    const coureursBIds = new Set(rostersB.map(r => r.coureur_id));

    const exclusifBIds = Array.from(coureursBIds).filter(id => !coureursAIds.has(id));

    return exclusifBIds.map(coureurId => {
      const coureur = coureurs.find(c => c.id === coureurId);
      const pts = pointsB.filter(p => p.coureur_id === coureurId).reduce((sum, p) => sum + (p.points || 0), 0);

      return {
        coureur_id: coureurId,
        nom: coureur?.nom || coureurId,
        equipe: coureur?.equipe || "",
        points: pts,
      };
    }).sort((a, b) => b.points - a.points);
  }, [rostersA, rostersB, pointsB, coureurs]);

  // Calculer les points par catégorie
  const pointsByCategory = useMemo(() => {
    if (!pointsA || !pointsB || !courses) return null;

    const categories = [
      { key: "1J", label: "Courses 1 Jour", filterCourse: (c: any) => c.type_course === "One-day race" },
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

  // Données pour le graphique Radar
  const radarData = useMemo(() => {
    if (!pointsByCategory) return [];

    return pointsByCategory.map(cat => ({
      category: cat.category,
      managerA: cat.points_a,
      managerB: cat.points_b,
    }));
  }, [pointsByCategory]);

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

  const roiA = (totalPointsA / budgetA).toFixed(2);
  const roiB = (totalPointsB / budgetB).toFixed(2);

  const victoiresA = victoriesA?.length || 0;
  const victoiresB = victoriesB?.length || 0;

  const managerAName = managers?.find(m => m.id === managerA)?.nom || "Manager A";
  const managerBName = managers?.find(m => m.id === managerB)?.nom || "Manager B";

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
              <Select value={managerA || undefined} onValueChange={setManagerA}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers?.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Manager B</label>
              <Select value={managerB || undefined} onValueChange={setManagerB}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers?.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                    <span className="font-mono font-bold text-lg">{totalPointsA}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{managerBName}</span>
                    <span className="font-mono font-bold text-lg">{totalPointsB}</span>
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
                    <span className="font-mono font-bold text-lg">{scoreursA}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{managerBName}</span>
                    <span className="font-mono font-bold text-lg">{scoreursB}</span>
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
                    <span className="font-mono font-bold text-lg">×{roiA}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{managerBName}</span>
                    <span className="font-mono font-bold text-lg">×{roiB}</span>
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
                    <span className="font-mono font-bold text-lg">{victoiresA}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{managerBName}</span>
                    <span className="font-mono font-bold text-lg">{victoiresB}</span>
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

          {/* Grid de comparaison des coureurs */}
          <div className="grid grid-cols-3 gap-4">
            {/* Coureurs communs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Coureurs en commun ({coureursCommuns.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {coureursCommuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun coureur en commun</p>
                ) : (
                  <div className="space-y-3">
                    {coureursCommuns.map(c => (
                      <div key={c.coureur_id} className="border-b pb-2 last:border-0">
                        <div className="font-medium text-sm">{c.nom}</div>
                        <div className="text-xs text-muted-foreground mb-1">{c.equipe}</div>
                        <div className="flex items-center justify-between text-xs">
                          <span className={cn(c.points_a > c.points_b && "font-bold text-primary")}>
                            A: {c.points_a}
                          </span>
                          <span className={cn(c.points_b > c.points_a && "font-bold text-primary")}>
                            B: {c.points_b}
                          </span>
                          <Badge variant={c.delta > 0 ? "default" : c.delta < 0 ? "destructive" : "outline"} className="text-xs">
                            {c.delta > 0 ? <ArrowUp className="w-3 h-3" /> : c.delta < 0 ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                            {Math.abs(c.delta)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Coureurs exclusifs Manager A */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Exclusif à {managerAName} ({coureursExclusifA.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {coureursExclusifA.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun coureur exclusif</p>
                ) : (
                  <div className="space-y-3">
                    {coureursExclusifA.slice(0, 10).map(c => (
                      <div key={c.coureur_id} className="border-b pb-2 last:border-0">
                        <div className="font-medium text-sm">{c.nom}</div>
                        <div className="text-xs text-muted-foreground">{c.equipe}</div>
                        <div className="text-xs font-mono mt-1">{c.points} pts</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Coureurs exclusifs Manager B */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Exclusif à {managerBName} ({coureursExclusifB.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {coureursExclusifB.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun coureur exclusif</p>
                ) : (
                  <div className="space-y-3">
                    {coureursExclusifB.slice(0, 10).map(c => (
                      <div key={c.coureur_id} className="border-b pb-2 last:border-0">
                        <div className="font-medium text-sm">{c.nom}</div>
                        <div className="text-xs text-muted-foreground">{c.equipe}</div>
                        <div className="text-xs font-mono mt-1">{c.points} pts</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Statistiques de comparaison */}
          <div className="grid grid-cols-2 gap-4">
            {/* Tableau de points par catégorie */}
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

            {/* Graphique Radar */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Graphique Radar</CardTitle>
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
                      <Tooltip />
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
