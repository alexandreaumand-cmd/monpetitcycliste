import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeagueClient } from "@/lib/supabase/leagueClient";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MobileEmptyState } from "@/components/mobile/MobileEmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Users, TrendingUp, Target, BarChart3 } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, ResponsiveContainer } from "recharts";
import { useLeague } from "@/contexts/LeagueContext";
import { ManagerSelect } from "@/components/shared/ManagerSelect";
import { isStageRace } from "@/lib/courseType";

interface ManagerComparisonMobileProps {
  phaseId: string | null;
  saisonId: string | null;
}

export const ManagerComparisonMobile = ({ phaseId, saisonId }: ManagerComparisonMobileProps) => {
  const [managerA, setManagerA] = useState<string>("");
  const [managerB, setManagerB] = useState<string>("");
  const { leagueId } = useLeague();
  const leagueClient = useLeagueClient();

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

  // Helper to get phase IDs for the season
  const getPhaseIds = async () => {
    if (phaseId) return [phaseId];
    if (saisonId) {
      const { data: phases } = await supabase
        .from("phases")
        .select("id")
        .eq("saison_id", saisonId);
      return phases?.map(p => p.id) || [];
    }
    return [];
  };

  // Fetch rosters for a manager using league-scoped client
  const fetchRosters = async (managerId: string) => {
    if (!managerId) return null;
    let query = leagueClient
      .from("rosters")
      .select("coureur_id, prix_signature, phase_id")
      .eq("manager_id", managerId);

    const pIds = await getPhaseIds();
    if (pIds.length > 0) query = query.in("phase_id", pIds);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  };

  const { data: rostersA } = useQuery({
    queryKey: ["rosters-a", managerA, phaseId, saisonId, leagueId],
    queryFn: () => fetchRosters(managerA),
    enabled: !!managerA,
  });

  const { data: rostersB } = useQuery({
    queryKey: ["rosters-b", managerB, phaseId, saisonId, leagueId],
    queryFn: () => fetchRosters(managerB),
    enabled: !!managerB,
  });

  // Fetch points for a manager's riders
  const fetchPoints = async (rosters: any[] | null) => {
    if (!rosters) return null;
    const coureurIds = rosters.map(r => r.coureur_id);
    let query = supabase
      .from("points_ledger")
      .select("coureur_id, points, type_classement, course_id, phase_id")
      .in("coureur_id", coureurIds);

    if (leagueId) query = query.eq("league_id", leagueId);
    const pIds = await getPhaseIds();
    if (pIds.length > 0) query = query.in("phase_id", pIds);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  };

  const { data: pointsA } = useQuery({
    queryKey: ["points-manager-a", managerA, phaseId, saisonId, rostersA],
    queryFn: () => fetchPoints(rostersA),
    enabled: !!managerA && !!rostersA,
  });

  const { data: pointsB } = useQuery({
    queryKey: ["points-manager-b", managerB, phaseId, saisonId, rostersB],
    queryFn: () => fetchPoints(rostersB),
    enabled: !!managerB && !!rostersB,
  });

  // Fetch bonus_points for a manager
  const fetchBonusPoints = async (managerId: string) => {
    if (!managerId) return null;
    let query = supabase
      .from("bonus_points")
      .select("points")
      .or(`target_manager_id.eq.${managerId},manager_id.eq.${managerId}`);

    if (leagueId) query = query.eq("league_id", leagueId);
    const pIds = await getPhaseIds();
    if (pIds.length > 0) query = query.in("phase_id", pIds);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  };

  const { data: bonusPointsA } = useQuery({
    queryKey: ["bonus-points-a", managerA, phaseId, saisonId],
    queryFn: () => fetchBonusPoints(managerA),
    enabled: !!managerA,
  });

  const { data: bonusPointsB } = useQuery({
    queryKey: ["bonus-points-b", managerB, phaseId, saisonId],
    queryFn: () => fetchBonusPoints(managerB),
    enabled: !!managerB,
  });

  // Fetch manager_bonus_points
  const fetchManagerBonus = async (managerId: string) => {
    if (!managerId) return null;
    let query = leagueClient
      .from("manager_bonus_points")
      .select("bonus_itt, bonus_ttt, bonus_first_win, bonus_coureurs, bonus_scoreurs")
      .eq("manager_id", managerId);

    const pIds = await getPhaseIds();
    if (pIds.length > 0) query = query.in("phase_id", pIds);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  };

  const { data: managerBonusA } = useQuery({
    queryKey: ["manager-bonus-a", managerA, phaseId, saisonId],
    queryFn: () => fetchManagerBonus(managerA),
    enabled: !!managerA,
  });

  const { data: managerBonusB } = useQuery({
    queryKey: ["manager-bonus-b", managerB, phaseId, saisonId],
    queryFn: () => fetchManagerBonus(managerB),
    enabled: !!managerB,
  });

  // Fetch courses
  const { data: courses } = useQuery({
    queryKey: ["courses-comparison", phaseId, saisonId],
    queryFn: async () => {
      let query = supabase
        .from("courses")
        .select("id, nom, type_course, categorie");

      const pIds = await getPhaseIds();
      if (pIds.length > 0) query = query.in("phase_id", pIds);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch victories excluding ties — strict league filtering
  const fetchVictories = async (managerId: string) => {
    if (!managerId || !leagueId) return null;
    const pIds = await getPhaseIds();
    if (pIds.length === 0) return [];

    // 1. Get courseIds scoped to these phases
    const { data: courses } = await supabase
      .from("courses")
      .select("id")
      .in("phase_id", pIds);
    const courseIds = courses?.map(c => c.id) || [];
    if (courseIds.length === 0) return [];

    // 2. Get manager's roster coureurIds for this league
    const { data: rostersData } = await supabase
      .from("rosters")
      .select("coureur_id")
      .eq("manager_id", managerId)
      .eq("league_id", leagueId);
    const coureurIds = [...new Set(rostersData?.map(r => r.coureur_id) || [])];
    if (coureurIds.length === 0) return [];

    // 3. Query race_results with direct filters
    const { data: allWins, error } = await (supabase
      .from("race_results")
      .select("id, coureur_id, course_id, type_classement, etape_numero") as any)
      .eq("position", 1)
      .eq("statut", "finished")
      .in("type_classement", ["Etape", "General"])
      .in("course_id", courseIds)
      .in("coureur_id", coureurIds);
    if (error) throw error;

    // 4. Exclude ties
    const { data: allPos1 } = await (supabase
      .from("race_results")
      .select("id, coureur_id, course_id, type_classement, etape_numero") as any)
      .eq("position", 1)
      .eq("statut", "finished")
      .in("type_classement", ["Etape", "General"])
      .in("course_id", courseIds);

    const groupKey = (v: any) => `${v.course_id}|${v.type_classement}|${v.etape_numero ?? 'null'}`;
    const groups = new Map<string, any[]>();
    allPos1?.forEach((v: any) => {
      const key = groupKey(v);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(v);
    });

    const coureurIdSet = new Set(coureurIds);
    return Array.from(groups.values())
      .filter(g => g.length === 1 && coureurIdSet.has(g[0].coureur_id))
      .map(g => g[0]);
  };

  const { data: victoriesA } = useQuery({
    queryKey: ["victories-a", managerA, phaseId, saisonId, leagueId],
    queryFn: () => fetchVictories(managerA),
    enabled: !!managerA && !!leagueId,
  });

  const { data: victoriesB } = useQuery({
    queryKey: ["victories-b", managerB, phaseId, saisonId, leagueId],
    queryFn: () => fetchVictories(managerB),
    enabled: !!managerB && !!leagueId,
  });

  // Metrics
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
    return new Set(pointsA.filter(p => (p.points || 0) > 0).map(p => `${p.coureur_id}|${p.phase_id}`)).size;
  }, [pointsA]);

  const scoreursB = useMemo(() => {
    if (!pointsB) return 0;
    return new Set(pointsB.filter(p => (p.points || 0) > 0).map(p => `${p.coureur_id}|${p.phase_id}`)).size;
  }, [pointsB]);

  const budgetA = useMemo(() => rostersA?.reduce((sum, r) => sum + (r.prix_signature || 0), 0) || 0, [rostersA]);
  const budgetB = useMemo(() => rostersB?.reduce((sum, r) => sum + (r.prix_signature || 0), 0) || 0, [rostersB]);

  const roiA = budgetA > 0 ? totalPointsA / budgetA : 0;
  const roiB = budgetB > 0 ? totalPointsB / budgetB : 0;
  const victoiresA = victoriesA?.length || 0;
  const victoiresB = victoriesB?.length || 0;

  const coursesMap = useMemo(() => {
    if (!courses) return new Map();
    return new Map(courses.map(c => [c.id, c]));
  }, [courses]);

  // Points by category - fixed type_classement values
  const categoriesConfig = [
    { key: "1J", label: "1 Jour", filterCourse: (c: any) => !isStageRace(c.type_course) },
    { key: "ETAPES", label: "Étapes", filterType: (t: string) => t === "Etape" },
    { key: "GC", label: "CG", filterType: (t: string) => t === "General" },
    { key: "PTS", label: "Points", filterType: (t: string) => t === "Points" },
    { key: "MONT", label: "Montagne", filterType: (t: string) => t === "Montagne" },
    { key: "JEUNE", label: "Jeune", filterType: (t: string) => t === "Jeune" },
    { key: "PORTEUR", label: "Porteur", filterType: (t: string) => t?.startsWith("Porteur") },
  ];

  const pointsByCategory = useMemo(() => {
    if (!pointsA || !pointsB || !courses) return [];
    return categoriesConfig.map(cat => {
      let ptsA = 0, ptsB = 0;
      if (cat.filterCourse) {
        ptsA = pointsA.filter(p => { const c = coursesMap.get(p.course_id); return c && cat.filterCourse(c); }).reduce((s, p) => s + (p.points || 0), 0);
        ptsB = pointsB.filter(p => { const c = coursesMap.get(p.course_id); return c && cat.filterCourse(c); }).reduce((s, p) => s + (p.points || 0), 0);
      } else if (cat.filterType) {
        ptsA = pointsA.filter(p => cat.filterType!(p.type_classement)).reduce((s, p) => s + (p.points || 0), 0);
        ptsB = pointsB.filter(p => cat.filterType!(p.type_classement)).reduce((s, p) => s + (p.points || 0), 0);
      }
      return { category: cat.label, managerA: ptsA, managerB: ptsB };
    });
  }, [pointsA, pointsB, courses, coursesMap]);

  // Radar data normalized
  const radarData = useMemo(() => {
    return pointsByCategory.map(cat => {
      const max = Math.max(cat.managerA, cat.managerB);
      if (max === 0) return { category: cat.category, managerA: 0, managerB: 0 };
      return { category: cat.category, managerA: (cat.managerA / max) * 100, managerB: (cat.managerB / max) * 100 };
    });
  }, [pointsByCategory]);

  // Points by barème type
  const baremesConfig = [
    { label: "1.1", filter: (c: any) => (c.categorie || "").startsWith("1.1") },
    { label: "2.1", filter: (c: any) => (c.categorie || "").startsWith("2.1") },
    { label: "1.pro", filter: (c: any) => (c.categorie || "").toLowerCase().startsWith("1.pro") },
    { label: "2.pro", filter: (c: any) => (c.categorie || "").toLowerCase().startsWith("2.pro") },
    { label: "Tours WT", filter: (c: any) => (c.categorie || "").startsWith("Tours WT") },
    { label: "Class. WT", filter: (c: any) => (c.categorie || "").startsWith("Classiques WT") },
    { label: "GT", filter: (c: any) => c.categorie === "WT GT" },
    { label: "Monum.", filter: (c: any) => c.categorie === "WT Monument" },
    { label: "Champ.", filter: (c: any) => { const cat = c.categorie || ""; return cat.startsWith("CN") || cat.startsWith("WC") || cat.startsWith("EC"); } },
  ];

  const pointsByBareme = useMemo(() => {
    if (!pointsA || !pointsB || !courses) return [];
    return baremesConfig.map(b => {
      const ptsA = pointsA.filter(p => { const c = coursesMap.get(p.course_id); return c && b.filter(c); }).reduce((s, p) => s + (p.points || 0), 0);
      const ptsB = pointsB.filter(p => { const c = coursesMap.get(p.course_id); return c && b.filter(c); }).reduce((s, p) => s + (p.points || 0), 0);
      return { category: b.label, managerA: ptsA, managerB: ptsB };
    });
  }, [pointsA, pointsB, courses, coursesMap]);

  const radarDataBareme = useMemo(() => {
    return pointsByBareme.map(item => {
      const max = Math.max(item.managerA, item.managerB);
      if (max === 0) return { category: item.category, managerA: 0, managerB: 0 };
      return { category: item.category, managerA: (item.managerA / max) * 100, managerB: (item.managerB / max) * 100 };
    });
  }, [pointsByBareme]);

  const managerAName = selectedManagers?.find(m => m.id === managerA)?.nom || "Manager A";
  const managerBName = selectedManagers?.find(m => m.id === managerB)?.nom || "Manager B";

  if (!managerA || !managerB) {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Manager A</Label>
            <ManagerSelect value={managerA} onValueChange={setManagerA} placeholder="Sélectionner" leagueId={leagueId} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Manager B</Label>
            <ManagerSelect value={managerB} onValueChange={setManagerB} placeholder="Sélectionner" leagueId={leagueId} />
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
    const fmt = (v: number) => Math.round(v).toString();

    return (
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground truncate max-w-[40%]">{managerAName}</span>
              <span className="text-base font-bold text-primary">{fmt(valueA)}{suffix && <span className="text-xs font-normal text-muted-foreground ml-0.5">{suffix}</span>}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground truncate max-w-[40%]">{managerBName}</span>
              <span className="text-base font-bold text-destructive">{fmt(valueB)}{suffix && <span className="text-xs font-normal text-muted-foreground ml-0.5">{suffix}</span>}</span>
            </div>
            {diff !== 0 && (
              <div className="pt-1.5 border-t">
                <Badge variant={diff > 0 ? "default" : "destructive"} className="w-full justify-center text-xs">
                  {diff > 0 ? `+${fmt(Math.abs(diff))}` : fmt(diff)} {suffix}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-5 pb-4">
      {/* Manager Selection */}
      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Manager A</Label>
          <ManagerSelect value={managerA} onValueChange={setManagerA} placeholder="Manager A" leagueId={leagueId} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Manager B</Label>
          <ManagerSelect value={managerB} onValueChange={setManagerB} placeholder="Manager B" leagueId={leagueId} />
        </div>
      </div>

      {/* Global Metrics */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Métriques globales</h3>
        <div className="grid grid-cols-2 gap-2">
          <ComparisonMetricCard icon={Trophy} label="Total Points" valueA={totalPointsA} valueB={totalPointsB} suffix="pts" />
          <ComparisonMetricCard icon={Target} label="Victoires" valueA={victoiresA} valueB={victoiresB} />
          <ComparisonMetricCard icon={Users} label="Scoreurs" valueA={scoreursA} valueB={scoreursB} />
          <ComparisonMetricCard icon={TrendingUp} label="ROI" valueA={roiA} valueB={roiB} decimal={2} />
        </div>
      </div>

      {/* Radar - Catégories */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Radar — Catégories</h3>
        <Card>
          <CardContent className="p-2">
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 9 }} />
                <PolarRadiusAxis tick={{ fontSize: 8 }} />
                <Radar name={managerAName} dataKey="managerA" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.5} />
                <Radar name={managerBName} dataKey="managerB" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.5} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Points par catégorie — cards instead of table */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Points par catégorie</h3>
        <div className="grid grid-cols-2 gap-2">
          {pointsByCategory.map((row, idx) => (
            <ComparisonMetricCard
              key={idx}
              icon={BarChart3}
              label={row.category}
              valueA={row.managerA}
              valueB={row.managerB}
              suffix="pts"
            />
          ))}
        </div>
      </div>

      {/* Radar - Barème */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Radar — Barème</h3>
        <Card>
          <CardContent className="p-2">
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarDataBareme}>
                <PolarGrid />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 8 }} />
                <PolarRadiusAxis tick={{ fontSize: 8 }} />
                <Radar name={managerAName} dataKey="managerA" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.5} />
                <Radar name={managerBName} dataKey="managerB" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.5} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Points par barème — cards */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Points par barème</h3>
        <div className="grid grid-cols-2 gap-2">
          {pointsByBareme.map((row, idx) => (
            <ComparisonMetricCard
              key={idx}
              icon={BarChart3}
              label={row.category}
              valueA={row.managerA}
              valueB={row.managerB}
              suffix="pts"
            />
          ))}
        </div>
      </div>
    </div>
  );
};
