import { useState, useCallback, useMemo } from "react";
import { Plus, Minus, Bike, Flag, Users, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface RaceGroup {
  name: string;
  riders: string[];
  riderIds: string[];
  riderCount: number;
  gap: string; // "0:00" or "+1:30"
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
}

const DEFAULT_GROUP: RaceGroup = {
  name: "",
  riders: [],
  riderIds: [],
  riderCount: 1,
  gap: "0:00",
  isPeloton: false,
};

export const RaceSituationEditor = ({
  onBroadcast,
  disabled,
  startlistRiders = [],
}: RaceSituationEditorProps) => {
  const [groups, setGroups] = useState<RaceGroup[]>([
    { name: "Échappée", riders: [], riderIds: [], riderCount: 3, gap: "0:00", isPeloton: false },
    { name: "Peloton", riders: [], riderIds: [], riderCount: 150, gap: "+4:00", isPeloton: true },
  ]);
  const [kmRemaining, setKmRemaining] = useState(100);

  // Build a name→id lookup from startlist
  const riderLookup = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of startlistRiders) {
      map[r.nom.toLowerCase()] = r.coureur_id;
    }
    return map;
  }, [startlistRiders]);

  const updateGroup = useCallback((index: number, partial: Partial<RaceGroup>) => {
    setGroups((prev) => prev.map((g, i) => (i === index ? { ...g, ...partial } : g)));
  }, []);

  /** When riders text changes, also resolve riderIds from startlist */
  const handleRidersChange = useCallback((index: number, text: string) => {
    const names = text.split("\n").filter((r) => r.trim());
    const ids = names.map((name) => {
      // Try exact match first, then lowercase
      const key = name.trim().toLowerCase();
      return riderLookup[key] || "";
    });
    updateGroup(index, { riders: names, riderIds: ids });
  }, [riderLookup, updateGroup]);

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
        {groups.map((group, index) => (
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

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Coureurs clés (un par ligne)
              </Label>
              <Textarea
                value={group.riders.join("\n")}
                onChange={(e) => handleRidersChange(index, e.target.value)}
                className="min-h-[60px] text-xs"
                placeholder="Pogačar&#10;Vingegaard&#10;Evenepoel"
              />
              {startlistRiders.length > 0 && group.riders.length === 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Saisissez les noms depuis la startlist
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

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
