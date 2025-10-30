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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useEffect, useState } from "react";

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
  is_system?: boolean;
};

type LeagueTemplateDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  template: LeagueTemplate | null;
};

const PLAYER_COUNT_OPTIONS = [4, 6, 8, 10, 12];
const PHASE_OPTIONS = [1, 2, 3, 4, 5];
const WT_TIER_OPTIONS = ['GT', 'WT', 'ProSeries'];

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
      phase_indexes: [1, 2, 3, 4, 5],
      auction_strategy: 'per_phase',
      course_filters: {},
      by_phase: true,
      gt_only: false,
      wt_only: false,
      competitions: [],
      is_active: true,
    },
  });

  const playerCounts = watch('player_counts') || [];
  const phaseIndexes = watch('phase_indexes') || [];
  const auctionStrategy = watch('auction_strategy') || 'per_phase';
  const courseFilters = watch('course_filters') || {};
  const [competitionsStr, setCompetitionsStr] = useState('');
  const [phaseGroupsStr, setPhaseGroupsStr] = useState('');

  useEffect(() => {
    if (template) {
      reset(template);
      setCompetitionsStr(template.course_filters?.competitions?.join('\n') || '');
      setPhaseGroupsStr(
        template.auction_phase_groups?.map(g => g.join(',')).join('\n') || ''
      );
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
        phase_indexes: [1, 2, 3, 4, 5],
        auction_strategy: 'per_phase',
        course_filters: {},
        by_phase: true,
        gt_only: false,
        wt_only: false,
        competitions: [],
        is_active: true,
      });
      setCompetitionsStr('');
      setPhaseGroupsStr('');
    }
  }, [template, reset]);

  const upsertMutation = useMutation({
    mutationFn: async (data: any) => {
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
    // Parse competitions
    const competitions = competitionsStr
      .split('\n')
      .map(c => c.trim())
      .filter(c => c.length > 0);

    // Parse phase groups for grouped strategy
    let auctionPhaseGroups: number[][] | undefined;
    if (data.auction_strategy === 'grouped') {
      auctionPhaseGroups = phaseGroupsStr
        .split('\n')
        .map(line => line.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)))
        .filter(group => group.length > 0);
    }

    upsertMutation.mutate({
      ...data,
      competitions: [],
      course_filters: {
        ...data.course_filters,
        competitions: competitions.length > 0 ? competitions : undefined,
      },
      auction_phase_groups: auctionPhaseGroups,
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

  const togglePhaseIndex = (index: number) => {
    const current = phaseIndexes;
    const updated = current.includes(index)
      ? current.filter(i => i !== index)
      : [...current, index].sort((a, b) => a - b);
    setValue('phase_indexes', updated);
  };

  const toggleWtTier = (tier: string) => {
    const current = courseFilters.wt_tier || [];
    const updated = current.includes(tier)
      ? current.filter(t => t !== tier)
      : [...current, tier];
    setValue('course_filters', { ...courseFilters, wt_tier: updated.length > 0 ? updated : undefined });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Modifier le template' : 'Créer un template'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="id">ID du template</Label>
              <Input
                id="id"
                {...register('id', { required: true })}
                placeholder="ex: short_spring_classics"
                disabled={!!template}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom</Label>
                <Input
                  id="name"
                  {...register('name', { required: true })}
                  placeholder="ex: Classiques de Printemps"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="is_active">Statut</Label>
                <div className="flex items-center h-10">
                  <Checkbox
                    id="is_active"
                    {...register('is_active')}
                  />
                  <label htmlFor="is_active" className="ml-2 text-sm">
                    Template actif
                  </label>
                </div>
              </div>
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
          </div>

          {/* Players */}
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
                  <label htmlFor={`player-${count}`} className="text-sm">
                    {count}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Budget & Riders */}
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

          {/* Phases */}
          <div className="space-y-2">
            <Label>Phases concernées</Label>
            <div className="flex gap-4">
              {PHASE_OPTIONS.map((index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Checkbox
                    id={`phase-${index}`}
                    checked={phaseIndexes.includes(index)}
                    onCheckedChange={() => togglePhaseIndex(index)}
                  />
                  <label htmlFor={`phase-${index}`} className="text-sm">
                    Phase {index}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Auction Strategy */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auction_strategy">Stratégie d'enchères</Label>
              <Select
                value={auctionStrategy}
                onValueChange={(value: any) => setValue('auction_strategy', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Enchère unique (roster reconduit)</SelectItem>
                  <SelectItem value="per_phase">Par phase (reset du roster)</SelectItem>
                  <SelectItem value="grouped">Par groupe de phases</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {auctionStrategy === 'grouped' && (
              <div className="space-y-2">
                <Label htmlFor="phase_groups">Groupes de phases (un groupe par ligne, phases séparées par virgule)</Label>
                <Textarea
                  id="phase_groups"
                  value={phaseGroupsStr}
                  onChange={(e) => setPhaseGroupsStr(e.target.value)}
                  placeholder="1,2&#10;3,4,5"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Exemple: "1,2" puis "3,4,5" crée deux groupes
                </p>
              </div>
            )}
          </div>

          {/* Course Filters */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-medium">Filtres de courses</h3>
            
            <div className="space-y-2">
              <Label>Types de courses (WT Tier)</Label>
              <div className="flex gap-4">
                {WT_TIER_OPTIONS.map((tier) => (
                  <div key={tier} className="flex items-center space-x-2">
                    <Checkbox
                      id={`tier-${tier}`}
                      checked={courseFilters.wt_tier?.includes(tier) || false}
                      onCheckedChange={() => toggleWtTier(tier)}
                    />
                    <label htmlFor={`tier-${tier}`} className="text-sm">
                      {tier}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="exclude_proseries"
                  checked={courseFilters.exclude_proseries || false}
                  onCheckedChange={(checked) => 
                    setValue('course_filters', { ...courseFilters, exclude_proseries: checked as boolean })
                  }
                />
                <label htmlFor="exclude_proseries" className="text-sm">
                  Exclure les ProSeries
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter_competitions">
                Compétitions spécifiques (une par ligne)
              </Label>
              <Textarea
                id="filter_competitions"
                value={competitionsStr}
                onChange={(e) => setCompetitionsStr(e.target.value)}
                placeholder="Milano-Sanremo&#10;Paris-Roubaix"
                rows={5}
              />
            </div>
          </div>

          {/* Legacy fields (hidden but maintained for compatibility) */}
          <input type="hidden" {...register('by_phase')} />
          <input type="hidden" {...register('gt_only')} />
          <input type="hidden" {...register('wt_only')} />

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
