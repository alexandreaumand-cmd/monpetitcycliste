import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Button } from "@/components/ui/button";
import { MoreVertical, Eye, Users, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { League } from "@/lib/leagues/types";

type SuperAdminLeagueActionsProps = {
  league: League;
  onActionComplete: () => void;
};

export function SuperAdminLeagueActions({ league, onActionComplete }: SuperAdminLeagueActionsProps) {
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleArchiveToggle = async () => {
    try {
      const newStatus = league.status === "cancelled" ? "active" : "cancelled";
      const { error } = await supabase
        .from("leagues")
        .update({ 
          status: newStatus,
          archived_at: newStatus === "cancelled" ? new Date().toISOString() : null
        })
        .eq("id", league.id);

      if (error) throw error;

      toast.success(
        newStatus === "cancelled" ? "Ligue archivée" : "Ligue réactivée"
      );
      onActionComplete();
    } catch (error) {
      console.error("Error toggling archive:", error);
      toast.error("Erreur lors de la modification");
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("leagues-delete-full", {
        body: { league_id: league.id },
      });

      if (error) throw error;

      toast.success("Ligue supprimée définitivement");
      setShowDeleteDialog(false);
      onActionComplete();
    } catch (error) {
      console.error("Error deleting league:", error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => navigate(`/dashboard/super-admin/leagues/${league.id}`)}>
            <Eye className="mr-2 h-4 w-4" />
            Voir détails
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate(`/dashboard/super-admin/leagues/${league.id}/members`)}>
            <Users className="mr-2 h-4 w-4" />
            Gérer membres
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleArchiveToggle}>
            {league.status === "cancelled" ? (
              <>
                <ArchiveRestore className="mr-2 h-4 w-4" />
                Désarchiver
              </>
            ) : (
              <>
                <Archive className="mr-2 h-4 w-4" />
                Archiver
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement la ligue ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les données de la ligue "{league.name}" seront
              supprimées définitivement, incluant :
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Tous les membres</li>
                <li>Toutes les invitations</li>
                <li>Tous les paramètres et configurations</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Suppression..." : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
