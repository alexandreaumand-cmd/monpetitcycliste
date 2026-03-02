import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EquipeSelect } from "@/components/shared/EquipeSelect";
import { CreateTeamDialog } from "./CreateTeamDialog";
import { generateCoureurId } from "@/utils/coureurIdGenerator";

function cleanSourceTeam(sourceTeam: string): string {
  return sourceTeam.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function convertNameFormat(sourceName: string): string {
  if (!sourceName) return '';
  const words = sourceName.trim().split(/\s+/);
  if (words.length <= 1) {
    return sourceName.charAt(0).toUpperCase() + sourceName.slice(1).toLowerCase();
  }
  const upperWords: string[] = [];
  const otherWords: string[] = [];
  for (const w of words) {
    if (w.length > 1 && w === w.toUpperCase() && /[A-ZÀ-Ü]/.test(w)) {
      upperWords.push(w);
    } else {
      otherWords.push(w);
    }
  }
  if (upperWords.length === 0 || otherWords.length === 0) {
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  const firstName = otherWords.join(' ');
  const lastName = upperWords.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return `${firstName} ${lastName}`;
}

interface CreateRiderDialogProps {
  entry: any;
  saisonId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateRiderDialog = ({ entry, saisonId, onClose, onSuccess }: CreateRiderDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [formData, setFormData] = useState({
    nom: convertNameFormat(entry.source_name) || '',
    uci_id: '',
    prix_initial: 10,
    equipe_id: '',
  });

  useEffect(() => {
    const findTeam = async () => {
      if (!entry.source_team || !saisonId) return;

      const cleaned = cleanSourceTeam(entry.source_team);

      // Try by nom_affiche first
      const { data: byName } = await supabase
        .from('equipes_saisons')
        .select('equipe_id')
        .eq('saison_id', saisonId)
        .ilike('nom_affiche', cleaned)
        .limit(1)
        .maybeSingle();

      if (byName) {
        setFormData((prev) => ({ ...prev, equipe_id: byName.equipe_id }));
        return;
      }

      // Try by trigramme or code_court
      const { data: byCode } = await supabase
        .from('equipes_saisons')
        .select('equipe_id, equipes!inner(code_court)')
        .eq('saison_id', saisonId)
        .or(`trigramme.ilike.${cleaned},equipes.code_court.ilike.${cleaned}`)
        .limit(1)
        .maybeSingle();

      if (byCode) {
        setFormData((prev) => ({ ...prev, equipe_id: byCode.equipe_id }));
        return;
      }

      setShowCreateTeam(true);
    };

    findTeam();
  }, [entry.source_team, saisonId]);

  const handleCreate = async () => {
    if (!formData.nom || !formData.equipe_id) {
      toast({
        variant: "destructive",
        title: "Champs requis",
        description: "Le nom et l'équipe sont obligatoires",
      });
      return;
    }

    setIsLoading(true);

    try {
      const coureurId = generateCoureurId(formData.nom);

      const { data: newCoureur, error: coureurError } = await supabase
        .from('coureurs')
        .insert({
          id: coureurId,
          nom: formData.nom,
          uci_id: formData.uci_id || null,
          equipe: entry.source_team,
          prix_initial: formData.prix_initial,
        })
        .select()
        .single();

      if (coureurError) throw coureurError;

      const { error: csError } = await supabase
        .from('coureurs_saisons')
        .insert({
          coureur_id: newCoureur.id,
          saison_id: saisonId,
          equipe_id: formData.equipe_id,
          prix_initial: formData.prix_initial,
          actif: true,
        });

      if (csError) throw csError;

      await supabase
        .from('startlist_entries')
        .update({
          coureur_id: newCoureur.id,
          status: 'confirmed',
        })
        .eq('id', entry.id);

      if (formData.nom !== entry.source_name) {
        await supabase.from('name_aliases').insert({
          coureur_id: newCoureur.id,
          alias_text: entry.source_name,
        });
      }

      toast({
        title: "Coureur créé",
        description: `${formData.nom} a été créé et matché avec succès`,
      });

      onSuccess();
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

  if (showCreateTeam && !formData.equipe_id) {
    return (
      <CreateTeamDialog
        sourceTeam={entry.source_team}
        saisonId={saisonId}
        onClose={onClose}
        onSuccess={(equipeId) => {
          setFormData((prev) => ({ ...prev, equipe_id: equipeId }));
          setShowCreateTeam(false);
        }}
      />
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Créer un nouveau coureur</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Source: {entry.source_name} ({entry.source_team})
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom du coureur *</Label>
              <Input
                id="nom"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                placeholder="Ex: Tadej Pogačar"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="uci_id">UCI ID (optionnel)</Label>
              <Input
                id="uci_id"
                value={formData.uci_id}
                onChange={(e) => setFormData({ ...formData, uci_id: e.target.value })}
                placeholder="Ex: 10009765204"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prix_initial">Prix initial</Label>
              <Input
                id="prix_initial"
                type="number"
                value={formData.prix_initial}
                onChange={(e) => setFormData({ ...formData, prix_initial: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label>Équipe UCI *</Label>
              <EquipeSelect
                saisonId={saisonId}
                value={formData.equipe_id}
                onChange={(value) => setFormData({ ...formData, equipe_id: value })}
              />
              {!formData.equipe_id && entry.source_team && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateTeam(true)}
                >
                  Créer l'équipe {entry.source_team}
                </Button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button onClick={handleCreate} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer le coureur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
