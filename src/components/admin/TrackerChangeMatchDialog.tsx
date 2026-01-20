import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Check, User, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";

interface TrackerChange {
  id: string;
  rider_name: string;
  team_name: string | null;
  course_name: string;
  course_id: string | null;
  coureur_id: string | null;
  change_type: string;
}

interface TrackerChangeMatchDialogProps {
  change: TrackerChange | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TrackerChangeMatchDialog = ({
  change,
  open,
  onOpenChange,
}: TrackerChangeMatchDialogProps) => {
  const queryClient = useQueryClient();
  const [riderSearch, setRiderSearch] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [debouncedRiderSearch] = useDebounce(riderSearch, 300);
  const [debouncedCourseSearch] = useDebounce(courseSearch, 300);
  const [selectedRider, setSelectedRider] = useState<{ id: string; nom: string } | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<{ id: string; nom: string } | null>(null);

  // Get current season
  const { data: currentSeason } = useQuery({
    queryKey: ["current-season-2026"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saisons")
        .select("id, annee")
        .eq("annee", 2026)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Search riders
  const { data: riderResults, isLoading: ridersLoading } = useQuery({
    queryKey: ["search-riders-matching", debouncedRiderSearch, currentSeason?.id],
    queryFn: async () => {
      if (!debouncedRiderSearch || debouncedRiderSearch.length < 2 || !currentSeason?.id) return [];
      const { data, error } = await supabase.rpc("search_riders_for_matching", {
        p_saison_id: currentSeason.id,
        p_query: debouncedRiderSearch,
        p_limit: 10,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: debouncedRiderSearch.length >= 2 && !!currentSeason?.id,
  });

  // Search courses
  const { data: courseResults, isLoading: coursesLoading } = useQuery({
    queryKey: ["search-courses-matching", debouncedCourseSearch],
    queryFn: async () => {
      if (!debouncedCourseSearch || debouncedCourseSearch.length < 2) return [];
      const { data, error } = await supabase.rpc("search_course_by_name", {
        p_search: debouncedCourseSearch,
        p_limit: 10,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: debouncedCourseSearch.length >= 2,
  });

  // Match mutation
  const matchMutation = useMutation({
    mutationFn: async () => {
      if (!change) throw new Error("No change selected");

      const updates: Record<string, unknown> = {
        processed: true,
        processed_at: new Date().toISOString(),
      };

      if (selectedRider) {
        updates.coureur_id = selectedRider.id;
      }
      if (selectedCourse) {
        updates.course_id = selectedCourse.id;
      }

      const { error } = await supabase
        .from("startlist_tracker_changes")
        .update(updates)
        .eq("id", change.id);

      if (error) throw error;

      // If we have both rider and course matched, add to startlist_entries
      if (selectedRider && selectedCourse && change.change_type === "added") {
        // Find or create startlist import for this course
        let { data: imports } = await supabase
          .from("startlist_imports")
          .select("id")
          .eq("race_id", selectedCourse.id)
          .order("created_at", { ascending: false })
          .limit(1);

        let startlistId: string;
        
        if (!imports || imports.length === 0) {
          // Get the saison_id from the course via phase
          const { data: courseData } = await supabase
            .from("courses")
            .select("phase_id, phases!inner(saison_id)")
            .eq("id", selectedCourse.id)
            .single();
          
          const saisonId = (courseData?.phases as unknown as { saison_id: string })?.saison_id;
          
          if (!saisonId) {
            throw new Error("Impossible de déterminer la saison pour cette course");
          }
          
          // Create a new startlist import for this course
          const { data: newImport, error: importError } = await supabase
            .from("startlist_imports")
            .insert({
              race_id: selectedCourse.id,
              file_url: `https://www.procyclingstats.com/race/${selectedCourse.id}`,
              saison_id: saisonId,
            })
            .select()
            .single();

          if (importError) {
            console.error("Failed to create startlist import:", importError);
            throw new Error(`Impossible de créer le startlist import: ${importError.message}`);
          }
          startlistId = newImport.id;
        } else {
          startlistId = imports[0].id;
        }

        // Check if entry exists
        const { data: existing } = await supabase
          .from("startlist_entries")
          .select("id")
          .eq("startlist_id", startlistId)
          .eq("coureur_id", selectedRider.id)
          .limit(1);

        if (!existing || existing.length === 0) {
          // Get max line_no for this startlist
          const { data: maxLine } = await supabase
            .from("startlist_entries")
            .select("line_no")
            .eq("startlist_id", startlistId)
            .order("line_no", { ascending: false })
            .limit(1);
          
          const nextLineNo = (maxLine?.[0]?.line_no || 0) + 1;

          const { error: entryError } = await supabase.from("startlist_entries").insert([{
            startlist_id: startlistId,
            line_no: nextLineNo,
            source_name: change.rider_name,
            source_team: change.team_name,
            coureur_id: selectedRider.id,
            confidence: 1.0,
            status: "confirmed" as const,
          }]);

          if (entryError) {
            console.error("Failed to insert entry:", entryError);
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("Changement validé avec succès");
      queryClient.invalidateQueries({ queryKey: ["startlist-tracker-changes"] });
      onOpenChange(false);
      resetState();
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Ignore mutation
  const ignoreMutation = useMutation({
    mutationFn: async () => {
      if (!change) throw new Error("No change selected");

      const { error } = await supabase
        .from("startlist_tracker_changes")
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq("id", change.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Changement ignoré");
      queryClient.invalidateQueries({ queryKey: ["startlist-tracker-changes"] });
      onOpenChange(false);
      resetState();
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const resetState = () => {
    setRiderSearch("");
    setCourseSearch("");
    setSelectedRider(null);
    setSelectedCourse(null);
  };

  // Reset when dialog opens with new change
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && change) {
      setRiderSearch(change.rider_name);
      setCourseSearch(change.course_name);
      setSelectedRider(null);
      setSelectedCourse(null);
    }
    onOpenChange(isOpen);
  };

  if (!change) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Valider le changement</DialogTitle>
          <DialogDescription>
            Liez manuellement ce coureur et cette course à la base de données
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Change info */}
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={change.change_type === "added" ? "default" : "destructive"}>
                {change.change_type === "added" ? "Ajout" : "Retrait"}
              </Badge>
            </div>
            <p className="font-medium">{change.rider_name}</p>
            <p className="text-sm text-muted-foreground">{change.team_name || "Équipe inconnue"}</p>
            <p className="text-sm text-muted-foreground">{change.course_name}</p>
          </div>

          {/* Rider search */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Coureur
            </Label>
            
            {selectedRider ? (
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-primary/10 border-primary/30">
                <Check className="h-4 w-4 text-primary" />
                <span className="font-medium">{selectedRider.nom}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedRider(null)}
                  className="ml-auto"
                >
                  Changer
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un coureur..."
                    value={riderSearch}
                    onChange={(e) => setRiderSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {ridersLoading && (
                  <div className="flex justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                )}
                
                {riderResults && riderResults.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                    {riderResults.map((rider: { coureur_id: string; coureur_nom: string; equipe_nom: string }) => (
                      <button
                        key={rider.coureur_id}
                        className="w-full px-3 py-2 text-left hover:bg-accent flex justify-between items-center"
                        onClick={() => setSelectedRider({ id: rider.coureur_id, nom: rider.coureur_nom })}
                      >
                        <span className="font-medium">{rider.coureur_nom}</span>
                        <span className="text-sm text-muted-foreground">{rider.equipe_nom}</span>
                      </button>
                    ))}
                  </div>
                )}
                
                {riderResults && riderResults.length === 0 && debouncedRiderSearch.length >= 2 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Aucun coureur trouvé
                  </p>
                )}
              </>
            )}
          </div>

          {/* Course search */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Course
            </Label>
            
            {selectedCourse ? (
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-primary/10 border-primary/30">
                <Check className="h-4 w-4 text-primary" />
                <span className="font-medium">{selectedCourse.nom}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCourse(null)}
                  className="ml-auto"
                >
                  Changer
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher une course..."
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {coursesLoading && (
                  <div className="flex justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                )}
                
                {courseResults && courseResults.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                    {courseResults.map((course: { id: string; nom: string; date_debut: string }) => (
                      <button
                        key={course.id}
                        className="w-full px-3 py-2 text-left hover:bg-accent flex justify-between items-center"
                        onClick={() => setSelectedCourse({ id: course.id, nom: course.nom })}
                      >
                        <span className="font-medium">{course.nom}</span>
                        <span className="text-sm text-muted-foreground">{course.date_debut}</span>
                      </button>
                    ))}
                  </div>
                )}
                
                {courseResults && courseResults.length === 0 && debouncedCourseSearch.length >= 2 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Aucune course trouvée
                  </p>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => ignoreMutation.mutate()}
              disabled={ignoreMutation.isPending}
            >
              {ignoreMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ignorer
            </Button>
            <Button
              onClick={() => matchMutation.mutate()}
              disabled={matchMutation.isPending || (!selectedRider && !selectedCourse)}
            >
              {matchMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Valider
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
