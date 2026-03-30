import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { PointsLedgerRow } from "@/hooks/usePointsLedgerFilters";

interface PointsLedgerExportProps {
  data: PointsLedgerRow[] | undefined;
}

const exportToCSV = (rawData: PointsLedgerRow[]) => {
  const headers = ["Course", "Coureur", "Phase", "Saison", "Type", "Étape", "Points", "Date"];
  const rows = rawData.map(row => [
    row.course_nom || "", row.coureur_nom || "", row.phase_index || "", row.saison_annee || "",
    row.type_classement || "", row.etape_numero || "", row.points || "", new Date(row.created_at).toLocaleDateString(),
  ]);
  const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `points_ledger_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const PointsLedgerExport = ({ data }: PointsLedgerExportProps) => {
  if (!data || data.length === 0) return null;

  return (
    <Button onClick={() => exportToCSV(data)} variant="outline">
      <Download className="h-4 w-4 mr-2" />
      Exporter CSV
    </Button>
  );
};
