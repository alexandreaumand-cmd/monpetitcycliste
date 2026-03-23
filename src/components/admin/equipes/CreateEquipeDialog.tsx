import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface CreateEquipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSaisonId?: string;
}

export const CreateEquipeDialog = ({ open, onOpenChange, defaultSaisonId }: CreateEquipeDialogProps) => {
  const [formData, setFormData] = useState({
    saison_id: defaultSaisonId || "",
    trigramme: "",
    nom_complet: "",
    nom_affiche: "",
    pays: "",
    categorie: "",
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: saisons } = useQuery({
    queryKey: ['saisons-for-create'],
    queryFn: async () => {
      const { data } = await supabase
        .from('saisons')
        .select('id, annee')
        .order('annee', { ascending: false });
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const codeCourt = formData.trigramme.toUpperCase().trim();

      // Step 1: Check if team already exists by code_court
      const { data: existing } = await supabase
        .from('equipes')
        .select('id')
        .eq('code_court', codeCourt)
        .maybeSingle();

      let equipeId: string;

      if (existing) {
        equipeId = existing.id;
        // Optionally update nom_complet/pays
        await supabase
          .from('equipes')
          .update({
            nom_complet: formData.nom_complet.trim(),
            pays: formData.pays.trim() || null,
          })
          .eq('id', equipeId);
      } else {
        const { data: newEquipe, error: equipeError } = await supabase
          .from('equipes')
          .insert({
            code_court: codeCourt,
            nom_complet: formData.nom_complet.trim(),
            pays: formData.pays.trim() || null,
          })
          .select()
          .single();
        if (equipeError) throw equipeError;
        equipeId = newEquipe.id;
      }

      // Step 2: Check if equipes_saisons entry already exists
      const { data: existingES } = await supabase
        .from('equipes_saisons')
        .select('id')
        .eq('equipe_id', equipeId)
        .eq('saison_id', formData.saison_id)
        .maybeSingle();

      if (existingES) {
        throw new Error(`Cette équipe (${codeCourt}) est déjà associée à cette saison`);
      }

      const { error: saisonError } = await supabase
        .from('equipes_saisons')
        .insert({
          equipe_id: equipeId,
          saison_id: formData.saison_id,
          nom_affiche: formData.nom_affiche.trim() || formData.nom_complet.trim(),
          trigramme: codeCourt,
          categorie: formData.categorie || null,
          actif: true,
        });

      if (saisonError) throw saisonError;

      return { id: equipeId, nom_complet: formData.nom_complet.trim() };
    },
    onSuccess: (newEquipe) => {
      queryClient.invalidateQueries({ queryKey: ['admin-equipes-saisons'] });
      toast({
        title: "✅ Équipe créée",
        description: `${newEquipe.nom_complet} a été créée avec succès`,
      });
      onOpenChange(false);
      // Reset form
      setFormData({
        saison_id: defaultSaisonId || "",
        trigramme: "",
        nom_complet: "",
        nom_affiche: "",
        pays: "",
        categorie: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erreur",
        description: error.message || "Impossible de créer l'équipe",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.saison_id || !formData.trigramme || !formData.nom_complet) {
      toast({
        title: "⚠️ Champs manquants",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate();
  };

  // Auto-fill nom_affiche when nom_complet changes
  const handleNomCompletChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      nom_complet: value,
      // Only auto-fill if nom_affiche is empty
      nom_affiche: prev.nom_affiche === "" ? value : prev.nom_affiche,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Créer une nouvelle équipe</DialogTitle>
          <DialogDescription>
            Créer une équipe et l'associer à une saison
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Saison */}
          <div className="space-y-2">
            <Label htmlFor="saison">Saison *</Label>
            <Select
              value={formData.saison_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, saison_id: value }))}
            >
              <SelectTrigger id="saison">
                <SelectValue placeholder="Sélectionner une saison" />
              </SelectTrigger>
              <SelectContent>
                {saisons?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    Saison {s.annee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Trigramme */}
            <div className="space-y-2">
              <Label htmlFor="trigramme">Trigramme / Code court *</Label>
              <Input
                id="trigramme"
                placeholder="Ex: UAE, DQT, INE"
                value={formData.trigramme}
                onChange={(e) => setFormData(prev => ({ ...prev, trigramme: e.target.value }))}
                maxLength={10}
              />
            </div>

            {/* Catégorie */}
            <div className="space-y-2">
              <Label htmlFor="categorie">Catégorie *</Label>
              <Select
                value={formData.categorie}
                onValueChange={(value) => setFormData(prev => ({ ...prev, categorie: value }))}
              >
                <SelectTrigger id="categorie">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WT">WorldTeam (WT)</SelectItem>
                  <SelectItem value="PT">ProTeam (PT)</SelectItem>
                  <SelectItem value="CT">Continental (CT)</SelectItem>
                  <SelectItem value="OT">Autres (OT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Nom complet */}
          <div className="space-y-2">
            <Label htmlFor="nom_complet">Nom complet *</Label>
            <Input
              id="nom_complet"
              placeholder="Ex: UAE Team Emirates"
              value={formData.nom_complet}
              onChange={(e) => handleNomCompletChange(e.target.value)}
            />
          </div>

          {/* Nom affiché */}
          <div className="space-y-2">
            <Label htmlFor="nom_affiche">Nom affiché</Label>
            <Input
              id="nom_affiche"
              placeholder="Par défaut = nom complet"
              value={formData.nom_affiche}
              onChange={(e) => setFormData(prev => ({ ...prev, nom_affiche: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Nom utilisé dans l'application (si différent du nom complet)
            </p>
          </div>

          {/* Pays */}
          <div className="space-y-2">
            <Label htmlFor="pays">Pays</Label>
            <Input
              id="pays"
              placeholder="Ex: UAE, BEL, FRA"
              value={formData.pays}
              onChange={(e) => setFormData(prev => ({ ...prev, pays: e.target.value }))}
              maxLength={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer l'équipe
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
