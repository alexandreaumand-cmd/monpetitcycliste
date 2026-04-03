import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { useLeague } from "@/contexts/LeagueContext";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { LeagueTemplateSelector } from "./LeagueTemplateSelector";
import { CourseSelector } from "./CourseSelector";
import { type GameMode, type FivePhasesVariant } from "@/lib/leagues/types";
import { computeFivePhasesSettings, computePerCourseSettings } from "@/lib/leagues/templates";
import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  Check,
  Globe,
  Lock,
  Users,
  Wallet,
  Bike,
  Gift,
  MapPin,
  Trophy,
  Flag,
} from "lucide-react";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type CreateLeagueDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Steps differ by game mode
type StepId = 'mode' | 'name' | 'variant' | 'courses' | 'players' | 'visibility' | 'bonuses' | 'auction' | 'recap';

function getSteps(mode: GameMode | null): StepId[] {
  if (!mode) return ['mode'];
  if (mode === 'five_phases') {
    return ['mode', 'name', 'variant', 'players', 'visibility', 'bonuses', 'auction', 'recap'];
  }
  return ['mode', 'name', 'courses', 'players', 'visibility', 'bonuses', 'auction', 'recap'];
}

export function CreateLeagueDialog({ open, onOpenChange }: CreateLeagueDialogProps) {
  const { t, i18n } = useTranslation('leagues');
  const dateLocale = i18n.language === 'fr' ? fr : enUS;
  const { refetch } = useUserLeagues();
  const { setLeagueId } = useLeague();
  const [isCreating, setIsCreating] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Form state
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [playerCount, setPlayerCount] = useState(4);
  const [seasonId, setSeasonId] = useState("");
  const [bonusesEnabled, setBonusesEnabled] = useState(true);
  const [firstAuctionDate, setFirstAuctionDate] = useState<Date | null>(null);
  const [variant, setVariant] = useState<FivePhasesVariant>('full_season');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [startingPhaseIndex, setStartingPhaseIndex] = useState<number | null>(null);

  // Fetch phases with their statut to filter out completed ones
  const { data: availablePhases = [] } = useQuery({
    queryKey: ['phases-for-league-creation', seasonId],
    queryFn: async () => {
      if (!seasonId) return [];
      const { data, error } = await supabase
        .from('phases')
        .select('id, index_dans_saison, statut, date_debut')
        .eq('saison_id', seasonId)
        .order('index_dans_saison');
      if (error) throw error;
      // Only show phases that are not completed
      return (data || []).filter(p => p.statut !== 'completed');
    },
    enabled: !!seasonId,
  });

  // Auto-select the first available (active) phase as default
  const activePhase = availablePhases.find(p => p.statut === 'active');
  if (availablePhases.length > 0 && startingPhaseIndex === null) {
    setStartingPhaseIndex(activePhase?.index_dans_saison ?? availablePhases[0].index_dans_saison);
  }

  const { data: seasons = [] } = useQuery({
    queryKey: ['seasons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saisons')
        .select('id, annee')
        .gte('annee', new Date().getFullYear())
        .order('annee', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (seasons.length > 0 && !seasonId) {
    setSeasonId(seasons[0].id);
  }

  // Fetch courses for recap (per_course mode)
  const { data: selectedCoursesData = [] } = useQuery({
    queryKey: ['selected-courses-recap', selectedCourseIds.join(',')],
    queryFn: async () => {
      if (selectedCourseIds.length === 0) return [];
      const { data } = await supabase
        .from('courses')
        .select('id, nom, type_course')
        .in('id', selectedCourseIds);
      return data || [];
    },
    enabled: selectedCourseIds.length > 0,
  });

  const steps = getSteps(selectedMode);
  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const progressPercent = ((currentStepIndex) / (totalSteps - 1)) * 100;

  const fivePhasesSettings = computeFivePhasesSettings();
  const perCourseSettings = useMemo(
    () => computePerCourseSettings(selectedCoursesData.map(c => ({ type_course: c.type_course }))),
    [selectedCoursesData]
  );

  const currentSettings = selectedMode === 'five_phases' ? fivePhasesSettings : perCourseSettings;

  const handleClose = () => {
    setCurrentStepIndex(0);
    setSelectedMode(null);
    setName("");
    setVisibility('private');
    setPlayerCount(4);
    setSeasonId("");
    setBonusesEnabled(true);
    setFirstAuctionDate(null);
    setVariant('full_season');
    setSelectedCourseIds([]);
    setStartingPhaseIndex(0);
    onOpenChange(false);
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'mode': return selectedMode !== null;
      case 'name': return name.trim() !== "" && seasonId !== "";
      case 'variant': return true;
      case 'courses': return selectedCourseIds.length > 0;
      case 'players': return true;
      case 'visibility': return true;
      case 'bonuses': return true;
      case 'auction': return firstAuctionDate !== null;
      case 'recap': return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStepIndex < totalSteps - 1 && canProceed()) {
      // When moving past mode step, recalculate steps
      if (currentStep === 'mode' && selectedMode) {
        const newSteps = getSteps(selectedMode);
        setCurrentStepIndex(1); // go to step after mode
      } else {
        setCurrentStepIndex(prev => prev + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!selectedMode || !name || !seasonId || !firstAuctionDate) return;

    const now = new Date();
    if (firstAuctionDate <= now) {
      toast.error(t('create.futureDateError'));
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
          ...(selectedMode === 'five_phases' && { variant, startingPhaseIndex }),
          ...(selectedMode === 'per_course' && { selectedCourseIds }),
        },
      });

      if (error) throw error;
      toast.success(t('create.success'));
      await refetch();
      if (data?.league?.id) setLeagueId(data.league.id);
      handleClose();
    } catch (error: any) {
      console.error("Error creating league:", error);
      toast.error(error.message || t('create.error'));
    } finally {
      setIsCreating(false);
    }
  };

  const playerCounts = [3, 4, 5, 6, 7, 8, 9, 10];

  const getStepTitle = (): string => {
    switch (currentStep) {
      case 'mode': return t('create.selectMode');
      case 'name': return t('wizard.stepName');
      case 'variant': return t('wizard.stepVariant');
      case 'courses': return t('wizard.stepCourses');
      case 'players': return t('wizard.stepPlayers');
      case 'visibility': return t('wizard.stepVisibility');
      case 'bonuses': return t('wizard.stepBonuses');
      case 'auction': return t('wizard.stepAuction');
      case 'recap': return t('wizard.stepRecap');
      default: return '';
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'mode':
        return (
          <LeagueTemplateSelector
            selectedMode={selectedMode}
            onSelect={setSelectedMode}
          />
        );

      case 'name':
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="league-name">{t('settings.name')}</Label>
              <Input
                id="league-name"
                placeholder={t('settings.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.season')}</Label>
              <Select value={seasonId} onValueChange={setSeasonId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('settings.selectSeason')} />
                </SelectTrigger>
                <SelectContent>
                  {seasons.map((season) => (
                    <SelectItem key={season.id} value={season.id}>
                      {t('settings.season')} {season.annee}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'variant':
        return (
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm text-foreground font-medium">
                {t('settings.fivePhasesExplainTitle')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('settings.fivePhasesExplainDesc')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {[
                  { phase: 1, date: '20 jan.' },
                  { phase: 2, date: '23 mars' },
                  { phase: 3, date: '8 mai' },
                  { phase: 4, date: '5 juil.' },
                  { phase: 5, date: '22 août' },
                ].map(({ phase, date }) => (
                  <div key={phase} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      {t('settings.fivePhasesPhaseLabel', { num: phase })}
                    </Badge>
                    <span>→ {date}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground italic">
                {t('settings.fivePhasesMidSeasonHint')}
              </p>
            </div>

            <RadioGroup
              value={variant}
              onValueChange={(v) => setVariant(v as FivePhasesVariant)}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="full_season" id="variant-full" />
                <Label htmlFor="variant-full" className="font-normal cursor-pointer">
                  {t('settings.variantFull')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="wt_only" id="variant-wt" />
                <Label htmlFor="variant-wt" className="font-normal cursor-pointer">
                  {t('settings.variantWT')}
                </Label>
              </div>
            </RadioGroup>

            <div className="space-y-2">
              <Label>{t('settings.startingPhase')}</Label>
              <Select
                value={startingPhaseIndex.toString()}
                onValueChange={(v) => setStartingPhaseIndex(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <SelectItem key={idx} value={idx.toString()}>
                      {idx === 0 ? t('settings.startingPhaseDefault') : t('settings.startingPhaseOption', { num: idx + 1 })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('settings.startingPhaseAuto')}
              </p>
            </div>
          </div>
        );

      case 'courses':
        return (
          <div className="space-y-2">
            <CourseSelector
              seasonId={seasonId}
              selectedCourseIds={selectedCourseIds}
              onSelectionChange={setSelectedCourseIds}
            />
          </div>
        );

      case 'players':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('wizard.playersDesc')}</p>
            <RadioGroup
              value={playerCount.toString()}
              onValueChange={(value) => setPlayerCount(parseInt(value))}
              className="grid grid-cols-4 gap-2"
            >
              {playerCounts.map((count) => (
                <div key={count}>
                  <RadioGroupItem
                    value={count.toString()}
                    id={`players-${count}`}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={`players-${count}`}
                    className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer text-base font-medium"
                  >
                    {count}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 'visibility':
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('wizard.visibilityDesc')}</p>
            <RadioGroup
              value={visibility}
              onValueChange={(value) => setVisibility(value as 'public' | 'private')}
              className="space-y-3"
            >
              <div
                className={cn(
                  "flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors",
                  visibility === 'public' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/20'
                )}
                onClick={() => setVisibility('public')}
              >
                <RadioGroupItem value="public" id="vis-public" className="mt-0.5" />
                <div>
                  <Label htmlFor="vis-public" className="font-medium cursor-pointer flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {t('visibility.public')}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('visibility.publicDesc')}</p>
                </div>
              </div>
              <div
                className={cn(
                  "flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors",
                  visibility === 'private' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/20'
                )}
                onClick={() => setVisibility('private')}
              >
                <RadioGroupItem value="private" id="vis-private" className="mt-0.5" />
                <div>
                  <Label htmlFor="vis-private" className="font-medium cursor-pointer flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    {t('visibility.private')}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('visibility.privateDesc')}</p>
                </div>
              </div>
            </RadioGroup>
          </div>
        );

      case 'bonuses':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="space-y-0.5">
                <Label htmlFor="bonuses" className="text-base">{t('settings.bonuses')}</Label>
                <p className="text-sm text-muted-foreground">{t('settings.bonusesDesc')}</p>
              </div>
              <Switch
                id="bonuses"
                checked={bonusesEnabled}
                onCheckedChange={setBonusesEnabled}
              />
            </div>
            {bonusesEnabled && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <p className="text-sm font-medium text-foreground">{t('settings.bonusExplainTitle')}</p>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p>⭐ <strong>{t('settings.bonusRider')}</strong> — {t('settings.bonusRiderDesc')}</p>
                  <p>🏅 <strong>{t('settings.bonusFirstWin')}</strong> — {t('settings.bonusFirstWinDesc')}</p>
                  <p>⏱️ <strong>{t('settings.bonusITT')}</strong> — {t('settings.bonusITTDesc')}</p>
                  <p>📊 <strong>{t('settings.bonusScorers')}</strong> — {t('settings.bonusScorersDesc')}</p>
                </div>
              </div>
            )}
          </div>
        );

      case 'auction':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('settings.auctionDateDesc')}</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !firstAuctionDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {firstAuctionDate ? (
                    format(firstAuctionDate, "PPP 'à' HH:mm", { locale: dateLocale })
                  ) : (
                    <span>{t('settings.selectDateTime')}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 space-y-3">
                  <Calendar
                    mode="single"
                    selected={firstAuctionDate || undefined}
                    onSelect={(date) => {
                      if (date) {
                        const newDate = firstAuctionDate ? new Date(firstAuctionDate) : new Date();
                        newDate.setFullYear(date.getFullYear());
                        newDate.setMonth(date.getMonth());
                        newDate.setDate(date.getDate());
                        setFirstAuctionDate(newDate);
                      }
                    }}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                  <div className="border-t pt-3 space-y-2">
                    <Label className="text-xs">{t('settings.hour')}</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="23"
                        placeholder="HH"
                        value={firstAuctionDate?.getHours() ?? ''}
                        onChange={(e) => {
                          const hours = parseInt(e.target.value);
                          if (!isNaN(hours) && hours >= 0 && hours <= 23) {
                            const newDate = firstAuctionDate ? new Date(firstAuctionDate) : new Date();
                            newDate.setHours(hours);
                            setFirstAuctionDate(new Date(newDate));
                          }
                        }}
                        className="w-20"
                      />
                      <span className="self-center">:</span>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        placeholder="MM"
                        value={firstAuctionDate?.getMinutes() ?? ''}
                        onChange={(e) => {
                          const minutes = parseInt(e.target.value);
                          if (!isNaN(minutes) && minutes >= 0 && minutes <= 59) {
                            const newDate = firstAuctionDate ? new Date(firstAuctionDate) : new Date();
                            newDate.setMinutes(minutes);
                            setFirstAuctionDate(new Date(newDate));
                          }
                        }}
                        className="w-20"
                      />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        );

      case 'recap':
        return (
          <div className="space-y-3">
            <RecapRow icon={<Trophy className="h-4 w-4" />} label={t('wizard.recapMode')}
              value={selectedMode === 'five_phases' ? t('templates.five_phases.name') : t('templates.perCourse.name')} />
            <RecapRow icon={<CalendarIcon className="h-4 w-4" />} label={t('wizard.recapName')} value={name} />
            {selectedMode === 'five_phases' && (
              <>
                <RecapRow icon={<MapPin className="h-4 w-4" />} label={t('wizard.recapVariant')}
                  value={variant === 'full_season' ? t('settings.variantFull') : t('settings.variantWT')} />
                <RecapRow icon={<Flag className="h-4 w-4" />} label={t('wizard.recapStartingPhase')}
                  value={startingPhaseIndex === 0 ? t('settings.startingPhaseDefault') : t('settings.startingPhaseOption', { num: startingPhaseIndex + 1 })} />
              </>
            )}
            {selectedMode === 'per_course' && selectedCoursesData.length > 0 && (
              <RecapRow icon={<MapPin className="h-4 w-4" />} label={t('wizard.recapCourses')}
                value={selectedCoursesData.map(c => c.nom).join(', ')} />
            )}
            <RecapRow icon={<Users className="h-4 w-4" />} label={t('wizard.recapPlayers')} value={`${playerCount}`} />
            <RecapRow icon={<Globe className="h-4 w-4" />} label={t('wizard.recapVisibility')}
              value={visibility === 'public' ? t('visibility.public') : t('visibility.private')} />
            <RecapRow icon={<Gift className="h-4 w-4" />} label={t('wizard.recapBonuses')}
              value={bonusesEnabled ? t('wizard.yes') : t('wizard.no')} />
            <RecapRow icon={<Wallet className="h-4 w-4" />} label={t('settings.budget')} value={`${currentSettings.budget}`} />
            <RecapRow icon={<Bike className="h-4 w-4" />} label={t('wizard.recapRiders')} value={`${currentSettings.maxRiders}`} />
            {firstAuctionDate && (
              <RecapRow icon={<CalendarIcon className="h-4 w-4" />} label={t('wizard.recapAuction')}
                value={format(firstAuctionDate, "PPP 'à' HH:mm", { locale: dateLocale })} />
            )}
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col gap-0 p-0">
        {/* Progress bar */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">{getStepTitle()}</h2>
            <span className="text-xs text-muted-foreground">
              {currentStepIndex + 1}/{totalSteps}
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {renderStep()}
        </div>

        {/* Navigation buttons */}
        <div className="px-6 pb-6 pt-2 flex items-center justify-between border-t">
          <div>
            {currentStepIndex > 0 && (
              <Button variant="ghost" onClick={handleBack} disabled={isCreating} size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                {t('create.back')}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleClose} disabled={isCreating} size="sm">
              {t('create.cancel')}
            </Button>
            {currentStep === 'recap' ? (
              <Button onClick={handleSubmit} disabled={isCreating} size="sm">
                {isCreating ? t('create.creating') : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    {t('create.submit')}
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!canProceed()} size="sm">
                {t('create.next')}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecapRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border">
      <div className="text-muted-foreground mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
