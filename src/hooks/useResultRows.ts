import { useState, useCallback } from "react";

type ResultStatut = "finished" | "dnf" | "dns" | "dsq";

type ResultRow = {
  position: number;
  coureur_id: string | null;
  coureur_nom: string | null;
  coureur_equipe?: string | null;
  statut: ResultStatut;
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

interface ScoringRule {
  place: number;
  points: number;
}

export const useResultRows = () => {
  const [resultRows, setResultRows] = useState<ResultRow[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [gridPrepared, setGridPrepared] = useState(false);

  const handleRiderChange = useCallback((index: number, riderId: string | null, riderName: string | null) => {
    setResultRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, coureur_id: riderId, coureur_nom: riderName } : row
      )
    );
    setIsDirty(true);
  }, []);

  const handleStatutChange = useCallback((index: number, statut: ResultStatut, scoringRules?: ScoringRule[]) => {
    setResultRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const rule = scoringRules?.find((r) => r.place === row.position);
        return {
          ...row,
          statut,
          points: statut === "finished" ? rule?.points || 0 : 0,
        };
      })
    );
    setIsDirty(true);
  }, []);

  const handleTeamChange = useCallback((index: number, equipeId: string | null, scoringRules?: ScoringRule[], tttRidersCount: number = 7) => {
    setResultRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const rule = scoringRules?.find((r) => r.place === row.position);
        const pointsPerRider = Math.round((rule?.points || 0) / tttRidersCount);
        const teamRiders = equipeId ? Array.from({ length: tttRidersCount }, (_, idx) => ({
          coureur_id: null,
          coureur_nom: null,
          coureur_equipe: null,
          position_decimal: row.position + (idx + 1) / 10,
        })) : [];
        return { ...row, equipe_id: equipeId, team_riders: teamRiders, points: pointsPerRider };
      })
    );
    setIsDirty(true);
  }, []);

  const handleToggleExpand = useCallback((index: number) => {
    setResultRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, is_expanded: !row.is_expanded } : row
      )
    );
  }, []);

  const handleTeamRiderChange = useCallback((teamIndex: number, riderIndex: number, riderId: string | null, riderName: string | null) => {
    setResultRows((prev) =>
      prev.map((row, i) => {
        if (i !== teamIndex || !row.team_riders) return row;
        const newTeamRiders = [...row.team_riders];
        newTeamRiders[riderIndex] = {
          ...newTeamRiders[riderIndex],
          coureur_id: riderId,
          coureur_nom: riderName,
        };
        return { ...row, team_riders: newTeamRiders };
      })
    );
    setIsDirty(true);
  }, []);

  const resetGrid = useCallback(() => {
    setResultRows([]);
    setGridPrepared(false);
    setIsDirty(false);
  }, []);

  const validLinesCount = useCallback((isTTT: boolean) => {
    return isTTT
      ? resultRows.reduce((count, row) => count + (row.team_riders?.filter(r => r.coureur_id).length || 0), 0)
      : resultRows.filter((r) => r.coureur_id).length;
  }, [resultRows]);

  return {
    resultRows,
    setResultRows,
    isDirty,
    setIsDirty,
    gridPrepared,
    setGridPrepared,
    handleRiderChange,
    handleStatutChange,
    handleTeamChange,
    handleToggleExpand,
    handleTeamRiderChange,
    resetGrid,
    validLinesCount,
  };
};

export type { ResultRow, ResultStatut, ScoringRule };
