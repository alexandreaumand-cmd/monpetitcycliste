import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { EquipeSelect } from "@/components/shared/EquipeSelect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { CoureurSearchCombobox } from "./CoureurSearchCombobox";

interface AddCoureurDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSaisonId?: string;
}

export const AddCoureurDialog = ({ open, onOpenChange, defaultSaisonId }: AddCoureurDialogProps) => {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedCoureurId, setSelectedCoureurId] = useState<string>("");
  const [saisonId, setSaisonId] = useState<string>(defaultSaisonId || "");
  const [equipeId, setEquipeId] = useState<string>("");
  const [prixInitial, setPrixInitial] = useState<number>(50);
  
  // Nouveau coureur
  const [newCoureurNom, setNewCoureurNom] = useState("");
  const [newCoureurUciId, setNewCoureurUciId] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Charger les saisons
  const { data: saisons } = useQuery({
    queryKey: ['saisons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saisons')
        .select('id, annee')
        .order('annee', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Note: La recherche des coureurs existants est maintenant gérée par CoureurSearchCombobox

  // Mutation pour ajouter un coureur existant à une saison
  const addExistingCoureurMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCoureurId || !saisonId) {
        throw new Error("Veuillez sélectionner un coureur et une saison");
      }

      // Vérifier si le coureur existe déjà dans cette saison (actif ou non)
      const { data: existing } = await supabase
        .from('coureurs_saisons')
        .select('id, actif')
        .eq('coureur_id', selectedCoureurId)
        .eq('saison_id', saisonId)
        .maybeSingle();

      if (existing) {
        if (existing.actif) {
          throw new Error("Ce coureur existe déjà pour cette saison");
        }
        
        // Réactiver le coureur inactif avec les nouvelles valeurs
        const { error } = await supabase
          .from('coureurs_saisons')
          .update({
            actif: true,
            equipe_id: equipeId || null,
            prix_initial: prixInitial,
          })
          .eq('id', existing.id);

        if (error) throw error;
        return { reactivated: true };
      }

      // Créer une nouvelle entrée
      const { error } = await supabase
        .from('coureurs_saisons')
        .insert({
          coureur_id: selectedCoureurId,
          saison_id: saisonId,
          equipe_id: equipeId || null,
          prix_initial: prixInitial,
        });

      if (error) throw error;
      return { reactivated: false };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-coureurs'] });
      toast({
        title: "✅ Coureur ajouté",
        description: data?.reactivated 
          ? "Le coureur a été réactivé pour cette saison" 
          : "Le coureur a été ajouté à la saison",
      });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation pour créer un nouveau coureur
  const createNewCoureurMutation = useMutation({
    mutationFn: async () => {
      if (!newCoureurNom || !saisonId) {
        throw new Error("Veuillez remplir le nom du coureur et sélectionner une saison");
      }

      // Générer un ID basé sur le nom (slug)
      const coureurId = newCoureurNom
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");

      // Vérifier si l'ID existe déjà
      const { data: existing } = await supabase
        .from('coureurs')
        .select('id')
        .eq('id', coureurId)
        .maybeSingle();

      if (existing) {
        throw new Error("Un coureur avec cet ID existe déjà. Utilisez l'onglet 'Coureur existant'.");
      }

      // Créer le coureur
      const { error: coureurError } = await supabase
        .from('coureurs')
        .insert({
          id: coureurId,
          nom: newCoureurNom,
          uci_id: newCoureurUciId || null,
          prix_initial: prixInitial,
        });

      if (coureurError) throw coureurError;

      // Ajouter à la saison
      const { error: saisonError } = await supabase
        .from('coureurs_saisons')
        .insert({
          coureur_id: coureurId,
          saison_id: saisonId,
          equipe_id: equipeId || null,
          prix_initial: prixInitial,
        });

      if (saisonError) throw saisonError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coureurs'] });
      queryClient.invalidateQueries({ queryKey: ['all-coureurs'] });
      toast({
        title: "✅ Nouveau coureur créé",
        description: "Le coureur a été créé et ajouté à la saison",
      });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedCoureurId("");
    setNewCoureurNom("");
    setNewCoureurUciId("");
    setEquipeId("");
    setPrixInitial(50);
    setMode("existing");
  };

  const handleSubmit = () => {
    if (mode === "existing") {
      addExistingCoureurMutation.mutate();
    } else {
      createNewCoureurMutation.mutate();
    }
  };

  const isLoading = addExistingCoureurMutation.isPending || createNewCoureurMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ajouter un coureur</DialogTitle>
          <DialogDescription>
            Ajoutez un coureur existant ou créez-en un nouveau pour une saison
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "existing" | "new")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Coureur existant</TabsTrigger>
            <TabsTrigger value="new">Nouveau coureur</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Coureur</Label>
              <CoureurSearchCombobox
                value={selectedCoureurId}
                onSelect={setSelectedCoureurId}
                placeholder="Sélectionner un coureur..."
              />
            </div>
          </TabsContent>

          <TabsContent value="new" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="new-nom">Nom complet *</Label>
              <Input
                id="new-nom"
                placeholder="ex: Tadej POGAČAR"
                value={newCoureurNom}
                onChange={(e) => setNewCoureurNom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-uci">UCI ID (optionnel)</Label>
              <Input
                id="new-uci"
                placeholder="ex: 10009765"
                value={newCoureurUciId}
                onChange={(e) => setNewCoureurUciId(e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Saison *</Label>
            <Select value={saisonId} onValueChange={setSaisonId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une saison" />
              </SelectTrigger>
              <SelectContent>
                {saisons?.map((saison) => (
                  <SelectItem key={saison.id} value={saison.id}>
                    {saison.annee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Équipe (optionnel)</Label>
            <EquipeSelect
              saisonId={saisonId || undefined}
              value={equipeId}
              onChange={setEquipeId}
              placeholder="Sélectionner une équipe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prix">Cote initiale *</Label>
            <Input
              id="prix"
              type="number"
              min={10}
              max={370}
              value={prixInitial}
              onChange={(e) => setPrixInitial(Number(e.target.value))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === "existing" ? "Ajouter à la saison" : "Créer le coureur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
