import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RotateCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FilterState {
  selectedSponsors: string[];
  pointsRange: [number, number];
  activeManagersOnly: boolean;
  showGapAnalysis: boolean;
}

interface RankingsFiltersProps {
  standings: Array<{ total_points: number; manager_id: string; [key: string]: any }>;
  currentFilters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  seasonId: string | undefined;
}

export const RankingsFilters = ({
  standings,
  currentFilters,
  onFilterChange,
  seasonId,
}: RankingsFiltersProps) => {
  // Calculer min/max des points disponibles
  const { minPoints, maxPoints } = useMemo(() => {
    if (!standings || standings.length === 0) {
      return { minPoints: 0, maxPoints: 1000 };
    }
    const points = standings.map(s => s.total_points || 0);
    return {
      minPoints: Math.min(...points),
      maxPoints: Math.max(...points),
    };
  }, [standings]);

  // Récupérer tous les sponsors uniques de la saison
  const { data: allSponsors } = useQuery({
    queryKey: ["all-sponsors", seasonId],
    queryFn: async () => {
      if (!seasonId) return [];

      const { data, error } = await supabase
        .from("manager_sponsors")
        .select("manager_id, sponsor, jersey_image_url")
        .eq("saison_id", seasonId);

      if (error) throw error;

      // Dédupliquer par sponsor
      const uniqueSponsors = new Map<string, any>();
      data?.forEach((item) => {
        if (!uniqueSponsors.has(item.sponsor)) {
          uniqueSponsors.set(item.sponsor, item);
        }
      });

      return Array.from(uniqueSponsors.values());
    },
    enabled: !!seasonId,
  });

  const handleReset = () => {
    onFilterChange({
      selectedSponsors: [],
      pointsRange: [minPoints, maxPoints],
      activeManagersOnly: false,
      showGapAnalysis: false,
    });
  };

  const toggleSponsor = (sponsor: string) => {
    const newSelected = currentFilters.selectedSponsors.includes(sponsor)
      ? currentFilters.selectedSponsors.filter((s) => s !== sponsor)
      : [...currentFilters.selectedSponsors, sponsor];
    onFilterChange({ ...currentFilters, selectedSponsors: newSelected });
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">🔍 Filtres avancés</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="h-8"
          >
            <RotateCcw className="h-4 w-4" />
            Réinitialiser
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtre par sponsors */}
        {allSponsors && allSponsors.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Sponsors</Label>
            <ScrollArea className="w-full">
              <div className="flex gap-2 pb-2">
                {allSponsors.map((sponsor) => {
                  const isSelected = currentFilters.selectedSponsors.includes(
                    sponsor.sponsor
                  );
                  return (
                    <Badge
                      key={sponsor.sponsor}
                      variant={isSelected ? "default" : "outline"}
                      className="cursor-pointer whitespace-nowrap flex items-center gap-2 px-3 py-1.5 transition-smooth"
                      onClick={() => toggleSponsor(sponsor.sponsor)}
                    >
                      {sponsor.jersey_image_url && (
                        <img
                          src={sponsor.jersey_image_url}
                          alt={sponsor.sponsor}
                          className="h-4 w-4 object-contain"
                        />
                      )}
                      <span>{sponsor.sponsor}</span>
                    </Badge>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Filtre par plage de points */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Plage de points</Label>
          <div className="px-2">
            <Slider
              min={minPoints}
              max={maxPoints}
              step={10}
              value={currentFilters.pointsRange}
              onValueChange={(value) =>
                onFilterChange({
                  ...currentFilters,
                  pointsRange: value as [number, number],
                })
              }
              className="w-full"
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground font-mono">
            <span>Min: {currentFilters.pointsRange[0]} pts</span>
            <span>Max: {currentFilters.pointsRange[1]} pts</span>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3 pt-2">
          <Label className="text-sm font-medium">Options</Label>
          <div className="flex items-center justify-between">
            <Label
              htmlFor="active-only"
              className="text-sm font-normal cursor-pointer"
            >
              Managers actifs uniquement
            </Label>
            <Switch
              id="active-only"
              checked={currentFilters.activeManagersOnly}
              onCheckedChange={(checked) =>
                onFilterChange({
                  ...currentFilters,
                  activeManagersOnly: checked,
                })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label
              htmlFor="gap-analysis"
              className="text-sm font-normal cursor-pointer"
            >
              Afficher l'analyse des écarts
            </Label>
            <Switch
              id="gap-analysis"
              checked={currentFilters.showGapAnalysis}
              onCheckedChange={(checked) =>
                onFilterChange({ ...currentFilters, showGapAnalysis: checked })
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
