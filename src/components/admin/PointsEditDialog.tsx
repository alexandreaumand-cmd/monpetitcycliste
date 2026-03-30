import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { PointsLedgerRow } from "@/hooks/usePointsLedgerFilters";

interface PointsEditDialogProps {
  editDialogOpen: boolean;
  setEditDialogOpen: (open: boolean) => void;
  selectedEntry: PointsLedgerRow | null;
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (open: boolean) => void;
  entryToDelete: PointsLedgerRow | null;
}

export const usePointsEditState = () => {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<PointsLedgerRow | null>(null);
  const [newPoints, setNewPoints] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<PointsLedgerRow | null>(null);

  const handleEdit = (entry: PointsLedgerRow) => {
    setSelectedEntry(entry);
    setNewPoints(entry.points);
    setEditDialogOpen(true);
  };

  const handleDelete = (entry: PointsLedgerRow) => {
    setEntryToDelete(entry);
    setDeleteDialogOpen(true);
  };

  return {
    editDialogOpen, setEditDialogOpen,
    selectedEntry, setSelectedEntry,
    newPoints, setNewPoints,
    deleteDialogOpen, setDeleteDialogOpen,
    entryToDelete, setEntryToDelete,
    handleEdit, handleDelete,
  };
};

export const PointsEditDialog = ({
  editDialogOpen,
  setEditDialogOpen,
  selectedEntry,
  deleteDialogOpen,
  setDeleteDialogOpen,
  entryToDelete,
}: PointsEditDialogProps & { newPoints: number; setNewPoints: (v: number) => void }) => {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async ({ id, points }: { id: string; points: number }) => {
      const { error } = await supabase.from("points_ledger").update({ points }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["points-ledger-table"] });
      toast.success("Points mis à jour avec succès");
      setEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Erreur lors de la mise à jour");
      console.error(error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("points_ledger").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["points-ledger-table"] });
      toast.success("Entrée supprimée avec succès");
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    },
  });

  // These are passed via the parent's render props pattern — we need them as props
  // But since this component uses internal mutations, we handle submit/confirm here
  // The parent must pass newPoints/setNewPoints

  return null; // This component is used inline — see below
};

// Actual rendered dialogs as a standalone component
export const PointsDialogs = ({
  editDialogOpen,
  setEditDialogOpen,
  selectedEntry,
  newPoints,
  setNewPoints,
  deleteDialogOpen,
  setDeleteDialogOpen,
  entryToDelete,
}: {
  editDialogOpen: boolean;
  setEditDialogOpen: (open: boolean) => void;
  selectedEntry: PointsLedgerRow | null;
  newPoints: number;
  setNewPoints: (v: number) => void;
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (open: boolean) => void;
  entryToDelete: PointsLedgerRow | null;
}) => {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async ({ id, points }: { id: string; points: number }) => {
      const { error } = await supabase.from("points_ledger").update({ points }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["points-ledger-table"] });
      toast.success("Points mis à jour avec succès");
      setEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Erreur lors de la mise à jour");
      console.error(error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("points_ledger").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["points-ledger-table"] });
      toast.success("Entrée supprimée avec succès");
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    },
  });

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry) return;
    updateMutation.mutate({ id: selectedEntry.id, points: newPoints });
  };

  const handleConfirmDelete = () => {
    if (!entryToDelete) return;
    deleteMutation.mutate(entryToDelete.id);
  };

  return (
    <>
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Modifier les points</DialogTitle>
            <DialogDescription>
              Modifiez les points attribués pour cette entrée
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <>
              <div className="space-y-2 text-sm">
                <div><strong>Coureur:</strong> {selectedEntry.coureur_nom} ({selectedEntry.equipe_nom || "—"})</div>
                <div><strong>Course:</strong> {selectedEntry.course_nom}</div>
                <div><strong>Type:</strong> {selectedEntry.type_classement}</div>
                {selectedEntry.etape_numero && <div><strong>Étape:</strong> {selectedEntry.etape_numero}</div>}
              </div>

              <Separator />

              <form onSubmit={handleSubmitEdit}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="points">Points</Label>
                    <Input
                      id="points"
                      type="number"
                      value={newPoints}
                      onChange={(e) => setNewPoints(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Enregistrer</Button>
                  </DialogFooter>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr(e) ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette entrée ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
