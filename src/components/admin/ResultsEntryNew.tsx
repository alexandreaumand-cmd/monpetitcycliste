import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResultsEntryFilters } from "./ResultsEntryFilters";
import { ResultsEntryTable } from "./ResultsEntryTable";
import { ResultsEntryActions } from "./ResultsEntryActions";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface RaceResult {
  race_result_id: string;
  course_id: string;
  type_classement: string;
  etape_numero?: number;
  coureur_id: string;
  coureur_nom: string;
  equipe: string;
  position: number | null;
  statut: 'finished' | 'dnf' | 'dns' | 'dsq';
  points_calcules?: number;
  last_updated_at?: string;
  last_updated_by?: string;
}

export interface CourseMeta {
  nom: string;
  date_debut: string;
  date_fin: string;
  categorie: string;
  type_course: string;
}

export const ResultsEntryNew = () => {
  const [courseId, setCourseId] = useState<string | null>(null);
  const [typeClassement, setTypeClassement] = useState<string>("Etape");
  const [etapeNumero, setEtapeNumero] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  
  const [rowsBase, setRowsBase] = useState<RaceResult[]>([]);
  const [rowsEdit, setRowsEdit] = useState<RaceResult[]>([]);
  const [courseMeta, setCourseMeta] = useState<CourseMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const pendingCount = rowsEdit.filter((editRow, idx) => {
    const baseRow = rowsBase[idx];
    return editRow.position !== baseRow.position || editRow.statut !== baseRow.statut;
  }).length;

  const isDirty = pendingCount > 0;

  const handleLoadResults = async () => {
    if (!courseId || !typeClassement) {
      toast.error("Sélectionne une course et un type de classement");
      return;
    }

    if (typeClassement === "Etape" && !etapeNumero) {
      toast.error("Numéro d'étape requis pour type Etape");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-results', {
        body: {
          course_id: courseId,
          type_classement: typeClassement,
          etape_numero: typeClassement === "Etape" ? etapeNumero : null,
          search: search.trim() || null,
        },
        method: 'POST',
      });

      if (error) throw error;

      const results = (data.results || []) as RaceResult[];
      setRowsBase(results);
      setRowsEdit(JSON.parse(JSON.stringify(results)));
      setCourseMeta(data.course_meta);
      toast.success(`${data.results?.length || 0} résultats chargés`);
    } catch (error: any) {
      console.error('Error loading results:', error);
      toast.error(error.message || "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const updates = rowsEdit
      .map((editRow, idx) => {
        const baseRow = rowsBase[idx];
        if (editRow.position !== baseRow.position || editRow.statut !== baseRow.statut) {
          return {
            race_result_id: editRow.race_result_id,
            position: editRow.position,
            statut: editRow.statut,
          };
        }
        return null;
      })
      .filter(Boolean);

    if (updates.length === 0) {
      toast.info("Aucun changement à enregistrer");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-results', {
        body: { updates },
        method: 'POST',
      });

      if (error) throw error;

      // Update base with returned data
      const updated = (data.updated || []) as RaceResult[];
      const updatedMap = new Map(updated.map((u: RaceResult) => [u.race_result_id, u]));
      const newBase = rowsBase.map(row => updatedMap.get(row.race_result_id) || row);
      
      setRowsBase(newBase);
      setRowsEdit(JSON.parse(JSON.stringify(newBase)));
      
      toast.success("Modifications enregistrées");
    } catch (error: any) {
      console.error('Error saving:', error);
      toast.error(error.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelAll = () => {
    setRowsEdit(JSON.parse(JSON.stringify(rowsBase)));
    toast.info("Modifications annulées");
  };

  const handleComputePoints = async () => {
    if (isDirty) {
      toast.warning("Enregistre d'abord tes changements");
      return;
    }

    if (!courseId) {
      toast.error("Aucune course sélectionnée");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-results', {
        body: { course_id: courseId },
        method: 'POST',
      });

      if (error) throw error;

      toast.success("Points recalculés");
      console.log('Leaderboard:', data.leaderboard_course);
    } catch (error: any) {
      console.error('Error computing points:', error);
      toast.error(error.message || "Erreur lors du calcul des points");
    }
  };

  const updateRow = (index: number, field: 'position' | 'statut', value: any) => {
    const newRows = [...rowsEdit];
    if (field === 'statut') {
      newRows[index].statut = value;
      if (value !== 'finished') {
        newRows[index].position = null;
      }
    } else {
      newRows[index].position = value;
    }
    setRowsEdit(newRows);
  };

  const resetRow = (index: number) => {
    const newRows = [...rowsEdit];
    newRows[index] = JSON.parse(JSON.stringify(rowsBase[index]));
    setRowsEdit(newRows);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin / Résultats (édition inline + diff)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Les modifications ici affectent le calcul des points après 'Recalculer les points'.
            </AlertDescription>
          </Alert>

          <ResultsEntryFilters
            courseId={courseId}
            setCourseId={setCourseId}
            typeClassement={typeClassement}
            setTypeClassement={setTypeClassement}
            etapeNumero={etapeNumero}
            setEtapeNumero={setEtapeNumero}
            search={search}
            setSearch={setSearch}
          />

          <Button onClick={handleLoadResults} disabled={loading}>
            {loading ? "Chargement..." : "Charger"}
          </Button>

          {courseMeta && (
            <div className="p-4 bg-muted rounded-lg text-sm">
              <div className="font-semibold">{courseMeta.nom}</div>
              <div className="text-muted-foreground">
                {courseMeta.date_debut} → {courseMeta.date_fin} | {courseMeta.categorie} | {courseMeta.type_course}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {rowsEdit.length > 0 && (
        <>
          {isDirty && (
            <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-800 rounded-lg p-3 text-sm">
              <span className="font-semibold">{pendingCount} changements non enregistrés</span>
            </div>
          )}

          <ResultsEntryTable
            rowsBase={rowsBase}
            rowsEdit={rowsEdit}
            updateRow={updateRow}
            resetRow={resetRow}
          />

          <ResultsEntryActions
            isDirty={isDirty}
            pendingCount={pendingCount}
            saving={saving}
            onSave={handleSave}
            onCancelAll={handleCancelAll}
            onComputePoints={handleComputePoints}
          />
        </>
      )}
    </div>
  );
};
