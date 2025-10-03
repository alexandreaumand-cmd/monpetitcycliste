import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { X } from "lucide-react";
import { RaceResult } from "./ResultsEntryNew";

interface Props {
  rowsBase: RaceResult[];
  rowsEdit: RaceResult[];
  updateRow: (index: number, field: 'position' | 'statut', value: any) => void;
  resetRow: (index: number) => void;
}

export const ResultsEntryTable = ({ rowsBase, rowsEdit, updateRow, resetRow }: Props) => {
  const getDiff = (idx: number, field: 'position' | 'statut') => {
    const base = rowsBase[idx];
    const edit = rowsEdit[idx];
    if (!base || !edit) return null;
    
    if (base[field] !== edit[field]) {
      return {
        before: base[field] === null ? 'null' : String(base[field]),
        after: edit[field] === null ? 'null' : String(edit[field]),
      };
    }
    return null;
  };

  return (
    <TooltipProvider>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Coureur</TableHead>
              <TableHead className="w-24">Position (base)</TableHead>
              <TableHead className="w-32">Statut (base)</TableHead>
              <TableHead className="w-32">Position (éditer)</TableHead>
              <TableHead className="w-40">Statut (éditer)</TableHead>
              <TableHead className="w-20">Points</TableHead>
              <TableHead className="w-40">Maj</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowsEdit.map((row, idx) => {
              const positionDiff = getDiff(idx, 'position');
              const statutDiff = getDiff(idx, 'statut');
              const baseRow = rowsBase[idx];

              return (
                <TableRow key={row.race_result_id}>
                  <TableCell>
                    <div className="font-medium">{row.coureur_nom}</div>
                    <Badge variant="outline" className="text-xs">{row.equipe}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {baseRow?.position || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {baseRow?.statut || '-'}
                  </TableCell>
                  <TableCell>
                    {positionDiff ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded p-1">
                            <Input
                              type="number"
                              min="1"
                              value={row.position || ""}
                              onChange={(e) => updateRow(idx, 'position', e.target.value ? parseInt(e.target.value) : null)}
                              disabled={row.statut !== 'finished'}
                              className="h-8 bg-transparent border-none"
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          Avant: {positionDiff.before} → Après: {positionDiff.after}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Input
                        type="number"
                        min="1"
                        value={row.position || ""}
                        onChange={(e) => updateRow(idx, 'position', e.target.value ? parseInt(e.target.value) : null)}
                        disabled={row.statut !== 'finished'}
                        className="h-8"
                      />
                    )}
                    {row.statut !== 'finished' && row.position && (
                      <div className="text-xs text-muted-foreground mt-1">Position ignorée (statut ≠ finished)</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {statutDiff ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded p-1">
                            <Select
                              value={row.statut}
                              onValueChange={(val) => updateRow(idx, 'statut', val)}
                            >
                              <SelectTrigger className="h-8 bg-transparent border-none">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="finished">finished</SelectItem>
                                <SelectItem value="dnf">dnf</SelectItem>
                                <SelectItem value="dns">dns</SelectItem>
                                <SelectItem value="dsq">dsq</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          Avant: {statutDiff.before} → Après: {statutDiff.after}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Select
                        value={row.statut}
                        onValueChange={(val) => updateRow(idx, 'statut', val)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="finished">finished</SelectItem>
                          <SelectItem value="dnf">dnf</SelectItem>
                          <SelectItem value="dns">dns</SelectItem>
                          <SelectItem value="dsq">dsq</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.points_calcules || 0}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.last_updated_at && new Date(row.last_updated_at).toLocaleString('fr-FR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                    {row.last_updated_by && <div>{row.last_updated_by}</div>}
                  </TableCell>
                  <TableCell>
                    {(positionDiff || statutDiff) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => resetRow(idx)}
                        className="h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
};
