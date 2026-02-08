import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface PcsResult {
  position: number;
  rider_name: string;
  rider_pcs_slug: string;
  team: string;
  matched_coureur_id: string | null;
  matched_coureur_nom: string | null;
}

interface PcsImportResponse {
  success: boolean;
  results: PcsResult[];
  matched: number;
  total: number;
  pcs_url: string;
  error?: string;
}

export function usePcsImport() {
  const [isImporting, setIsImporting] = useState(false);

  const importFromPcs = async (params: {
    courseId: string;
    year: number;
    typeClassement: string;
    etapeNumero: number | null;
  }): Promise<PcsResult[] | null> => {
    setIsImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-pcs-results", {
        body: {
          course_id: params.courseId,
          year: params.year,
          type_classement: params.typeClassement,
          etape_numero: params.etapeNumero,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Import failed");
      }

      const results = data.results as PcsResult[];
      const matched = data.matched as number;
      const total = data.total as number;
      const unmatched = total - matched;

      if (total === 0) {
        toast({
          title: "Aucun résultat",
          description: "Pas de résultats trouvés sur PCS pour cette course/étape",
          variant: "destructive",
        });
        return null;
      }

      toast({
        title: `✅ ${matched}/${total} coureurs matchés`,
        description: unmatched > 0
          ? `${unmatched} coureur(s) non trouvé(s) — à sélectionner manuellement`
          : "Tous les coureurs ont été trouvés !",
      });

      return results;
    } catch (err: any) {
      console.error("PCS import error:", err);
      toast({
        title: "Erreur d'import PCS",
        description: err.message || "Impossible de récupérer les résultats",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsImporting(false);
    }
  };

  return { importFromPcs, isImporting };
}
