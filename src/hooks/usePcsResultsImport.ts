import { useState } from "react";
import { usePcsImport } from "@/hooks/usePcsImport";
import { toast } from "@/hooks/use-toast";

type JerseyType = 'general' | 'vert' | 'montagne' | 'jeune' | 'combattif';

type JerseyHolders = {
  general: string | null;
  vert: string | null;
  montagne: string | null;
  jeune: string | null;
  combattif: string | null;
};

type ResultRow = {
  position: number;
  coureur_id: string | null;
  coureur_nom: string | null;
  coureur_equipe?: string | null;
  statut: string;
  points: number;
  grid_version?: string;
  equipe_id?: string | null;
  is_expanded?: boolean;
  team_riders?: Array<{
    coureur_id: string | null;
    coureur_nom: string | null;
    coureur_equipe?: string | null;
    position_decimal: number;
  }>;
};

interface UsePcsResultsImportParams {
  courseId: string;
  dateDebut: string;
  classementType: string;
  etapeNumero: number | null;
  currentStage: number;
  isOneDay: boolean;
  activeTab: "stages" | "finals";
  setResultRows: React.Dispatch<React.SetStateAction<ResultRow[]>>;
  setIsDirty: (dirty: boolean) => void;
  setGridPrepared: (prepared: boolean) => void;
  setJerseyHolders: React.Dispatch<React.SetStateAction<JerseyHolders>>;
}

export const usePcsResultsImport = ({
  courseId,
  dateDebut,
  classementType,
  etapeNumero,
  currentStage,
  isOneDay,
  activeTab,
  setResultRows,
  setIsDirty,
  setGridPrepared,
  setJerseyHolders,
}: UsePcsResultsImportParams) => {
  const { importFromPcs, isImporting: isPcsImporting } = usePcsImport();
  const [pcsSlugDialogOpen, setPcsSlugDialogOpen] = useState(false);
  const [pcsSlugError, setPcsSlugError] = useState<{ message: string; slugUsed: string }>({ message: '', slugUsed: '' });

  const handlePcsImport = async (pcsSlugOverride?: string) => {
    const year = new Date(dateDebut).getFullYear();
    const { results, error } = await importFromPcs({
      courseId,
      year,
      typeClassement: classementType,
      etapeNumero,
      pcsSlugOverride,
    });

    if (error?.type === 'slug_error') {
      const slugUsed = error.slugUsed || courseId.replace(/^(.+)-[a-z0-9]{8}$/, '$1').replace(/_/g, '-');
      setPcsSlugError({ message: error.message, slugUsed });
      setPcsSlugDialogOpen(true);
      return;
    }

    if (!results || results.length === 0) return;

    // Map scraped results into the existing grid
    setResultRows((prev) => {
      const newRows = [...prev];
      for (const result of results) {
        const idx = newRows.findIndex((r) => r.position === result.position);
        if (idx >= 0 && result.matched_coureur_id) {
          newRows[idx] = {
            ...newRows[idx],
            coureur_id: result.matched_coureur_id,
            coureur_nom: result.matched_coureur_nom,
          };
        }
      }
      return newRows;
    });
    setIsDirty(true);
    setGridPrepared(true);
    setPcsSlugDialogOpen(false);

    // Auto-fill jersey holders for stage races in "Etape" mode
    if (!isOneDay && activeTab === "stages" && classementType === "Etape") {
      const jerseyClassifications = [
        { type: "General", jersey: "general" as JerseyType },
        { type: "Points", jersey: "vert" as JerseyType },
        { type: "Montagne", jersey: "montagne" as JerseyType },
        { type: "Jeune", jersey: "jeune" as JerseyType },
      ];

      const jerseyResults = await Promise.allSettled(
        jerseyClassifications.map(({ type }) =>
          importFromPcs({
            courseId,
            year,
            typeClassement: type,
            etapeNumero: currentStage,
            pcsSlugOverride,
          })
        )
      );

      let filled = 0;
      jerseyResults.forEach((result, idx) => {
        if (result.status === "fulfilled" && result.value.results && result.value.results.length > 0) {
          const leader = result.value.results[0];
          if (leader.matched_coureur_id) {
            setJerseyHolders((prev) => ({
              ...prev,
              [jerseyClassifications[idx].jersey]: leader.matched_coureur_id,
            }));
            filled++;
          }
        }
      });

      if (filled > 0) {
        toast({
          title: `🏅 ${filled}/4 maillots remplis automatiquement`,
          description: filled < 4
            ? `${4 - filled} maillot(s) non trouvé(s) sur PCS`
            : "Tous les maillots ont été remplis !",
        });
      }
    }
  };

  return {
    handlePcsImport,
    isPcsImporting,
    pcsSlugDialogOpen,
    setPcsSlugDialogOpen,
    pcsSlugError,
  };
};
