import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Copy, Loader2 } from "lucide-react";

export const SeasonPrepareManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sourceId, setSourceId] = useState<string>("");
  const [targetId, setTargetId] = useState<string>("");
  const [withEquipes, setWithEquipes] = useState(true);
  const [withBaremes, setWithBaremes] = useState(true);
  const [withCoureurs, setWithCoureurs] = useState(false);

  const { data: saisons } = useQuery({
    queryKey: ["saisons", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saisons")
        .select("id, annee")
        .order("annee", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const clone = useMutation({
    mutationFn: async () => {
      if (!sourceId || !targetId) throw new Error("Sélectionnez la saison source et la saison cible");
      if (sourceId === targetId) throw new Error("Les saisons doivent être différentes");
      const { data, error } = await supabase.rpc("clone_season_data", {
        p_source_saison: sourceId,
        p_target_saison: targetId,
        p_equipes: withEquipes,
        p_baremes: withBaremes,
        p_coureurs: withCoureurs,
      });
      if (error) throw error;
      return data as { equipes: number; baremes: number; coureurs: number };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["saisons"] });
      queryClient.invalidateQueries({ queryKey: ["coureurs-saisons"] });
      toast({
        title: "Duplication terminée",
        description: `${res.equipes} équipe(s), ${res.baremes} règle(s) de barème, ${res.coureurs} coureur(s) créés (les doublons ont été ignorés).`,
      });
    },
    onError: (e: Error) =>
      toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Copy className="h-5 w-5" />
          <CardTitle>Préparer une saison</CardTitle>
        </div>
        <CardDescription>
          Copier les données d'une saison existante vers une nouvelle saison. Les lignes déjà
          présentes ne sont jamais dupliquées.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Saison source</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                {(saisons ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.annee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Saison cible</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                {(saisons ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.annee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Checkbox
              id="clone-equipes"
              checked={withEquipes}
              onCheckedChange={(v) => setWithEquipes(v === true)}
            />
            <Label htmlFor="clone-equipes" className="font-normal">
              Équipes <span className="text-muted-foreground">(nom affiché, catégorie, trigramme)</span>
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="clone-baremes"
              checked={withBaremes}
              onCheckedChange={(v) => setWithBaremes(v === true)}
            />
            <Label htmlFor="clone-baremes" className="font-normal">
              Barèmes <span className="text-muted-foreground">(règles de points)</span>
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="clone-coureurs"
              checked={withCoureurs}
              onCheckedChange={(v) => setWithCoureurs(v === true)}
            />
            <Label htmlFor="clone-coureurs" className="font-normal">
              Coureurs <span className="text-muted-foreground">(équipe + côte, à ajuster ensuite)</span>
            </Label>
          </div>
        </div>

        <Button
          onClick={() => clone.mutate()}
          disabled={clone.isPending || !sourceId || !targetId}
        >
          {clone.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Copy className="mr-2 h-4 w-4" />
          Copier les données
        </Button>
      </CardContent>
    </Card>
  );
};
