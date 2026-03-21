import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { useLeague } from "@/contexts/LeagueContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LeagueTemplateSelector } from "./LeagueTemplateSelector";
import { LeagueSettingsForm } from "./LeagueSettingsForm";
import { type GameMode, type FivePhasesVariant } from "@/lib/leagues/types";
import { computeFivePhasesSettings, computePerCourseSettings } from "@/lib/leagues/templates";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

type CreateLeagueDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateLeagueDialog({ open, onOpenChange }: CreateLeagueDialogProps) {
  const { t } = useTranslation('leagues');
  const { refetch } = useUserLeagues();
  const { setLeagueId } = useLeague();
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  
  // Form state
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [playerCount, setPlayerCount] = useState(4);
  const [seasonId, setSeasonId] = useState("");
  const [bonusesEnabled, setBonusesEnabled] = useState(true);
  const [firstAuctionDate, setFirstAuctionDate] = useState<Date | null>(null);
  
  // Five phases specific
  const [variant, setVariant] = useState<FivePhasesVariant>('full_season');
  
  
  // Per course specific
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);

  // Fetch available seasons
  const { data: seasons = [] } = useQuery({
    queryKey: ['seasons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saisons')
        .select('id, annee')
        .order('annee', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Auto-select latest season when seasons load
  if (seasons.length > 0 && !seasonId) {
    setSeasonId(seasons[0].id);
  }

  const handleClose = () => {
    setStep(1);
    setSelectedMode(null);
    setName("");
    setVisibility('private');
    setPlayerCount(4);
    setSeasonId("");
    setBonusesEnabled(true);
    setFirstAuctionDate(null);
    setVariant('full_season');
    setStartingPhaseIndex(1);
    setSelectedCourseIds([]);
    onOpenChange(false);
  };

  const handleNext = () => {
    if (selectedMode) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleSubmit = async () => {
    if (!selectedMode || !name || !seasonId) return;

    if (!firstAuctionDate) {
      toast.error(t('create.selectDateError'));
      return;
    }

    const now = new Date();
    if (firstAuctionDate <= now) {
      toast.error(t('create.futureDateError'));
      return;
    }

    if (selectedMode === 'per_course' && selectedCourseIds.length === 0) {
      toast.error(t('create.selectCoursesError', 'Veuillez sélectionner au moins une course'));
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("leagues-create", {
        body: {
          name,
          visibility,
          gameMode: selectedMode,
          maxPlayers: playerCount,
          bonusesEnabled,
          firstAuctionStartsAt: firstAuctionDate.toISOString(),
          // Five phases specific
          ...(selectedMode === 'five_phases' && {
            variant,
            startingPhaseIndex,
          }),
          // Per course specific
          ...(selectedMode === 'per_course' && {
            selectedCourseIds,
          }),
        },
      });

      if (error) throw error;

      toast.success(t('create.success'));
      await refetch();
      
      if (data?.league?.id) {
        setLeagueId(data.league.id);
      }
      
      handleClose();
    } catch (error: any) {
      console.error("Error creating league:", error);
      toast.error(error.message || t('create.error'));
    } finally {
      setIsCreating(false);
    }
  };

  const canProceed = step === 1 
    ? selectedMode !== null 
    : name.trim() !== "" && seasonId !== "" && firstAuctionDate !== null && 
      (selectedMode !== 'per_course' || selectedCourseIds.length > 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? t('create.selectMode') : t('create.configure')}
          </DialogTitle>
          <DialogDescription>
            {step === 1 
              ? t('create.selectModeDesc')
              : t('create.configureDesc')
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 1 ? (
            <LeagueTemplateSelector
              selectedMode={selectedMode}
              onSelect={setSelectedMode}
            />
          ) : (
            <LeagueSettingsForm
              name={name}
              onNameChange={setName}
              visibility={visibility}
              onVisibilityChange={setVisibility}
              gameMode={selectedMode!}
              playerCount={playerCount}
              onPlayerCountChange={setPlayerCount}
              seasonId={seasonId}
              onSeasonChange={setSeasonId}
              bonusesEnabled={bonusesEnabled}
              onBonusesChange={setBonusesEnabled}
              firstAuctionDate={firstAuctionDate}
              onFirstAuctionDateChange={setFirstAuctionDate}
              seasons={seasons}
              variant={variant}
              onVariantChange={setVariant}
              startingPhaseIndex={startingPhaseIndex}
              onStartingPhaseIndexChange={setStartingPhaseIndex}
              selectedCourseIds={selectedCourseIds}
              onSelectedCourseIdsChange={setSelectedCourseIds}
            />
          )}
        </div>

        <div className="flex justify-between">
          {step === 2 && (
            <Button variant="outline" onClick={handleBack} disabled={isCreating}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('create.back')}
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={handleClose} disabled={isCreating}>
              {t('create.cancel')}
            </Button>
            {step === 1 ? (
              <Button onClick={handleNext} disabled={!canProceed}>
                {t('create.next')}
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canProceed || isCreating}>
                {isCreating ? t('create.creating') : t('create.submit')}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
