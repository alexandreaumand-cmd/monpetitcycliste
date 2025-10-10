import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Calendar, RefreshCw } from "lucide-react";

export const PhaseUpdateSection = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updatePhasesMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('update-race-phases');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Phases mises à jour",
        description: `${data.coursesUpdated} courses ont été réassignées aux bonnes phases.`,
      });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Mise à jour des phases des courses
        </CardTitle>
        <CardDescription>
          Réassigner les courses à leurs phases correctes selon le calendrier
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Cette opération met à jour le <code className="bg-muted px-2 py-1 rounded">phase_id</code> de chaque course
          selon le mapping défini dans le fichier CSV de référence. Les courses seront réparties entre les 4 phases de la saison.
        </p>
        <Button
          onClick={() => updatePhasesMutation.mutate()}
          disabled={updatePhasesMutation.isPending}
          variant="default"
        >
          {updatePhasesMutation.isPending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Mise à jour en cours...
            </>
          ) : (
            <>
              <Calendar className="mr-2 h-4 w-4" />
              Mettre à jour les phases
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
