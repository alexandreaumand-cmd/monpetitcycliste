import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { type GameMode, type FivePhasesVariant } from "@/lib/leagues/types";
import { computeFivePhasesSettings, computePerCourseSettings } from "@/lib/leagues/templates";
import { CourseSelector } from "./CourseSelector";

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
  firstAuctionDate: Date | null;
  onFirstAuctionDateChange: (date: Date | null) => void;
  seasons: Array<{ id: string; annee: number }>;
  // Five phases specific
  variant?: FivePhasesVariant;
  onVariantChange?: (v: FivePhasesVariant) => void;
  // Per course specific
  selectedCourseIds?: string[];
  onSelectedCourseIdsChange?: (ids: string[]) => void;
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
  firstAuctionDate,
  onFirstAuctionDateChange,
  seasons,
  variant = 'full_season',
  onVariantChange,
  selectedCourseIds = [],
  onSelectedCourseIdsChange,
}: LeagueSettingsFormProps) {
  const { t, i18n } = useTranslation('leagues');
  const dateLocale = i18n.language === 'fr' ? fr : enUS;


  // Compute settings display
  const settings = useMemo(() => {
    if (gameMode === 'five_phases') {
      return computeFivePhasesSettings();
    }
    return { budget: 0, maxRiders: 0 }; // per_course is computed in CourseSelector
  }, [gameMode]);

  const playerCounts = [3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <div className="space-y-6">
      {/* League Name */}
      <div className="space-y-2">
        <Label htmlFor="league-name">{t('settings.name')}</Label>
        <Input
          id="league-name"
          placeholder={t('settings.namePlaceholder')}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>

      {/* Season Selection */}
      <div className="space-y-2">
        <Label>{t('settings.season')}</Label>
        <Select value={seasonId} onValueChange={onSeasonChange}>
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

      {/* Five Phases: explanation + variant + info */}
      {gameMode === 'five_phases' && (
        <>
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

          <div className="space-y-2">
            <Label>{t('settings.variant', 'Variante')}</Label>
            <RadioGroup
              value={variant}
              onValueChange={(v) => onVariantChange?.(v as FivePhasesVariant)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="full_season" id="variant-full" />
                <Label htmlFor="variant-full" className="font-normal cursor-pointer">
                  {t('settings.variantFull', 'Saison entière')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="wt_only" id="variant-wt" />
                <Label htmlFor="variant-wt" className="font-normal cursor-pointer">
                  {t('settings.variantWT', 'World Tour uniquement')}
                </Label>
              </div>
            </RadioGroup>
          </div>

          <p className="text-sm text-muted-foreground italic">
            {t('settings.startingPhaseAuto')}
          </p>

          <div className="flex gap-2">
            <Badge variant="secondary">{t('settings.budget')}: {settings.budget}</Badge>
            <Badge variant="secondary">{t('settings.maxRiders')}: {settings.maxRiders}</Badge>
          </div>
        </>
      )}

      {/* Per Course: course selector */}
      {gameMode === 'per_course' && seasonId && (
        <div className="space-y-2">
          <Label>{t('settings.selectCourses', 'Sélectionner les courses')}</Label>
          <CourseSelector
            seasonId={seasonId}
            selectedCourseIds={selectedCourseIds}
            onSelectionChange={(ids) => onSelectedCourseIdsChange?.(ids)}
          />
        </div>
      )}

      {/* Player Count */}
      <div className="space-y-2">
        <Label>{t('settings.playerCount')}</Label>
        <RadioGroup
          value={playerCount.toString()}
          onValueChange={(value) => onPlayerCountChange(parseInt(value))}
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
                className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                {count}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Visibility */}
      <div className="space-y-2">
        <Label>{t('settings.visibility')}</Label>
        <RadioGroup
          value={visibility}
          onValueChange={(value) => onVisibilityChange(value as 'public' | 'private')}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="public" id="public" />
            <Label htmlFor="public" className="font-normal cursor-pointer">
              {t('visibility.public')} - {t('visibility.publicDesc')}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="private" id="private" />
            <Label htmlFor="private" className="font-normal cursor-pointer">
              {t('visibility.private')} - {t('visibility.privateDesc')}
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Bonuses */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="bonuses">{t('settings.bonuses')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('settings.bonusesDesc')}
            </p>
          </div>
          <Switch
            id="bonuses"
            checked={bonusesEnabled}
            onCheckedChange={onBonusesChange}
          />
        </div>
        {bonusesEnabled && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">{t('settings.bonusExplainTitle')}</p>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p>🏅 <strong>{t('settings.bonusFirstWin')}</strong> — {t('settings.bonusFirstWinDesc')}</p>
              <p>⏱️ <strong>{t('settings.bonusITT')}</strong> — {t('settings.bonusITTDesc')}</p>
              <p>👥 <strong>{t('settings.bonusTTT')}</strong> — {t('settings.bonusTTTDesc')}</p>
              <p>📊 <strong>{t('settings.bonusScorers')}</strong> — {t('settings.bonusScorersDesc')}</p>
            </div>
          </div>
        )}
      </div>

      {/* First Auction Date */}
      <div className="space-y-2">
        <Label>{t('settings.auctionDate')} *</Label>
        <p className="text-sm text-muted-foreground mb-2">
          {t('settings.auctionDateDesc')}
        </p>
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
                    onFirstAuctionDateChange(newDate);
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
                        onFirstAuctionDateChange(newDate);
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
                        onFirstAuctionDateChange(newDate);
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
    </div>
  );
}
