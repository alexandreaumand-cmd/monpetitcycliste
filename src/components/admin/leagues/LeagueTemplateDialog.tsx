import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useEffect } from "react";

type LeagueTemplate = {
  id: string;
  name: string;
  description: string;
  player_counts: number[];
  base_budget: number;
  base_max_riders: number;
  budget_multiplier_per_player: number;
  riders_multiplier_per_player: number;
  by_phase: boolean;
  gt_only: boolean;
  wt_only: boolean;
  competitions: string[];
  is_active: boolean;
  is_system?: boolean;
};

type LeagueTemplateDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  template: LeagueTemplate | null;
};

const PLAYER_COUNT_OPTIONS = [4, 6, 8, 10, 12];

export function LeagueTemplateDialog({ isOpen, onClose, template }: LeagueTemplateDialogProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, watch, setValue } = useForm<LeagueTemplate>({
    defaultValues: template || {
      id: '',
      name: '',
      description: '',
      player_counts: [4, 6, 8, 10],
      base_budget: 2200,
      base_max_riders: 30,
      budget_multiplier_per_player: 0.15,
      riders_multiplier_per_player: 0.10,
      by_phase: true,
      gt_only: false,
      wt_only: false,
      competitions: [],
      is_active: true,
    },
  });

  const playerCounts = watch('player_counts') || [];
  const competitionsStr = watch('competitions')?.join('\n') || '';

  useEffect(() => {
    if (template) {
      reset(template);
    } else {
      reset({
        id: '',
        name: '',
        description: '',
        player_counts: [4, 6, 8, 10],
        base_budget: 2200,
        base_max_riders: 30,
        budget_multiplier_per_player: 0.15,
        riders_multiplier_per_player: 0.10,
        by_phase: true,
        gt_only: false,
        wt_only: false,
        competitions: [],
        is_active: true,
      });
    }
  }, [template, reset]);

  const upsertMutation = useMutation({
    mutationFn: async (data: LeagueTemplate) => {
      const { data: result, error } = await supabase.functions.invoke('admin-league-template-upsert', {
        body: { template: data },
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-league-templates'] });
      toast.success(template ? 'Template mis à jour' : 'Template créé');
      onClose();
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const onSubmit = (data: LeagueTemplate) => {
    // Parse competitions from textarea
    const competitions = competitionsStr
      .split('\n')
      .map(c => c.trim())
      .filter(c => c.length > 0);

    upsertMutation.mutate({
      ...data,
      competitions,
      is_system: template?.is_system || false,
    });
  };

  const togglePlayerCount = (count: number) => {
    const current = playerCounts;
    const updated = current.includes(count)
      ? current.filter(c => c !== count)
      : [...current, count].sort((a, b) => a - b);
    setValue('player_counts', updated);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Modifier le template' : 'Créer un template'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="id">ID du template</Label>
            <Input
              id="id"
              {...register('id', { required: true })}
              placeholder="ex: short_spring_classics"
              disabled={!!template}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nom</Label>
            <Input
              id="name"
              {...register('name', { required: true })}
              placeholder="ex: Classiques de Printemps"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description', { required: true })}
              placeholder="Description du template"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Nombre de joueurs autorisés</Label>
            <div className="flex gap-4">
              {PLAYER_COUNT_OPTIONS.map((count) => (
                <div key={count} className="flex items-center space-x-2">
                  <Checkbox
                    id={`player-${count}`}
                    checked={playerCounts.includes(count)}
                    onCheckedChange={() => togglePlayerCount(count)}
                  />
                  <label
                    htmlFor={`player-${count}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {count}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="base_budget">Budget de base (4 joueurs)</Label>
              <Input
                id="base_budget"
                type="number"
                {...register('base_budget', { required: true, valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="base_max_riders">Max coureurs (4 joueurs)</Label>
              <Input
                id="base_max_riders"
                type="number"
                {...register('base_max_riders', { required: true, valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget_multiplier">Multiplicateur budget/joueur</Label>
              <Input
                id="budget_multiplier"
                type="number"
                step="0.01"
                {...register('budget_multiplier_per_player', { required: true, valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="riders_multiplier">Multiplicateur coureurs/joueur</Label>
              <Input
                id="riders_multiplier"
                type="number"
                step="0.01"
                {...register('riders_multiplier_per_player', { required: true, valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Configuration du scope</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="by_phase"
                  {...register('by_phase')}
                />
                <label htmlFor="by_phase" className="text-sm">
                  Par phase (toutes les courses)
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="gt_only"
                  {...register('gt_only')}
                />
                <label htmlFor="gt_only" className="text-sm">
                  Grands Tours uniquement
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="wt_only"
                  {...register('wt_only')}
                />
                <label htmlFor="wt_only" className="text-sm">
                  World Tour uniquement
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="competitions">
              Compétitions spécifiques (une par ligne)
            </Label>
            <Textarea
              id="competitions"
              value={competitionsStr}
              onChange={(e) => setValue('competitions', e.target.value.split('\n') as any)}
              placeholder="Tour de France&#10;Giro d'Italia"
              rows={5}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_active"
              {...register('is_active')}
            />
            <label htmlFor="is_active" className="text-sm">
              Template actif
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
