import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import { CreateRiderDialog } from "./CreateRiderDialog";
import { MatchRiderDialog } from "./MatchRiderDialog";

interface StartlistEntriesTableProps {
  entries: any[];
  saisonId?: string;
  onUpdate: () => void;
}

export const StartlistEntriesTable = ({ entries, saisonId, onUpdate }: StartlistEntriesTableProps) => {
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [matchingEntry, setMatchingEntry] = useState<any>(null);

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
      <Table>
        <TableHeader>
          <TableRow>
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
    </>
  );
};
