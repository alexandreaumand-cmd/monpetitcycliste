import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

const COURSES_21_PHASE5 = [
  { id: 'P5R2', name: 'Tour Poitou-Charentes' },
  { id: 'P5R6', name: 'Tour of Istanbul' },
  { id: 'P5R16', name: 'Okolo Slovenska' },
  { id: 'P5R29', name: 'CRO Race' }
];

export const RecalculateCat21Phase5Button = () => {
  const [loading, setLoading] = useState(false);

  const handleRecalculate = async () => {
    setLoading(true);
    try {
      const courseIds = COURSES_21_PHASE5.map(c => c.id);
      
      const { data, error } = await supabase.functions.invoke('admin-recompute-course', {
        body: { course_ids: courseIds }
      });

      if (error) throw error;

      const successCount = data.results?.filter((r: any) => r.success).length || 0;
      
      toast.success("Points recalculés avec succès !", {
        description: `${successCount}/${COURSES_21_PHASE5.length} courses Phase 5 traitées - ${data.total_rows_upserted} entrées mises à jour`
      });
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
      Recalculer 4 courses 2.1 Phase 5
    </Button>
  );
};
