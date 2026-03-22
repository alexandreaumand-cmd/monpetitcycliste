import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Trash2, UserPlus, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddRiderToStartlistDialog } from "./AddRiderToStartlistDialog";

interface Starter {
  coureur_id: string;
  nom: string;
  equipe?: string;
  entry_id?: string;
  team_confirmed?: boolean;
}

interface StartlistRidersManagementProps {
  startlistId: string;
  starters: Starter[];
  saisonId?: string;
  onUpdate: () => void;
}

export const StartlistRidersManagement = ({
  startlistId,
  starters,
  saisonId,
  onUpdate,
}: StartlistRidersManagementProps) => {
  const [deleteCandidate, setDeleteCandidate] = useState<Starter | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const handleDeleteRider = async () => {
    if (!deleteCandidate) return;

    setIsDeleting(true);
    try {
      // First, find the startlist_entry id(s) to delete
      const { data: entries, error: findError } = await supabase
        .from("startlist_entries")
        .select("id")
        .eq("startlist_id", startlistId)
        .eq("coureur_id", deleteCandidate.coureur_id);

      if (findError) throw findError;

      const entryIds = (entries || []).map((e) => e.id);

      // Delete related startlist_tracker_changes that reference these entries
      if (entryIds.length > 0) {
        const { error: trackerError } = await supabase
          .from("startlist_tracker_changes")
          .delete()
          .in("startlist_entry_id", entryIds);

        if (trackerError) throw trackerError;
      }

      // Now delete the startlist_entries
      const { error } = await supabase
        .from("startlist_entries")
        .delete()
        .eq("startlist_id", startlistId)
        .eq("coureur_id", deleteCandidate.coureur_id);

      if (error) throw error;

      toast.success(`${deleteCandidate.nom} retiré de la startlist`);
      setDeleteCandidate(null);
      onUpdate();
    } catch (error: any) {
      toast.error("Erreur lors de la suppression: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmedCount = starters.filter(s => s.team_confirmed).length;
  const uniqueTeams = [...new Set(starters.map(s => s.equipe).filter(Boolean))];
  const confirmedTeams = [...new Set(starters.filter(s => s.team_confirmed).map(s => s.equipe).filter(Boolean))];

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">
              Liste des partants ({starters.length})
            </h3>
            {uniqueTeams.length > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {confirmedTeams.length}/{uniqueTeams.length} équipes confirmées
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddDialog(true)}
            disabled={!saisonId}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Ajouter un coureur
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {starters.map((starter) => (
            <div
              key={starter.coureur_id}
              className="flex items-center gap-2 text-sm py-2 px-3 bg-muted/30 rounded group hover:bg-muted/50 transition-colors"
            >
              <span className="font-medium truncate flex-1 flex items-center gap-1">
                {starter.team_confirmed && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />}
                {starter.nom}
              </span>
              {starter.equipe && (
                <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                  {starter.equipe}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteCandidate(starter)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {starters.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Aucun coureur dans cette startlist
          </div>
        )}
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteCandidate}
        onOpenChange={(open) => !open && setDeleteCandidate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir retirer{" "}
              <span className="font-semibold">{deleteCandidate?.nom}</span> de
              la startlist ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRider}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add rider dialog */}
      <AddRiderToStartlistDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        startlistId={startlistId}
        saisonId={saisonId}
        existingRiderIds={starters.map((s) => s.coureur_id)}
        onSuccess={onUpdate}
      />
    </>
  );
};
