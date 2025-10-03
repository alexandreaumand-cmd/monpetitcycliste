import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export const CoursesResetManager = () => {
  const [resetType, setResetType] = useState<'by_saison' | 'all'>('by_saison');
  const [selectedSaison, setSelectedSaison] = useState<string>("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [resetting, setResetting] = useState(false);
  const { toast } = useToast();

  // Fetch saisons
  const { data: saisons } = useQuery({
    queryKey: ['saisons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saisons')
        .select('*')
        .order('annee', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const handleReset = async () => {
    const expectedPhrase = resetType === 'by_saison' 
      ? 'RESET COURSES SAISON' 
      : 'RESET ALL COURSES';

    if (confirmPhrase !== expectedPhrase) {
      toast({
        title: "Erreur",
        description: `Veuillez taper exactement: ${expectedPhrase}`,
        variant: "destructive",
      });
      return;
    }

    if (resetType === 'by_saison' && !selectedSaison) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une saison",
        variant: "destructive",
      });
      return;
    }

    setResetting(true);

    try {
      const { data, error } = await supabase.functions.invoke('reset-courses', {
        body: {
          type: resetType,
          saison_id: resetType === 'by_saison' ? selectedSaison : undefined,
          confirm_phrase: confirmPhrase,
        },
      });

      if (error) throw error;

      toast({
        title: "✅ Reset réussi",
        description: data.message,
      });

      // Reset form
      setConfirmPhrase("");
      setSelectedSaison("");

    } catch (error) {
      console.error('Reset error:', error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors du reset",
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  const expectedPhrase = resetType === 'by_saison' 
    ? 'RESET COURSES SAISON' 
    : 'RESET ALL COURSES';

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive">🗑️ Reset des Courses</CardTitle>
        <CardDescription>
          Supprimer les courses de manière ciblée ou complète (action irréversible)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Reset type selection */}
        <div className="space-y-2">
          <Label>Type de reset</Label>
          <Select
            value={resetType}
            onValueChange={(value) => setResetType(value as 'by_saison' | 'all')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="by_saison">Par saison (ciblé)</SelectItem>
              <SelectItem value="all">Toutes les courses</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Saison selection (only for by_saison) */}
        {resetType === 'by_saison' && (
          <div className="space-y-2">
            <Label>Sélectionner une saison</Label>
            <Select
              value={selectedSaison}
              onValueChange={setSelectedSaison}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir une saison..." />
              </SelectTrigger>
              <SelectContent>
                {saisons?.map((saison) => (
                  <SelectItem key={saison.id} value={saison.id}>
                    Saison {saison.annee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Warning alert */}
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-2">⚠️ ATTENTION: Action irréversible</p>
            <p className="text-sm">
              {resetType === 'by_saison' 
                ? "Cette action supprimera toutes les courses de la saison sélectionnée."
                : "Cette action supprimera TOUTES les courses de la base de données."}
            </p>
            <p className="text-sm mt-2">
              Les données ne pourront pas être récupérées après cette opération.
            </p>
          </AlertDescription>
        </Alert>

        {/* Confirmation input */}
        <div className="space-y-2">
          <Label>Phrase de confirmation</Label>
          <Input
            type="text"
            value={confirmPhrase}
            onChange={(e) => setConfirmPhrase(e.target.value)}
            placeholder={expectedPhrase}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Tapez exactement: <code className="bg-muted px-1">{expectedPhrase}</code>
          </p>
        </div>

        {/* Reset button */}
        <Button
          onClick={handleReset}
          disabled={resetting || confirmPhrase !== expectedPhrase || 
                   (resetType === 'by_saison' && !selectedSaison)}
          variant="destructive"
          className="w-full"
        >
          {resetting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Suppression en cours...
            </>
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer les courses
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
