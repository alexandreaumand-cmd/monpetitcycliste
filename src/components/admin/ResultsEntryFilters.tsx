import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  courseId: string | null;
  setCourseId: (id: string | null) => void;
  typeClassement: string;
  setTypeClassement: (type: string) => void;
  etapeNumero: number | null;
  setEtapeNumero: (num: number | null) => void;
  search: string;
  setSearch: (s: string) => void;
}

export const ResultsEntryFilters = ({
  courseId,
  setCourseId,
  typeClassement,
  setTypeClassement,
  etapeNumero,
  setEtapeNumero,
  search,
  setSearch,
}: Props) => {
  const [saisons, setSaisons] = useState<any[]>([]);
  const [phases, setPhases] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedSaison, setSelectedSaison] = useState<string | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);

  useEffect(() => {
    loadSaisons();
  }, []);

  useEffect(() => {
    if (selectedSaison) {
      loadPhases(selectedSaison);
    } else {
      setPhases([]);
      setSelectedPhase(null);
    }
  }, [selectedSaison]);

  useEffect(() => {
    if (selectedPhase) {
      loadCourses(selectedPhase);
    } else {
      setCourses([]);
      setCourseId(null);
    }
  }, [selectedPhase]);

  const loadSaisons = async () => {
    const { data } = await supabase
      .from('saisons')
      .select('id, annee')
      .order('annee', { ascending: false });
    setSaisons(data || []);
  };

  const loadPhases = async (saisonId: string) => {
    const { data } = await supabase
      .from('phases')
      .select('id, index_dans_saison, date_debut, date_fin')
      .eq('saison_id', saisonId)
      .order('index_dans_saison');
    setPhases(data || []);
  };

  const loadCourses = async (phaseId: string) => {
    const { data } = await supabase
      .from('courses')
      .select('id, nom')
      .eq('phase_id', phaseId)
      .order('date_debut');
    setCourses(data || []);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <div>
        <Label>Saison</Label>
        <Select value={selectedSaison || undefined} onValueChange={setSelectedSaison}>
          <SelectTrigger>
            <SelectValue placeholder="Saison" />
          </SelectTrigger>
          <SelectContent>
            {saisons.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.annee}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Phase</Label>
        <Select value={selectedPhase || undefined} onValueChange={setSelectedPhase} disabled={!selectedSaison}>
          <SelectTrigger>
            <SelectValue placeholder="Phase" />
          </SelectTrigger>
          <SelectContent>
            {phases.map(p => (
              <SelectItem key={p.id} value={p.id}>
                Phase {p.index_dans_saison} ({p.date_debut} - {p.date_fin})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Course</Label>
        <Select value={courseId || undefined} onValueChange={setCourseId} disabled={!selectedPhase}>
          <SelectTrigger>
            <SelectValue placeholder="Course" />
          </SelectTrigger>
          <SelectContent>
            {courses.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Type</Label>
        <Select value={typeClassement} onValueChange={setTypeClassement}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Etape">Etape</SelectItem>
            <SelectItem value="General">General</SelectItem>
            <SelectItem value="Points">Points</SelectItem>
            <SelectItem value="Montagne">Montagne</SelectItem>
            <SelectItem value="Jeune">Jeune</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {typeClassement === "Etape" && (
        <div>
          <Label># Étape</Label>
          <Input
            type="number"
            min="1"
            value={etapeNumero || ""}
            onChange={(e) => setEtapeNumero(e.target.value ? parseInt(e.target.value) : null)}
            placeholder="Numéro"
          />
        </div>
      )}

      <div>
        <Label>Recherche coureur</Label>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nom du coureur"
        />
      </div>
    </div>
  );
};
