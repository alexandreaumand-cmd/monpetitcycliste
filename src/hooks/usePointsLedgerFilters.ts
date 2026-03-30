import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PointsLedgerRow {
  id: string;
  phase_id: string | null;
  course_id: string | null;
  type_classement: string;
  etape_numero: number | null;
  coureur_id: string | null;
  points: number;
  created_at: string;
  coureur_nom?: string;
  course_nom?: string;
  course_categorie?: string;
  phase_index?: number;
  saison_annee?: number;
  equipe_nom?: string;
}

export const typesClassement = [
  "General",
  "Etape",
  "Points",
  "Montagne",
  "Jeunes",
  "Porteur Maillot Vert",
  "Porteur Maillot à Pois",
  "Porteur Maillot Blanc",
  "Porteur Maillot Jaune",
];

export const usePointsLedgerFilters = () => {
  const [saisonFilter, setSaisonFilter] = useState<string>("");
  const [phaseFilter, setPhaseFilter] = useState<string>("");
  const [courseFilter, setCourseFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [coureurSearch, setCoureurSearch] = useState("");
  const [minPoints, setMinPoints] = useState("");
  const [maxPoints, setMaxPoints] = useState("");
  const [pointsSort, setPointsSort] = useState<"asc" | "desc" | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");

  const { data: saisons } = useQuery({
    queryKey: ["saisons-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saisons")
        .select("id, annee")
        .order("annee", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: phases } = useQuery({
    queryKey: ["phases-list", saisonFilter],
    queryFn: async () => {
      let query = supabase.from("phases").select("id, index_dans_saison, saison_id").order("index_dans_saison");
      if (saisonFilter) query = query.eq("saison_id", saisonFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!saisonFilter,
  });

  const { data: courses } = useQuery({
    queryKey: ["courses-list", saisonFilter, phaseFilter, phases],
    queryFn: async () => {
      let query = supabase.from("courses").select("id, nom, phase_id").order("nom");
      if (phaseFilter) {
        query = query.eq("phase_id", phaseFilter);
      } else if (saisonFilter && phases && phases.length > 0) {
        query = query.in("phase_id", phases.map(p => p.id));
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    setCourseFilter("");
  }, [saisonFilter, phaseFilter]);

  const { data: rawData, isLoading } = useQuery({
    queryKey: ["points-ledger-table", saisonFilter, phaseFilter, courseFilter, typeFilter, coureurSearch, minPoints, maxPoints, globalSearch, phases],
    queryFn: async () => {
      let query = supabase
        .from("points_ledger")
        .select(`
          *,
          coureurs!points_ledger_coureur_id_fkey (nom),
          courses!points_ledger_course_id_fkey (nom, categorie),
          phases!points_ledger_phase_id_fkey (
            index_dans_saison,
            saison_id,
            saisons!phases_saison_id_fkey (id, annee)
          )
        `)
        .order("created_at", { ascending: false });

      if (saisonFilter) {
        const phaseIds = phases?.filter(p => p.saison_id === saisonFilter).map(p => p.id) || [];
        if (phaseIds.length > 0) {
          query = query.in("phase_id", phaseIds);
        } else {
          return [];
        }
      }

      if (phaseFilter) query = query.eq("phase_id", phaseFilter);
      if (courseFilter) query = query.eq("course_id", courseFilter);
      if (typeFilter) query = query.eq("type_classement", typeFilter as any);
      if (minPoints) query = query.gte("points", parseInt(minPoints));
      if (maxPoints) query = query.lte("points", parseInt(maxPoints));
      query = query.limit(50000);

      const { data: directData, error: directError } = await query;
      if (directError) throw directError;

      let results = (directData || []).map((row: any) => ({
        id: row.id,
        phase_id: row.phase_id,
        course_id: row.course_id,
        type_classement: row.type_classement,
        etape_numero: row.etape_numero,
        coureur_id: row.coureur_id,
        points: row.points,
        created_at: row.created_at,
        coureur_nom: row.coureurs?.nom,
        course_nom: row.courses?.nom,
        course_categorie: row.courses?.categorie,
        phase_index: row.phases?.index_dans_saison,
        saison_id: row.phases?.saisons?.id,
        saison_annee: row.phases?.saisons?.annee,
      }));

      if (coureurSearch) {
        const search = coureurSearch.toLowerCase();
        results = results.filter((r: any) => r.coureur_nom?.toLowerCase().includes(search));
      }
      if (globalSearch) {
        const search = globalSearch.toLowerCase();
        results = results.filter((r: any) =>
          r.coureur_nom?.toLowerCase().includes(search) || r.course_nom?.toLowerCase().includes(search)
        );
      }

      return results as PointsLedgerRow[];
    },
    enabled: !saisonFilter || (!!saisonFilter && !!phases && phases.length > 0),
  });

  const sortedData = useMemo(() => {
    if (!rawData) return [];
    if (!pointsSort) return rawData;
    return [...rawData].sort((a, b) => pointsSort === "asc" ? a.points - b.points : b.points - a.points);
  }, [rawData, pointsSort]);

  const stats = useMemo(() => {
    if (!rawData) return { totalPoints: 0, totalEntries: 0, uniqueRiders: 0, uniqueCourses: 0 };
    return {
      totalPoints: rawData.reduce((sum, row) => sum + (row.points || 0), 0),
      totalEntries: rawData.length,
      uniqueRiders: new Set(rawData.map(row => row.coureur_id).filter(Boolean)).size,
      uniqueCourses: new Set(rawData.map(row => row.course_id).filter(Boolean)).size,
    };
  }, [rawData]);

  const resetFilters = () => {
    setSaisonFilter("");
    setPhaseFilter("");
    setCourseFilter("");
    setTypeFilter("");
    setCoureurSearch("");
    setMinPoints("");
    setMaxPoints("");
    setGlobalSearch("");
  };

  const exportToCSV = () => {
    if (!rawData) return;
    const headers = ["Course", "Coureur", "Phase", "Saison", "Type", "Étape", "Points", "Date"];
    const rows = rawData.map(row => [
      row.course_nom || "", row.coureur_nom || "", row.phase_index || "", row.saison_annee || "",
      row.type_classement || "", row.etape_numero || "", row.points || "", new Date(row.created_at).toLocaleDateString(),
    ]);
    const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `points_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return {
    // Filter state
    saisonFilter, setSaisonFilter,
    phaseFilter, setPhaseFilter,
    courseFilter, setCourseFilter,
    typeFilter, setTypeFilter,
    coureurSearch, setCoureurSearch,
    minPoints, setMinPoints,
    maxPoints, setMaxPoints,
    pointsSort, setPointsSort,
    globalSearch, setGlobalSearch,
    // Data
    saisons, phases, courses,
    rawData, sortedData, stats, isLoading,
    // Actions
    resetFilters, exportToCSV,
  };
};
