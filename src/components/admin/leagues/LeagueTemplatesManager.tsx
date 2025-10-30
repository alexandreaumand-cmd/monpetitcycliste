import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeagueTemplateDialog } from "./LeagueTemplateDialog";

type LeagueTemplate = {
  id: string;
  name: string;
  description: string;
  player_counts: number[];
  base_budget: number;
  base_max_riders: number;
  budget_multiplier_per_player: number;
  riders_multiplier_per_player: number;
  phase_indexes: number[];
  auction_strategy: 'single' | 'per_phase' | 'grouped';
  auction_phase_groups?: number[][];
  course_filters: {
    wt_tier?: string[];
    categorie?: string[];
    competitions?: string[];
    exclude_proseries?: boolean;
  };
  by_phase: boolean;
  gt_only: boolean;
  wt_only: boolean;
  competitions: string[];
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

export function LeagueTemplatesManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LeagueTemplate | null>(null);
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ['admin-league-templates'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-league-templates-list');
      if (error) throw error;
      return data.templates as LeagueTemplate[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ templateId, isActive }: { templateId: string; isActive: boolean }) => {
      const { data, error } = await supabase.functions.invoke('admin-league-template-toggle', {
        body: { templateId, isActive },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-league-templates'] });
      toast.success('Template mis à jour');
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-league-template-delete', {
        body: { templateId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-league-templates'] });
      toast.success('Template supprimé');
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const handleEdit = (template: LeagueTemplate) => {
    setEditingTemplate(template);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setIsDialogOpen(true);
  };

  const handleDuplicate = (template: LeagueTemplate) => {
    const duplicated = {
      ...template,
      id: `${template.id}_copy_${Date.now()}`,
      name: `${template.name} (Copie)`,
      is_system: false,
    };
    setEditingTemplate(duplicated);
    setIsDialogOpen(true);
  };

  const handleToggle = (template: LeagueTemplate) => {
    toggleMutation.mutate({ templateId: template.id, isActive: !template.is_active });
  };

  const handleDelete = (template: LeagueTemplate) => {
    if (template.is_system) {
      toast.error('Impossible de supprimer un template système');
      return;
    }
    if (confirm(`Supprimer le template "${template.name}" ?`)) {
      deleteMutation.mutate(template.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Templates de ligues ({templates?.length || 0})</CardTitle>
          <Button onClick={handleCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Créer un template
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Joueurs</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Coureurs</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates?.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">
                    {template.name}
                    {template.is_system && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Système
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {template.description}
                  </TableCell>
                  <TableCell className="text-sm">
                    {template.player_counts.join(', ')}
                  </TableCell>
                  <TableCell className="text-sm">{template.base_budget}</TableCell>
                  <TableCell className="text-sm">{template.base_max_riders}</TableCell>
                  <TableCell>
                    {template.is_active ? (
                      <Badge variant="default">Actif</Badge>
                    ) : (
                      <Badge variant="outline">Inactif</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(template)}
                        title="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDuplicate(template)}
                        title="Dupliquer"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggle(template)}
                        title={template.is_active ? "Désactiver" : "Activer"}
                      >
                        {template.is_active ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      {!template.is_system && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(template)}
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <LeagueTemplateDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingTemplate(null);
        }}
        template={editingTemplate}
      />
    </>
  );
}
