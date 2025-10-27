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
import { type GameMode, calculateLeagueSettings, getLeagueScopeConfig } from "@/lib/leagues/templates";
import { ArrowLeft } from "lucide-react";

type CreateLeagueDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateLeagueDialog({ open, onOpenChange }: CreateLeagueDialogProps) {
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

    setIsCreating(true);
    try {
      const settings = await calculateLeagueSettings(selectedMode, playerCount);
      const scopeConfig = await getLeagueScopeConfig(selectedMode, seasonId);

      const { data, error } = await supabase.functions.invoke("leagues-create", {
        body: {
          name,
          visibility,
          gameMode: selectedMode,
          maxPlayers: playerCount,
          bonusesEnabled,
          budget: settings.budget,
          maxRiders: settings.maxRiders,
          scopeConfig,
        },
      });

      if (error) throw error;

      toast.success("Ligue créée avec succès !");
      await refetch();
      
      if (data?.league?.id) {
        setLeagueId(data.league.id);
      }
      
      handleClose();
    } catch (error: any) {
      console.error("Error creating league:", error);
      toast.error(error.message || "Erreur lors de la création de la ligue");
    } finally {
      setIsCreating(false);
    }
  };

  const canProceed = step === 1 ? selectedMode !== null : name.trim() !== "" && seasonId !== "";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Choisir un mode de jeu" : "Configuration de la ligue"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 
              ? "Sélectionnez le type de ligue que vous souhaitez créer"
              : "Personnalisez les paramètres de votre ligue"
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
              seasons={seasons}
            />
          )}
        </div>

        <div className="flex justify-between">
          {step === 2 && (
            <Button variant="outline" onClick={handleBack} disabled={isCreating}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={handleClose} disabled={isCreating}>
              Annuler
            </Button>
            {step === 1 ? (
              <Button onClick={handleNext} disabled={!canProceed}>
                Suivant
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canProceed || isCreating}>
                {isCreating ? "Création..." : "Créer la ligue"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
