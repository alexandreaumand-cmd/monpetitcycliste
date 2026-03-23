import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface CreateTeamDialogProps {
  sourceTeam: string;
  saisonId: string;
  onClose: () => void;
  onSuccess: (equipeId: string) => void;
}

export const CreateTeamDialog = ({ sourceTeam, saisonId, onClose, onSuccess }: CreateTeamDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    code_court: sourceTeam.toUpperCase(),
    nom_complet: '',
    pays: '',
    categorie: 'WT',
  });

  const handleCreate = async () => {
    if (!formData.nom_complet) {
      toast({
        variant: "destructive",
        title: "Champ requis",
        description: "Le nom complet de l'équipe est obligatoire",
      });
      return;
    }

    setIsLoading(true);

    try {
      const codeCourt = formData.code_court.toUpperCase();

      // Check if team already exists
      const { data: existing } = await supabase
        .from('equipes')
        .select('id')
        .eq('code_court', codeCourt)
        .maybeSingle();

      let equipeId: string;

      if (existing) {
        equipeId = existing.id;
        await supabase
          .from('equipes')
          .update({
            nom_complet: formData.nom_complet,
            pays: formData.pays || null,
          })
          .eq('id', equipeId);
      } else {
        const { data: newEquipe, error: equipeError } = await supabase
          .from('equipes')
          .insert({
            code_court: codeCourt,
            nom_complet: formData.nom_complet,
            pays: formData.pays || null,
          })
          .select()
          .single();
        if (equipeError) throw equipeError;
        equipeId = newEquipe.id;
      }

      // Check if already linked to this season
      const { data: existingES } = await supabase
        .from('equipes_saisons')
        .select('id')
        .eq('equipe_id', equipeId)
        .eq('saison_id', saisonId)
        .maybeSingle();

      if (existingES) {
        // Already exists, just reuse it
        onSuccess(equipeId);
        return;
      }

      const { error: esError } = await supabase
        .from('equipes_saisons')
        .insert({
          equipe_id: equipeId,
          saison_id: saisonId,
          nom_affiche: formData.nom_complet,
          trigramme: codeCourt,
          categorie: formData.categorie,
          actif: true,
        });

      if (esError) throw esError;

      toast({
        title: "Équipe créée",
        description: `${formData.code_court} a été créée pour la saison`,
      });

      onSuccess(newEquipe.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer une nouvelle équipe</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Trigramme</Label>
            <Input value={formData.code_court} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nom_complet">Nom complet de l'équipe *</Label>
            <Input
              id="nom_complet"
              value={formData.nom_complet}
              onChange={(e) => setFormData({ ...formData, nom_complet: e.target.value })}
              placeholder="Ex: UAE Team Emirates"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pays">Pays (optionnel)</Label>
            <Input
              id="pays"
              value={formData.pays}
              onChange={(e) => setFormData({ ...formData, pays: e.target.value })}
              placeholder="Ex: UAE"
            />
          </div>

          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Select
              value={formData.categorie}
              onValueChange={(value) => setFormData({ ...formData, categorie: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WT">WorldTour (WT)</SelectItem>
                <SelectItem value="PT">ProTeam (PT)</SelectItem>
                <SelectItem value="CT">Continental (CT)</SelectItem>
                <SelectItem value="OT">Autres</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button onClick={handleCreate} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer l'équipe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
