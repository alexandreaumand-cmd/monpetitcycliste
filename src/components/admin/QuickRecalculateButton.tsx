import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const QuickRecalculateButton = () => {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleRecalculate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-recompute-course', {
        body: { course_id: 'P5R16' }
      });

      if (error) throw error;

      toast.success("Points recalculés avec succès !", {
        description: `${data.rows_upserted} entrées mises à jour pour Okolo Slovenska`
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
      Recalculer P5R16
    </Button>
  );
};
