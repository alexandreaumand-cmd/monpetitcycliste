import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type League = {
  id: string;
  name: string;
};

export function LeagueDeleteManager({ league }: { league: League }) {
  const navigate = useNavigate();
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [deleting, setDeleting] = useState(false);

  const expectedPhrase = `DELETE LEAGUE ${league.name}`;
  const isConfirmValid = confirmPhrase === expectedPhrase;

  async function handleDelete() {
    if (!isConfirmValid) {
      toast.error("Phrase de confirmation incorrecte");
      return;
    }

    setDeleting(true);

    try {
      const { data, error } = await supabase.functions.invoke('leagues-delete-full', {
        body: {
          league_id: league.id,
          league_name: league.name,
          confirmation_phrase: confirmPhrase
        }
      });

      if (error) throw error;

      toast.success(`Ligue "${league.name}" supprimée avec succès`, {
        description: `${Object.values(data.deleted).reduce((a: number, b: number) => a + b, 0)} entrées supprimées`
      });

      // Rediriger vers la liste des ligues
      navigate('/admin/leagues');
    } catch (error: any) {
      console.error('Error deleting league:', error);
      toast.error("Erreur lors de la suppression", {
        description: error.message || "Une erreur inconnue s'est produite"
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Zone dangereuse
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <strong>⚠️ Attention : Cette action est irréversible !</strong>
            <br /><br />
            La suppression de cette ligue effacera définitivement :
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Tous les rosters (effectifs des managers)</li>
              <li>Toutes les enchères et offres</li>
              <li>Tous les points et bonus de la ligue</li>
              <li>Tous les membres et invitations</li>
              <li>Tous les paramètres de la ligue</li>
            </ul>
            <br />
            <strong>Les données suivantes seront préservées :</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Les coureurs et leurs informations</li>
              <li>Les courses et résultats</li>
              <li>Les barèmes de points</li>
              <li>Les phases et saisons</li>
              <li>Les managers (qui pourront rejoindre d'autres ligues)</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="confirm-phrase" className="text-sm font-medium">
            Pour confirmer, tapez exactement :
          </Label>
          <code className="block p-2 bg-muted rounded text-sm font-mono">
            {expectedPhrase}
          </code>
          <Input
            id="confirm-phrase"
            value={confirmPhrase}
            onChange={(e) => setConfirmPhrase(e.target.value)}
            placeholder="DELETE LEAGUE ..."
            className="font-mono"
            disabled={deleting}
          />
        </div>

        <Button
          variant="destructive"
          disabled={!isConfirmValid || deleting}
          onClick={handleDelete}
          className="w-full"
        >
          {deleting ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Suppression en cours...
            </>
          ) : (
            "Supprimer définitivement la ligue"
          )}
        </Button>

        {!isConfirmValid && confirmPhrase.length > 0 && (
          <p className="text-sm text-destructive">
            La phrase ne correspond pas exactement
          </p>
        )}
      </CardContent>
    </Card>
  );
}
