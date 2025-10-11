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
        .select("coureur_id, prix_signature");

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

      query = query.eq("manager_id", managerA);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!managerA,
  });

  const { data: rostersB } = useQuery({
    queryKey: ["roster-manager-b", managerB, phaseId, saisonId],
    queryFn: async () => {
      if (!managerB) return null;
      
      let query = supabase
        .from("rosters")
        .select("coureur_id, prix_signature");

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

      query = query.eq("manager_id", managerB);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!managerB,
  });

  // 3. Récupérer les points des coureurs pour les deux managers
  const { data: pointsA } = useQuery({
    queryKey: ["points-manager-a", managerA, phaseId, saisonId],
    queryFn: async () => {
      if (!managerA) return null;

      let query = supabase
        .from("points_ledger")
        .select("coureur_id, points, type_classement, course_id");

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

      query = query.eq("manager_id", managerA);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!managerA,
  });

  const { data: pointsB } = useQuery({
    queryKey: ["points-manager-b", managerB, phaseId, saisonId],
    queryFn: async () => {
      if (!managerB) return null;

      let query = supabase
        .from("points_ledger")
        .select("coureur_id, points, type_classement, course_id");

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

      query = query.eq("manager_id", managerB);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!managerB,
  });

  // 4. Récupérer les infos des coureurs
  const { data: coureurs } = useQuery({
    queryKey: ["coureurs-comparison", managerA, managerB],
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
        .select("id, nom, equipe")
        .in("id", allCoureurIds);
      
      if (error) throw error;
      return data;
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

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // 6. Récupérer les victoires (position = 1) des coureurs des deux managers
  const { data: victoriesA } = useQuery({
    queryKey: ["victories-manager-a", managerA, phaseId, saisonId],
    queryFn: async () => {
      if (!managerA || !rostersA) return null;

      const coureurIds = rostersA.map(r => r.coureur_id);

      let query = supabase
        .from("race_results")
        .select("id, coureur_id, course_id, type_classement")
        .in("coureur_id", coureurIds)
        .eq("position", 1)
        .eq("statut", "finished");

      if (phaseId) {
        const { data: coursesInPhase } = await supabase
          .from("courses")
          .select("id")
          .eq("phase_id", phaseId);
        
        if (coursesInPhase) {
          const courseIds = coursesInPhase.map(c => c.id);
          query = query.in("course_id", courseIds);
        }
      } else if (saisonId) {
        const { data: phases } = await supabase
          .from("phases")
          .select("id")
          .eq("saison_id", saisonId);
        
        if (phases) {
          const phaseIds = phases.map(p => p.id);
          const { data: coursesInSaison } = await supabase
            .from("courses")
            .select("id")
            .in("phase_id", phaseIds);
          
          if (coursesInSaison) {
            const courseIds = coursesInSaison.map(c => c.id);
            query = query.in("course_id", courseIds);
          }
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!managerA && !!rostersA,
  });

  const { data: victoriesB } = useQuery({
    queryKey: ["victories-manager-b", managerB, phaseId, saisonId],
    queryFn: async () => {
      if (!managerB || !rostersB) return null;

      const coureurIds = rostersB.map(r => r.coureur_id);

      let query = supabase
        .from("race_results")
        .select("id, coureur_id, course_id, type_classement")
        .in("coureur_id", coureurIds)
        .eq("position", 1)
        .eq("statut", "finished");

      if (phaseId) {
        const { data: coursesInPhase } = await supabase
          .from("courses")
          .select("id")
          .eq("phase_id", phaseId);
        
        if (coursesInPhase) {
          const courseIds = coursesInPhase.map(c => c.id);
          query = query.in("course_id", courseIds);
        }
      } else if (saisonId) {
        const { data: phases } = await supabase
          .from("phases")
          .select("id")
          .eq("saison_id", saisonId);
        
        if (phases) {
          const phaseIds = phases.map(p => p.id);
          const { data: coursesInSaison } = await supabase
            .from("courses")
            .select("id")
            .in("phase_id", phaseIds);
          
          if (coursesInSaison) {
            const courseIds = coursesInSaison.map(c => c.id);
            query = query.in("course_id", courseIds);
          }
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!managerB && !!rostersB,
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
        filterCourse: (c: any) => c.type_course === "Stages race",
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

      if (cat.key === "ETAPES") {
        // Pour les étapes, compter à la fois les courses par étapes ET les points d'étapes
        ptsA = pointsA.filter(p => {
          const course = coursesMap.get(p.course_id);
          return (course && cat.filterCourse(course)) || (cat.filterType && cat.filterType(p.type_classement));
        }).reduce((sum, p) => sum + (p.points || 0), 0);

        ptsB = pointsB.filter(p => {
          const course = coursesMap.get(p.course_id);
          return (course && cat.filterCourse(course)) || (cat.filterType && cat.filterType(p.type_classement));
        }).reduce((sum, p) => sum + (p.points || 0), 0);
      } else if (cat.filterCourse) {
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

  // Calculer les métriques globales
  const totalPointsA = pointsA?.reduce((sum, p) => sum + (p.points || 0), 0) || 0;
  const totalPointsB = pointsB?.reduce((sum, p) => sum + (p.points || 0), 0) || 0;

  const scoreursA = new Set(pointsA?.filter(p => (p.points || 0) > 0).map(p => p.coureur_id)).size || 0;
  const scoreursB = new Set(pointsB?.filter(p => (p.points || 0) > 0).map(p => p.coureur_id)).size || 0;

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

      {/* Grid de comparaison des coureurs */}
      {managerA && managerB && (
        <>
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
                      <Radar name={managerAName} dataKey="managerA" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.6} />
                      <Radar name={managerBName} dataKey="managerB" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.6} />
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

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
        </>
      )}
    </div>
  );
}
