import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const COURSES_21 = [
  { id: 'P1R4', name: 'AlUla Tour' },
  { id: 'P1R13', name: 'Etoile de Bessèges' },
  { id: 'P1R17', name: 'Tour de la Provence' },
  { id: 'P1R26', name: 'Tour des Alpes-Maritimes' },
  { id: 'P1R28', name: 'O Gran Camiño' }
];

export const RecalculateCat21Button = () => {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleRecalculate = async () => {
    setLoading(true);
    try {
      const courseIds = COURSES_21.map(c => c.id);
      
      const { data, error } = await supabase.functions.invoke('admin-recompute-course', {
        body: { course_ids: courseIds }
      });

      if (error) throw error;

      const successCount = data.results?.filter((r: any) => r.success).length || 0;
      
      toast.success("Points recalculés avec succès !", {
        description: `${successCount}/${COURSES_21.length} courses traitées - ${data.total_rows_upserted} entrées mises à jour`
      });
      
      // Invalidate top riders cache
      queryClient.invalidateQueries({ queryKey: ["top-riders"] });
      queryClient.invalidateQueries({ queryKey: ["top-riders-mobile"] });
    } catch (error: any) {
      console.error('Erreur:', error);
      toast.error("Erreur lors du recalcul", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleRecalculate} 
      disabled={loading}
      variant="outline"
      size="sm"
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
      Recalculer 5 courses 2.1
    </Button>
  );
};
