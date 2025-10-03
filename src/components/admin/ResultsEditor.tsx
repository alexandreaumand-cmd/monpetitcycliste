import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { History, Save, RotateCcw, Trash2 } from "lucide-react";
import { ResultsEditorFilters } from "./ResultsEditorFilters";
import { ResultsEditorTable } from "./ResultsEditorTable";
import { ResultHistoryDrawer } from "./ResultHistoryDrawer";

export const ResultsEditor = () => {
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [typeClassement, setTypeClassement] = useState<string>("Etape");
  const [etapeNumero, setEtapeNumero] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [editedResults, setEditedResults] = useState<Map<string, any>>(new Map());
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Fetch results
  const { data: results, isLoading } = useQuery({
    queryKey: ['race-results-editor', selectedCourse, typeClassement, etapeNumero, search],
    queryFn: async () => {
      if (!selectedCourse) return [];

      const { data, error } = await supabase.functions.invoke('manage-race-results', {
        body: {
          action: 'list_results',
          course_id: selectedCourse,
          type_classement: typeClassement,
          etape_numero: etapeNumero,
          search
        }
      });

      if (error) throw error;
      return data.results || [];
    },
    enabled: !!selectedCourse
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: any[]) => {
      const { data, error } = await supabase.functions.invoke('manage-race-results', {
        body: {
          action: 'bulk_update',
          rows: updates
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.errors?.length > 0) {
        toast.error(`${data.errors.length} erreur(s) lors de la mise à jour`);
        data.errors.forEach((err: any) => {
          console.error('Update error:', err);
        });
      }
      toast.success(`${data.results?.length || 0} résultat(s) mis à jour`);
      setEditedResults(new Map());
      setSelectedResults(new Set());
      queryClient.invalidateQueries({ queryKey: ['race-results-editor'] });
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    }
  });

  const handleEdit = (resultId: string, field: string, value: any) => {
    const current = editedResults.get(resultId) || {};
    const updated = { ...current, [field]: value };
    
    // Normalize: if not finished, clear position
    if (field === 'new_statut' && value !== 'finished') {
      updated.new_position = null;
    }
    
    setEditedResults(new Map(editedResults.set(resultId, updated)));
  };

  const handleSaveAll = () => {
    const updates = Array.from(editedResults.entries()).map(([race_result_id, changes]) => ({
      race_result_id,
      ...changes
    }));

    if (updates.length === 0) {
      toast.info("Aucune modification à enregistrer");
      return;
    }

    updateMutation.mutate(updates);
  };

  const handleShowHistory = (resultId: string) => {
    setSelectedResultId(resultId);
    setHistoryDrawerOpen(true);
  };

  const hasChanges = editedResults.size > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Éditeur de résultats</CardTitle>
            {hasChanges && (
              <Badge variant="secondary" className="animate-pulse">
                {editedResults.size} modification(s) en attente
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ResultsEditorFilters
            selectedCourse={selectedCourse}
            onCourseChange={setSelectedCourse}
            typeClassement={typeClassement}
            onTypeClassementChange={setTypeClassement}
            etapeNumero={etapeNumero}
            onEtapeNumeroChange={setEtapeNumero}
            search={search}
            onSearchChange={setSearch}
          />

          {selectedCourse && (
            <>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSaveAll}
                  disabled={!hasChanges || updateMutation.isPending}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  Enregistrer tout ({editedResults.size})
                </Button>
              </div>

              <ResultsEditorTable
                results={results || []}
                isLoading={isLoading}
                editedResults={editedResults}
                onEdit={handleEdit}
                onShowHistory={handleShowHistory}
                selectedResults={selectedResults}
                onToggleSelection={(id) => {
                  const newSet = new Set(selectedResults);
                  if (newSet.has(id)) {
                    newSet.delete(id);
                  } else {
                    newSet.add(id);
                  }
                  setSelectedResults(newSet);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>

      {selectedResultId && (
        <ResultHistoryDrawer
          open={historyDrawerOpen}
          onOpenChange={setHistoryDrawerOpen}
          resultId={selectedResultId}
          onRevert={() => {
            queryClient.invalidateQueries({ queryKey: ['race-results-editor'] });
          }}
        />
      )}
    </div>
  );
};
