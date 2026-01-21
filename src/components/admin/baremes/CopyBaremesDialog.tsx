import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Copy, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CopyBaremesDialogProps {
  saisons: any[];
  onCopy: (params: {
    sourceSaisonId: string;
    targetSaisonId: string;
    filters?: { categorie?: string; type_classement?: string };
  }) => void;
}

const categories = [
  "WT Monument",
  "WT GT",
  "Classiques WT Cat 1",
  "Classiques WT Cat 2",
  "Classiques WT Cat 3",
  "Tours WT Cat 1",
  "Tours WT Cat 2",
  "Tours WT Cat 3",
  "1.1",
  "1.pro",
  "2.1",
  "2.pro",
  "CN_ITT Cat 1",
  "CN_ITT Cat 2",
  "CN_ITT Cat 3",
  "CN_ITT Cat 4",
  "CN_RR Cat 1",
  "CN_RR Cat 2",
  "CN_RR Cat 3",
  "CN_RR Cat 4",
  "EC ITT",
  "EC RR",
  "WC ITT",
  "WC RR",
];

const typeClassements = [
  { value: "General", label: "Général" },
  { value: "Etape", label: "Étape" },
  { value: "Points", label: "Points" },
  { value: "Montagne", label: "Montagne" },
  { value: "Jeune", label: "Jeune" },
  { value: "Combatif", label: "Combativité" },
  { value: "Porteur Leader", label: "🟡 Porteur Jaune" },
  { value: "Porteur Vert", label: "🟢 Porteur Vert" },
  { value: "Porteur Montagne", label: "🔴 Porteur Pois" },
  { value: "Porteur Jeune", label: "⚪ Porteur Blanc" },
  { value: "Porteur Combattif", label: "🔵 Porteur Combativité" },
];

export function CopyBaremesDialog({ saisons, onCopy }: CopyBaremesDialogProps) {
  const [open, setOpen] = useState(false);
  const [sourceSaisonId, setSourceSaisonId] = useState("");
  const [targetSaisonId, setTargetSaisonId] = useState("");
  const [categorie, setCategorie] = useState<string>("");
  const [typeClassement, setTypeClassement] = useState<string>("");

  // Query pour compter les barèmes qui seront copiés
  const { data: previewCount } = useQuery({
    queryKey: ['baremes-copy-preview', sourceSaisonId, categorie, typeClassement],
    queryFn: async () => {
      if (!sourceSaisonId) return 0;

      let query = supabase
        .from('scoring_rules_saisons')
        .select('*', { count: 'exact', head: true })
        .eq('saison_id', sourceSaisonId);
      
      if (categorie) {
        query = query.eq('categorie', categorie);
      }
      if (typeClassement) {
        query = query.eq('type_classement', typeClassement as any);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    enabled: !!sourceSaisonId,
  });

  const handleCopy = () => {
    const filters: any = {};
    if (categorie) filters.categorie = categorie;
    if (typeClassement) filters.type_classement = typeClassement;

    onCopy({
      sourceSaisonId,
      targetSaisonId,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    });

    // Reset form
    setSourceSaisonId("");
    setTargetSaisonId("");
    setCategorie("");
    setTypeClassement("");
    setOpen(false);
  };

  const isValid = sourceSaisonId && targetSaisonId && sourceSaisonId !== targetSaisonId;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Copy className="h-4 w-4 mr-2" />
          Copier des barèmes
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Copier des barèmes</DialogTitle>
          <DialogDescription>
            Dupliquez les barèmes d'une saison vers une autre saison
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="source-saison">Saison source</Label>
            <Select value={sourceSaisonId} onValueChange={setSourceSaisonId}>
              <SelectTrigger id="source-saison">
                <SelectValue placeholder="Sélectionner la saison source" />
              </SelectTrigger>
              <SelectContent>
                {saisons.map((saison) => (
                  <SelectItem key={saison.id} value={saison.id}>
                    {saison.annee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-saison">Saison cible</Label>
            <Select value={targetSaisonId} onValueChange={setTargetSaisonId}>
              <SelectTrigger id="target-saison">
                <SelectValue placeholder="Sélectionner la saison cible" />
              </SelectTrigger>
              <SelectContent>
                {saisons.map((saison) => (
                  <SelectItem 
                    key={saison.id} 
                    value={saison.id}
                    disabled={saison.id === sourceSaisonId}
                  >
                    {saison.annee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-sm text-muted-foreground">
              Filtres optionnels (laisser vide pour tout copier)
            </Label>

            <div className="space-y-2">
              <Label htmlFor="categorie" className="text-sm">Catégorie</Label>
              <Select value={categorie} onValueChange={setCategorie}>
                <SelectTrigger id="categorie">
                  <SelectValue placeholder="Toutes les catégories" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type-classement" className="text-sm">Type de classement</Label>
              <Select value={typeClassement} onValueChange={setTypeClassement}>
                <SelectTrigger id="type-classement">
                  <SelectValue placeholder="Tous les types" />
                </SelectTrigger>
                <SelectContent>
                  {typeClassements.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {sourceSaisonId && previewCount !== undefined && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {previewCount} barème(s) seront copiés
              </AlertDescription>
            </Alert>
          )}

          {sourceSaisonId === targetSaisonId && sourceSaisonId && (
            <Alert variant="destructive">
              <AlertDescription>
                La saison source et la saison cible doivent être différentes
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleCopy} disabled={!isValid || previewCount === 0}>
            Copier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
