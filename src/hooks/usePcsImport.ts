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

export interface PcsImportResult {
  results: PcsResult[] | null;
  error?: { type: 'slug_error' | 'other'; message: string; slugUsed?: string };
}

export function usePcsImport() {
  const [isImporting, setIsImporting] = useState(false);

  const importFromPcs = async (params: {
    courseId: string;
    year: number;
    typeClassement: string;
    etapeNumero: number | null;
    pcsSlugOverride?: string;
  }): Promise<PcsImportResult> => {
    setIsImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-pcs-results", {
        body: {
          course_id: params.courseId,
          year: params.year,
          type_classement: params.typeClassement,
          etape_numero: params.etapeNumero,
          pcs_slug_override: params.pcsSlugOverride || undefined,
        },
      });

      if (error) {
        // Try to parse error body for slug_error type
        let errorType: 'slug_error' | 'other' = 'other';
        let errorMessage = error.message || "Import failed";
        let slugUsed: string | undefined;

        try {
          const errorBody = error.context?.body
            ? (typeof error.context.body === 'string' ? JSON.parse(error.context.body) : error.context.body)
            : null;
          if (errorBody) {
            errorMessage = errorBody.error || errorMessage;
            if (errorBody.error_type === 'slug_error' || errorMessage.includes('PCS returned')) {
              errorType = 'slug_error';
            }
            slugUsed = errorBody.slug_used || undefined;
          }
        } catch {
          // If message contains "PCS returned", treat as slug error
          if (errorMessage.includes('PCS returned')) {
            errorType = 'slug_error';
          }
        }

        if (errorType === 'slug_error') {
          return { results: null, error: { type: 'slug_error', message: errorMessage, slugUsed } };
        }

        toast({
          title: "Erreur d'import PCS",
          description: errorMessage,
          variant: "destructive",
        });
        return { results: null, error: { type: 'other', message: errorMessage } };
      }

      if (!data?.success) {
        const msg = data?.error || "Import failed";
        toast({
          title: "Erreur d'import PCS",
          description: msg,
          variant: "destructive",
        });
        return { results: null, error: { type: 'other', message: msg } };
      }

      const results = data.results as PcsResult[];
      const matched = data.matched as number;
      const total = data.total as number;
      const unmatched = total - matched;

      if (total === 0) {
        // 0 results could also be a slug issue
        return {
          results: null,
          error: { type: 'slug_error', message: "Aucun résultat trouvé sur PCS", slugUsed: data.slug_used },
        };
      }

      toast({
        title: `✅ ${matched}/${total} coureurs matchés`,
        description: unmatched > 0
          ? `${unmatched} coureur(s) non trouvé(s) — à sélectionner manuellement`
          : "Tous les coureurs ont été trouvés !",
      });

      return { results };
    } catch (err: any) {
      console.error("PCS import error:", err);
      const msg = err.message || "Impossible de récupérer les résultats";
      
      if (msg.includes('PCS returned')) {
        return { results: null, error: { type: 'slug_error', message: msg } };
      }

      toast({
        title: "Erreur d'import PCS",
        description: msg,
        variant: "destructive",
      });
      return { results: null, error: { type: 'other', message: msg } };
    } finally {
      setIsImporting(false);
    }
  };

  return { importFromPcs, isImporting };
}
