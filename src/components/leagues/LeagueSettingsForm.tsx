import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getLeagueTemplates, type GameMode, calculateLeagueSettings } from "@/lib/leagues/templates";
import { Badge } from "@/components/ui/badge";

type LeagueSettingsFormProps = {
  name: string;
  onNameChange: (name: string) => void;
  visibility: 'public' | 'private';
  onVisibilityChange: (visibility: 'public' | 'private') => void;
  gameMode: GameMode;
  playerCount: number;
  onPlayerCountChange: (count: number) => void;
  seasonId: string;
  onSeasonChange: (seasonId: string) => void;
  bonusesEnabled: boolean;
  onBonusesChange: (enabled: boolean) => void;
  seasons: Array<{ id: string; annee: number }>;
};

export function LeagueSettingsForm({
  name,
  onNameChange,
  visibility,
  onVisibilityChange,
  gameMode,
  playerCount,
  onPlayerCountChange,
  seasonId,
  onSeasonChange,
  bonusesEnabled,
  onBonusesChange,
  seasons,
}: LeagueSettingsFormProps) {
  const { data: templates } = useQuery({
    queryKey: ['league-templates'],
    queryFn: getLeagueTemplates,
  });

  const [settings, setSettings] = useState({ budget: 0, maxRiders: 0 });

  useEffect(() => {
    calculateLeagueSettings(gameMode, playerCount).then(setSettings);
  }, [gameMode, playerCount]);

  const template = templates?.find((t) => t.id === gameMode);

  return (
    <div className="space-y-6">
      {/* League Name */}
      <div className="space-y-2">
        <Label htmlFor="league-name">Nom de la ligue</Label>
        <Input
          id="league-name"
          placeholder="Ma Super Ligue"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>

      {/* Season Selection */}
      <div className="space-y-2">
        <Label>Saison</Label>
        <Select value={seasonId} onValueChange={onSeasonChange}>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner une saison" />
          </SelectTrigger>
          <SelectContent>
            {seasons.map((season) => (
              <SelectItem key={season.id} value={season.id}>
                Saison {season.annee}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Player Count */}
      <div className="space-y-2">
        <Label>Nombre de joueurs</Label>
        <RadioGroup
          value={playerCount.toString()}
          onValueChange={(value) => onPlayerCountChange(parseInt(value))}
          className="grid grid-cols-4 gap-2"
        >
          {template?.playerCounts.map((count) => (
            <div key={count}>
              <RadioGroupItem
                value={count.toString()}
                id={`players-${count}`}
                className="peer sr-only"
              />
              <Label
                htmlFor={`players-${count}`}
                className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                {count}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <div className="flex gap-2 mt-2">
          <Badge variant="secondary">Budget: {settings.budget}</Badge>
          <Badge variant="secondary">Max coureurs: {settings.maxRiders}</Badge>
        </div>
      </div>

      {/* Visibility */}
      <div className="space-y-2">
        <Label>Visibilité</Label>
        <RadioGroup
          value={visibility}
          onValueChange={(value) => onVisibilityChange(value as 'public' | 'private')}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="public" id="public" />
            <Label htmlFor="public" className="font-normal cursor-pointer">
              Publique - Visible par tous
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="private" id="private" />
            <Label htmlFor="private" className="font-normal cursor-pointer">
              Privée - Sur invitation uniquement
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Bonuses */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="bonuses">Bonus activés</Label>
          <p className="text-sm text-muted-foreground">
            Coureurs bonus, ITT, TTT, première victoire
          </p>
        </div>
        <Switch
          id="bonuses"
          checked={bonusesEnabled}
          onCheckedChange={onBonusesChange}
        />
      </div>
    </div>
  );
}
