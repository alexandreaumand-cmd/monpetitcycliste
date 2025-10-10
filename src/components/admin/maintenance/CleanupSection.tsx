import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Trash2, RefreshCw, AlertTriangle } from "lucide-react";

export const CleanupSection = () => {
  const [cleanConfirmInput, setCleanConfirmInput] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const cleanMutation = useMutation({
    mutationFn: async (confirmPhrase: string) => {
      const { data, error } = await supabase.rpc('admin_clean_courses_phases', {
        p_confirm_phrase: confirmPhrase
      });
      if (error) throw error;
      return data as { success: boolean; deleted_courses: number; deleted_phases: number };
    },
    onSuccess: (data) => {
      toast({
        title: "Nettoyage effectué",
        description: `${data.deleted_courses} courses et ${data.deleted_phases} phases supprimées.`,
      });
      setCleanConfirmInput("");
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['phases'] });
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
    <Card className="border-orange-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-600">
          <Trash2 className="h-5 w-5" />
          Nettoyer Courses et Phases
        </CardTitle>
        <CardDescription>
          Supprime toutes les courses et phases pour permettre une réimportation complète
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-orange-500">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Attention:</strong> Cette opération supprimera toutes les courses et phases. 
            Les rosters et auctions existants deviendront orphelins. 
            Opération irréversible.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="clean-confirm">
            Tapez <code className="bg-muted px-2 py-1 rounded">NETTOYER COURSES PHASES</code> pour confirmer
          </Label>
          <Input
            id="clean-confirm"
            value={cleanConfirmInput}
            onChange={(e) => setCleanConfirmInput(e.target.value)}
            placeholder="NETTOYER COURSES PHASES"
            disabled={cleanMutation.isPending}
          />
        </div>

        <Button
          onClick={() => cleanMutation.mutate(cleanConfirmInput)}
          disabled={cleanConfirmInput !== "NETTOYER COURSES PHASES" || cleanMutation.isPending}
          variant="destructive"
          className="w-full"
        >
          {cleanMutation.isPending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Nettoyage en cours...
            </>
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              Nettoyer Courses et Phases
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
