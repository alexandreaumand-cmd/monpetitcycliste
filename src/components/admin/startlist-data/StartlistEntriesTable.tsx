import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Link as LinkIcon, Trash2, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useState, useMemo } from "react";
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

type SortColumn = 'source_name' | 'source_team' | 'coureur' | 'status' | 'startlist' | null;
type SortDirection = 'asc' | 'desc' | null;

export const StartlistEntriesTable = ({ entries, saisonId, onUpdate }: StartlistEntriesTableProps) => {
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [matchingEntry, setMatchingEntry] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Cycle: desc -> asc -> null
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else if (sortDirection === 'asc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="h-4 w-4 ml-1" />;
    }
    return <ArrowUp className="h-4 w-4 ml-1" />;
  };

  const sortedEntries = useMemo(() => {
    if (!sortColumn || !sortDirection) return entries;

    return [...entries].sort((a, b) => {
      let aVal: string = '';
      let bVal: string = '';

      switch (sortColumn) {
        case 'source_name':
          aVal = a.source_name || '';
          bVal = b.source_name || '';
          break;
        case 'source_team':
          aVal = a.source_team || '';
          bVal = b.source_team || '';
          break;
        case 'coureur':
          aVal = a.coureurs?.nom || '';
          bVal = b.coureurs?.nom || '';
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        case 'startlist':
          aVal = a.startlist_imports?.courses?.nom || '';
          bVal = b.startlist_imports?.courses?.nom || '';
          break;
      }

      const comparison = aVal.localeCompare(bVal, 'fr', { sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [entries, sortColumn, sortDirection]);

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

  const SortableHeader = ({ column, children }: { column: SortColumn; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center">
        {children}
        {getSortIcon(column)}
      </div>
    </TableHead>
  );

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

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedIds.size === entries.length && entries.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <SortableHeader column="source_name">Nom source</SortableHeader>
              <SortableHeader column="source_team">Équipe source</SortableHeader>
              <SortableHeader column="coureur">Coureur matché</SortableHeader>
              <SortableHeader column="status">Statut</SortableHeader>
              <SortableHeader column="startlist">Startlist</SortableHeader>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEntries.map((entry) => (
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
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Checkbox
            checked={selectedIds.size === entries.length && entries.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-xs text-muted-foreground">Tout sélectionner</span>
        </div>
        {sortedEntries.map((entry) => (
          <div key={entry.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Checkbox
                checked={selectedIds.has(entry.id)}
                onCheckedChange={() => toggleSelection(entry.id)}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{entry.source_name}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className="text-xs">{entry.source_team || 'N/A'}</Badge>
                  {getStatusBadge(entry.status)}
                </div>
                {entry.coureurs ? (
                  <div className="text-xs text-muted-foreground mt-1">→ {entry.coureurs.nom}</div>
                ) : null}
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  {entry.startlist_imports?.courses?.nom || ''}
                </div>
              </div>
            </div>
            {!entry.coureur_id && (
              <div className="flex gap-2 pl-8">
                <Button
                  size="sm"
                  variant="default"
                  className="flex-1"
                  onClick={() => setSelectedEntry(entry)}
                  disabled={!saisonId}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Créer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setMatchingEntry(entry)}
                  disabled={!saisonId}
                >
                  <LinkIcon className="h-4 w-4 mr-1" />
                  Matcher
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

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
