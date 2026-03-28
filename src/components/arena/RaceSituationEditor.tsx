import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Plus, Minus, Bike, Flag, Users, Send, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface RaceGroup {
  name: string;
  riders: string[];
  riderIds: string[];
  riderCount: number;
  gap: string;
  isPeloton: boolean;
}

export interface RaceSituation {
  groups: RaceGroup[];
  kmRemaining: number;
}

interface RaceSituationEditorProps {
  onBroadcast: (situation: RaceSituation) => void;
  disabled?: boolean;
  startlistRiders?: { nom: string; coureur_id: string }[];
  importedSituation?: RaceSituation | null;
  rosterOwners?: Record<string, string>;
}

const DEFAULT_GROUP: RaceGroup = {
  name: "",
  riders: [],
  riderIds: [],
  riderCount: 1,
  gap: "0:00",
  isPeloton: false,
};

/** Normalize text for search: lowercase, remove accents */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export const RaceSituationEditor = ({
  onBroadcast,
  disabled,
  startlistRiders = [],
  importedSituation,
  rosterOwners = {},
}: RaceSituationEditorProps) => {
  const [groups, setGroups] = useState<RaceGroup[]>([
    { name: "Échappée", riders: [], riderIds: [], riderCount: 3, gap: "0:00", isPeloton: false },
    { name: "Peloton", riders: [], riderIds: [], riderCount: 150, gap: "+4:00", isPeloton: true },
  ]);
  const [kmRemaining, setKmRemaining] = useState(100);
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});
  const [focusedGroup, setFocusedGroup] = useState<number | null>(null);
  const [hasImported, setHasImported] = useState(false);

  // Apply imported situation when it changes
  const prevImportRef = useRef(importedSituation);
  if (importedSituation && importedSituation !== prevImportRef.current && !hasImported) {
    prevImportRef.current = importedSituation;
    if (importedSituation.groups.length > 0) {
      setGroups(importedSituation.groups);
      if (importedSituation.kmRemaining > 0) setKmRemaining(importedSituation.kmRemaining);
      setHasImported(true);
    }
  }

  // Already-assigned rider IDs across all groups
  const usedRiderIds = useMemo(() => {
    const set = new Set<string>();
    for (const g of groups) {
      for (const id of g.riderIds) {
        if (id) set.add(id);
      }
    }
    return set;
  }, [groups]);

  const updateGroup = useCallback((index: number, partial: Partial<RaceGroup>) => {
    setGroups((prev) => prev.map((g, i) => (i === index ? { ...g, ...partial } : g)));
  }, []);

  const addRiderToGroup = useCallback((groupIndex: number, rider: { nom: string; coureur_id: string }) => {
    setGroups((prev) => prev.map((g, i) => {
      if (i !== groupIndex) return g;
      if (g.riderIds.includes(rider.coureur_id)) return g; // already added
      return {
        ...g,
        riders: [...g.riders, rider.nom],
        riderIds: [...g.riderIds, rider.coureur_id],
      };
    }));
    setSearchTerms((prev) => ({ ...prev, [groupIndex]: "" }));
  }, []);

  const removeRiderFromGroup = useCallback((groupIndex: number, riderIndex: number) => {
    setGroups((prev) => prev.map((g, i) => {
      if (i !== groupIndex) return g;
      return {
        ...g,
        riders: g.riders.filter((_, ri) => ri !== riderIndex),
        riderIds: g.riderIds.filter((_, ri) => ri !== riderIndex),
      };
    }));
  }, []);

  const getFilteredRiders = useCallback((groupIndex: number) => {
    const term = normalize(searchTerms[groupIndex] || "");
    if (!term || term.length < 2) return [];
    return startlistRiders
      .filter((r) => !usedRiderIds.has(r.coureur_id))
      .filter((r) => normalize(r.nom).includes(term))
      .slice(0, 8);
  }, [searchTerms, startlistRiders, usedRiderIds]);

  const addGroup = () => {
    setGroups((prev) => [...prev, { ...DEFAULT_GROUP, name: `Groupe ${prev.length + 1}` }]);
  };

  const removeGroup = (index: number) => {
    setGroups((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBroadcast = () => {
    const situation: RaceSituation = { groups, kmRemaining };
    onBroadcast(situation);
  };

  const setPeloton = (index: number) => {
    setGroups((prev) =>
      prev.map((g, i) => ({ ...g, isPeloton: i === index }))
    );
  };

  return (
    <div className="space-y-4">
      {/* Km remaining */}
      <div className="flex items-center gap-3">
        <Flag className="h-4 w-4 text-muted-foreground shrink-0" />
        <Label className="text-sm font-medium shrink-0">Km restants</Label>
        <Input
          type="number"
          value={kmRemaining}
          onChange={(e) => setKmRemaining(Number(e.target.value))}
          className="w-24 h-8"
          min={0}
        />
      </div>

      {/* Groups */}
      <div className="space-y-3">
        {groups.map((group, index) => {
          const filtered = getFilteredRiders(index);
          const searchTerm = searchTerms[index] || "";

          return (
            <div
              key={index}
              className={cn(
                "border rounded-lg p-3 space-y-3 transition-colors",
                group.isPeloton ? "bg-primary/5 border-primary/30" : "bg-muted/20"
              )}
            >
              <div className="flex items-center gap-2">
                <Bike className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  value={group.name}
                  onChange={(e) => updateGroup(index, { name: e.target.value })}
                  className="h-8 text-sm font-medium flex-1"
                  placeholder="Nom du groupe"
                />
                <Button
                  variant={group.isPeloton ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs shrink-0"
                  onClick={() => setPeloton(index)}
                >
                  <Users className="h-3 w-3 mr-1" />
                  Peloton
                </Button>
                {groups.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 shrink-0"
                    onClick={() => removeGroup(index)}
                  >
                    <Minus className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nb coureurs</Label>
                  <Input
                    type="number"
                    value={group.riderCount}
                    onChange={(e) => updateGroup(index, { riderCount: Number(e.target.value) })}
                    className="h-8"
                    min={1}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Écart</Label>
                  <Input
                    value={group.gap}
                    onChange={(e) => updateGroup(index, { gap: e.target.value })}
                    className="h-8"
                    placeholder="+0:00"
                  />
                </div>
              </div>

              {/* Rider autocomplete search */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Coureurs clés
                </Label>

                {/* Selected riders as badges */}
                {group.riders.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {group.riders.map((name, ri) => (
                      <Badge
                        key={ri}
                        variant="secondary"
                        className="text-xs gap-1 pr-1"
                      >
                        {name}
                        {rosterOwners[group.riderIds[ri]] && (
                          <span className="text-[10px] text-muted-foreground ml-0.5">
                            ({rosterOwners[group.riderIds[ri]]})
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeRiderFromGroup(index, ri)}
                          className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Search input */}
                <div className="relative">
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerms((prev) => ({ ...prev, [index]: e.target.value }))}
                    onFocus={() => setFocusedGroup(index)}
                    onBlur={() => setTimeout(() => setFocusedGroup(null), 200)}
                    className="h-8 text-xs"
                    placeholder="Rechercher un coureur..."
                  />

                  {/* Dropdown suggestions */}
                  {focusedGroup === index && filtered.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-md bg-popover shadow-md max-h-[200px] overflow-y-auto">
                      {filtered.map((rider) => (
                        <button
                          key={rider.coureur_id}
                          type="button"
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault(); // prevent blur before click
                            addRiderToGroup(index, rider);
                          }}
                        >
                          {rider.nom}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {startlistRiders.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Aucune startlist disponible pour cette course
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live preview */}
      {groups.length > 0 && (
        <div className="border-t pt-4 space-y-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase font-bold tracking-wider">Aperçu</span>
          </div>
          <div className="bg-muted/30 p-3 rounded-lg border border-dashed">
            <RaceSituationDisplay
              groups={groups}
              kmRemaining={kmRemaining}
              rosterOwners={rosterOwners}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={addGroup} className="flex-1">
          <Plus className="h-4 w-4 mr-1" />
          Ajouter un groupe
        </Button>
        <Button
          size="sm"
          onClick={handleBroadcast}
          disabled={disabled || groups.length === 0}
          className="flex-1"
        >
          <Send className="h-4 w-4 mr-1" />
          Diffuser la situation
        </Button>
      </div>
    </div>
  );
};
