import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Link as LinkIcon, Trash2, X } from "lucide-react";
import { useState } from "react";
import { CreateRiderDialog } from "./CreateRiderDialog";
import { MatchRiderDialog } from "./MatchRiderDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

interface StartlistEntriesTableProps {
  entries: any[];
  saisonId?: string;
  onUpdate: () => void;
}

export const StartlistEntriesTable = ({ entries, saisonId, onUpdate }: StartlistEntriesTableProps) => {
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [matchingEntry, setMatchingEntry] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map(e => e.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('startlist_entries')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      toast.success(`${selectedIds.size} entrée(s) supprimée(s)`);
      setSelectedIds(new Set());
      setShowDeleteDialog(false);
      onUpdate();
    } catch (error: any) {
      toast.error("Erreur lors de la suppression: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      parsed: 'secondary',
      confirmed: 'default',
      unmatched: 'destructive',
      off_roster: 'outline',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Aucune entrée trouvée avec ces filtres
      </div>
    );
  }

  return (
    <>
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-muted rounded-lg mb-4">
          <span className="text-sm font-medium">
            {selectedIds.size} entrée(s) sélectionnée(s)
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            <X className="h-4 w-4 mr-1" />
            Annuler
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Supprimer
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={selectedIds.size === entries.length && entries.length > 0}
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            <TableHead>Nom source</TableHead>
            <TableHead>Équipe source</TableHead>
            <TableHead>Coureur matché</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Startlist</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.has(entry.id)}
                  onCheckedChange={() => toggleSelection(entry.id)}
                />
              </TableCell>
              <TableCell className="font-medium">{entry.source_name}</TableCell>
              <TableCell>
                <Badge variant="outline">{entry.source_team || 'N/A'}</Badge>
              </TableCell>
              <TableCell>
                {entry.coureurs ? (
                  <span className="text-sm">{entry.coureurs.nom}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">Non matché</span>
                )}
              </TableCell>
              <TableCell>{getStatusBadge(entry.status)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {entry.startlist_imports?.courses?.nom || 'N/A'}
              </TableCell>
              <TableCell className="text-right space-x-2">
                {!entry.coureur_id && (
                  <>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => setSelectedEntry(entry)}
                      disabled={!saisonId}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Créer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setMatchingEntry(entry)}
                      disabled={!saisonId}
                    >
                      <LinkIcon className="h-4 w-4 mr-1" />
                      Matcher
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedEntry && (
        <CreateRiderDialog
          entry={selectedEntry}
          saisonId={saisonId!}
          onClose={() => setSelectedEntry(null)}
          onSuccess={() => {
            setSelectedEntry(null);
            onUpdate();
          }}
        />
      )}

      {matchingEntry && (
        <MatchRiderDialog
          entry={matchingEntry}
          saisonId={saisonId!}
          onClose={() => setMatchingEntry(null)}
          onSuccess={() => {
            setMatchingEntry(null);
            onUpdate();
          }}
        />
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {selectedIds.size} entrée(s) ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
