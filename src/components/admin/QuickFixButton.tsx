import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export const QuickFixVueltaJeune = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleFix = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('admin-fix-race-result', {
        body: {
          race_result_id: '0dcf3306-0fc9-452b-930f-0589080a2dbf',
          new_coureur_id: 'torstein_traeen',
          course_id: 'P5R1'
        }
      });

      if (error) throw error;

      toast.success('Correction appliquée: Traeen est maintenant Porteur Jeune étape 7');
    } catch (error) {
      console.error('Error fixing result:', error);
      toast.error('Erreur lors de la correction');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleFix} 
      disabled={isLoading}
      variant="outline"
      size="sm"
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Corriger Porteur Jeune Vuelta Étape 7
    </Button>
  );
};
