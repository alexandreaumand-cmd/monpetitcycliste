import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ResultsEditorTableProps {
  results: any[];
  isLoading: boolean;
  editedResults: Map<string, any>;
  onEdit: (resultId: string, field: string, value: any) => void;
  onShowHistory: (resultId: string) => void;
  selectedResults: Set<string>;
  onToggleSelection: (resultId: string) => void;
}

export const ResultsEditorTable = ({
  results,
  isLoading,
  editedResults,
  onEdit,
  onShowHistory,
  selectedResults,
  onToggleSelection
}: ResultsEditorTableProps) => {
  if (isLoading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  if (!results || results.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Aucun résultat trouvé
      </div>
    );
  }

  const getDisplayValue = (result: any, field: string) => {
    const edited = editedResults.get(result.id);
    if (edited && edited[field] !== undefined) {
      return edited[field];
    }
    return result[field];
  };

  const isEdited = (resultId: string, field: string) => {
    const edited = editedResults.get(resultId);
    return edited && edited[field] !== undefined;
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={selectedResults.size === results.length}
                onCheckedChange={(checked) => {
                  if (checked) {
                    results.forEach(r => onToggleSelection(r.id));
                  } else {
                    results.forEach(r => onToggleSelection(r.id));
                  }
                }}
              />
            </TableHead>
            <TableHead>Coureur</TableHead>
            <TableHead>Équipe</TableHead>
            <TableHead className="w-[120px]">Position</TableHead>
            <TableHead className="w-[150px]">Statut</TableHead>
            <TableHead className="w-[80px]">Points</TableHead>
            <TableHead>Manager</TableHead>
            <TableHead className="w-[150px]">Modifié le</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((result) => (
            <TableRow key={result.id}>
              <TableCell>
                <Checkbox
                  checked={selectedResults.has(result.id)}
                  onCheckedChange={() => onToggleSelection(result.id)}
                />
              </TableCell>
              <TableCell className="font-medium">
                {result.coureur_nom}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {result.coureur_equipe}
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min="1"
                  value={getDisplayValue(result, 'position') || ''}
                  onChange={(e) => onEdit(result.id, 'new_position', e.target.value ? parseInt(e.target.value) : null)}
                  className={isEdited(result.id, 'new_position') ? 'bg-yellow-50 border-yellow-300' : ''}
                  disabled={getDisplayValue(result, 'statut') !== 'finished'}
                />
              </TableCell>
              <TableCell>
                <Select
                  value={getDisplayValue(result, 'statut')}
                  onValueChange={(value) => onEdit(result.id, 'new_statut', value)}
                >
                  <SelectTrigger className={isEdited(result.id, 'new_statut') ? 'bg-yellow-50 border-yellow-300' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="finished">Terminé</SelectItem>
                    <SelectItem value="dnf">DNF</SelectItem>
                    <SelectItem value="dns">DNS</SelectItem>
                    <SelectItem value="dsq">DSQ</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Badge variant={result.points > 0 ? 'default' : 'secondary'}>
                  {result.points}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {result.manager_nom || '-'}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {result.updated_at ? (
                  <>
                    {format(new Date(result.updated_at), 'dd/MM/yy HH:mm', { locale: fr })}
                    {result.updated_by_nom && (
                      <div className="text-xs">par {result.updated_by_nom}</div>
                    )}
                  </>
                ) : '-'}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onShowHistory(result.id)}
                  className="gap-2"
                >
                  <History className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
