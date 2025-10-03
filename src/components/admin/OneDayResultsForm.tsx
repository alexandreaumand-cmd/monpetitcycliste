import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiderAutocomplete } from "./RiderAutocomplete";
import { toast } from "@/hooks/use-toast";
import { X, Save, AlertCircle, CheckCircle2 } from "lucide-react";

type OneDayCourse = {
  course_id: string;
  course_nom: string;
  categorie: string;
  date_debut: string;
  date_fin: string;
  phase_id: string;
  has_results: boolean;
};

type ResultStatut = "finished" | "dnf" | "dns" | "dsq";

type ResultRow = {
  position: number;
  coureur_id: string | null;
  coureur_nom: string | null;
  equipe: string | null;
  statut: ResultStatut;
  points: number;
};

type OneDayResultsFormProps = {
  course: OneDayCourse;
  onClose: () => void;
};

export const OneDayResultsForm = ({ course, onClose }: OneDayResultsFormProps) => {
  const queryClient = useQueryClient();
  const [resultRows, setResultRows] = useState<ResultRow[]>([]);
  const [missingBareme, setMissingBareme] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch scoring rules for this category
  const { data: scoringRules } = useQuery({
    queryKey: ['scoring-rules', course.categorie],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scoring_rules')
        .select('place, points')
        .eq('categorie', course.categorie.toLowerCase())
        .eq('type_classement', 'General')
        .order('place');
      
      if (error) throw error;
      
      const rulesMap: Record<number, number> = {};
      data?.forEach(rule => {
        rulesMap[rule.place] = rule.points;
      });
      
      return rulesMap;
    },
  });

  // Fetch existing results if any
  const { data: existingResults } = useQuery({
    queryKey: ['oneday-results', course.course_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('race_results')
        .select(`
          position,
          coureur_id,
          statut,
          coureurs!inner(nom, equipe)
        `)
        .eq('course_id', course.course_id)
        .eq('type_classement', 'General')
        .order('position');
      
      if (error) throw error;
      
      return data?.map(r => ({
        position: r.position || 0,
        coureur_id: r.coureur_id,
        coureur_nom: (r.coureurs as any)?.nom || null,
        equipe: (r.coureurs as any)?.equipe || null,
        statut: r.statut as ResultStatut,
        points: 0
      })) || [];
    },
    enabled: course.has_results,
  });

  // Initialize grid based on scoring rules or existing results
  useEffect(() => {
    if (!scoringRules) return;

    if (course.has_results && existingResults) {
      // Pre-fill with existing results
      const rows = existingResults.map(r => ({
        ...r,
        points: scoringRules[r.position] || 0
      }));
      setResultRows(rows);
    } else {
      // Create empty grid based on scoring rules
      const maxPlace = Math.max(...Object.keys(scoringRules).map(Number));
      const rows: ResultRow[] = [];
      for (let i = 1; i <= maxPlace; i++) {
        rows.push({
          position: i,
          coureur_id: null,
          coureur_nom: null,
          equipe: null,
          statut: 'finished',
          points: scoringRules[i] || 0
        });
      }
      setResultRows(rows);
    }
  }, [scoringRules, existingResults, course.has_results]);

  // Validate bareme
  useEffect(() => {
    if (!scoringRules) return;

    const missing: number[] = [];
    resultRows.forEach(row => {
      if (row.coureur_id && !scoringRules[row.position]) {
        missing.push(row.position);
      }
    });
    setMissingBareme(missing);
  }, [resultRows, scoringRules]);

  const handleRiderChange = (position: number, riderId: string | null, riderName: string | null) => {
    setResultRows(prev => prev.map(row => {
      if (row.position === position) {
        // Fetch team info
        if (riderId) {
          supabase
            .from('coureurs')
            .select('equipe')
            .eq('id', riderId)
            .single()
            .then(({ data }) => {
              setResultRows(current => current.map(r => 
                r.position === position 
                  ? { ...r, coureur_id: riderId, coureur_nom: riderName, equipe: data?.equipe || null }
                  : r
              ));
            });
        }
        return { ...row, coureur_id: riderId, coureur_nom: riderName };
      }
      return row;
    }));
  };

  const handleStatutChange = (position: number, statut: ResultStatut) => {
    setResultRows(prev => prev.map(row => 
      row.position === position ? { ...row, statut } : row
    ));
  };

  const handleSave = async () => {
    if (missingBareme.length > 0) {
      toast({
        title: "Barème manquant",
        description: `Les places suivantes n'ont pas de barème défini : ${missingBareme.join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    // Check for duplicates
    const riderIds = resultRows.filter(r => r.coureur_id).map(r => r.coureur_id);
    const uniqueIds = new Set(riderIds);
    if (riderIds.length !== uniqueIds.size) {
      toast({
        title: "Erreur",
        description: "Un coureur apparaît plusieurs fois dans les résultats",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);

    try {
      // Call edge function to save results (will handle DELETE + INSERT + points calculation)
      const rowsToSave = resultRows
        .filter(row => row.coureur_id)
        .map(row => ({
          coureur_id: row.coureur_id,
          position: row.position,
          statut: row.statut
        }));

      const { data, error } = await supabase.functions.invoke('admin-oneday-save', {
        body: {
          course_id: course.course_id,
          rows: rowsToSave
        }
      });

      if (error) throw error;

      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: ['oneday-courses'] });
      queryClient.invalidateQueries({ queryKey: ['oneday-results', course.course_id] });
      queryClient.invalidateQueries({ queryKey: ['manager-standings'] });
      queryClient.invalidateQueries({ queryKey: ['top-riders'] });

      toast({
        title: "✅ Résultats enregistrés",
        description: `${rowsToSave.length} attributions créées`,
      });

      onClose();
    } catch (error) {
      console.error('Error saving results:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer les résultats",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filledCount = resultRows.filter(r => r.coureur_id).length;
  const totalCount = resultRows.length;
  const canSave = filledCount > 0 && missingBareme.length === 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="space-y-2">
            <DialogTitle className="flex items-center gap-2">
              {course.course_nom}
            </DialogTitle>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">{course.categorie}</Badge>
              <Badge variant="outline">One-day</Badge>
              <Badge variant="outline">
                {filledCount} / {totalCount} lignes remplies
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {missingBareme.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Barème manquant pour les places : {missingBareme.join(', ')}
            </AlertDescription>
          </Alert>
        )}

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Place</TableHead>
                <TableHead className="w-20">Points</TableHead>
                <TableHead>Coureur</TableHead>
                <TableHead>Équipe</TableHead>
                <TableHead className="w-32">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultRows.map((row) => (
                <TableRow key={row.position}>
                  <TableCell className="font-medium">{row.position}</TableCell>
                  <TableCell>{row.points}</TableCell>
                  <TableCell>
                    <RiderAutocomplete
                      phaseId={course.phase_id}
                      value={row.coureur_id}
                      riderName={row.coureur_nom}
                      onChange={(riderId, riderName) => handleRiderChange(row.position, riderId, riderName)}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.equipe}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.statut}
                      onValueChange={(value) => handleStatutChange(row.position, value as ResultStatut)}
                      disabled={!row.coureur_id}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="finished">Finished</SelectItem>
                        <SelectItem value="dnf">DNF</SelectItem>
                        <SelectItem value="dns">DNS</SelectItem>
                        <SelectItem value="dsq">DSQ</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Enregistrement...' : 'Sauvegarder'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
