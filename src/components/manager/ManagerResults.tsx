import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RecentRacesList } from "./RecentRacesList";
import { CourseResultsDetail } from "./CourseResultsDetail";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FiltersMeta {
  saisons: Array<{ id: string; annee: number }>;
  phases: Array<{ id: string; index_dans_saison: number; date_debut: string; date_fin: string; saison_id: string }>;
}

export const ManagerResults = () => {
  const [saisonId, setSaisonId] = useState<string>("");
  const [phaseId, setPhaseId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [races, setRaces] = useState<any[]>([]);
  const [filtersMeta, setFiltersMeta] = useState<FiltersMeta | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRecentRaces = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manager-results', {
        body: {
          action: 'recent_races',
          saison_id: saisonId || null,
          phase_id: phaseId || null,
          limit: 20,
        },
      });

      if (error) throw error;

      setRaces(data.races || []);
      setFiltersMeta(data.filters_meta);
      
      // Auto-select first race
      if (data.races?.length > 0 && !selectedCourseId) {
        setSelectedCourseId(data.races[0].course_id);
      }
    } catch (error: any) {
      console.error('Error loading races:', error);
      toast.error(error.message || "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecentRaces();
  }, [saisonId, phaseId]);

  const filteredRaces = search
    ? races.filter(r => r.nom.toLowerCase().includes(search.toLowerCase()))
    : races;

  const availablePhases = filtersMeta?.phases.filter(p => 
    !saisonId || p.saison_id === saisonId
  ) || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Résultats des courses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Select value={saisonId} onValueChange={setSaisonId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Toutes les saisons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Toutes les saisons</SelectItem>
                {filtersMeta?.saisons.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.annee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={phaseId} onValueChange={setPhaseId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Toutes les phases" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Toutes les phases</SelectItem>
                {availablePhases.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    Phase {p.index_dans_saison} ({p.date_debut} → {p.date_fin})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Rechercher une course..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentRacesList
          races={filteredRaces}
          selectedCourseId={selectedCourseId}
          onSelectCourse={setSelectedCourseId}
          loading={loading}
        />

        {selectedCourseId && (
          <CourseResultsDetail courseId={selectedCourseId} />
        )}
      </div>
    </div>
  );
};
