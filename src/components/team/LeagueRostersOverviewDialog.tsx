import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Sparkles, RefreshCw } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { toPng } from "html-to-image";

interface Manager {
  id: string;
  nom: string;
}

interface RiderEntry {
  manager_id: string;
  coureur_id: string;
  nom: string;
  equipe: string;
  prix_signature: number;
}

interface LeagueRostersOverviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leagueId: string;
  phaseId: string;
  managers: Manager[];
}

export const LeagueRostersOverviewDialog = ({
  open,
  onOpenChange,
  leagueId,
  phaseId,
  managers,
}: LeagueRostersOverviewDialogProps) => {
  const { t } = useTranslation("team");
  const { toast } = useToast();
  const tableRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [rosters, setRosters] = useState<RiderEntry[]>([]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzingAI, setAnalyzingAI] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Fetch all rosters when dialog opens
  useEffect(() => {
    if (open && leagueId && phaseId) {
      fetchRosters();
    }
  }, [open, leagueId, phaseId]);

  const fetchRosters = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rosters")
        .select(`
          manager_id,
          coureur_id,
          prix_signature,
          coureurs!inner(nom, equipe)
        `)
        .eq("league_id", leagueId)
        .eq("phase_id", phaseId);

      if (error) throw error;

      const entries: RiderEntry[] = (data || []).map((r: any) => ({
        manager_id: r.manager_id,
        coureur_id: r.coureur_id,
        nom: r.coureurs?.nom || "Inconnu",
        equipe: r.coureurs?.equipe || "",
        prix_signature: r.prix_signature,
      }));

      setRosters(entries);
    } catch (err) {
      console.error("Error fetching rosters:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les effectifs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Group rosters by manager
  const rostersByManager = managers.reduce((acc, manager) => {
    acc[manager.id] = rosters
      .filter((r) => r.manager_id === manager.id)
      .sort((a, b) => b.prix_signature - a.prix_signature);
    return acc;
  }, {} as Record<string, RiderEntry[]>);

  // Find max riders count for table rows
  const maxRiders = Math.max(
    ...Object.values(rostersByManager).map((r) => r.length),
    0
  );

  const handleAnalyzeAI = async () => {
    setAnalyzingAI(true);
    setAnalysis(null);
    
    try {
      const rostersPayload = managers.map((manager) => ({
        manager_name: manager.nom,
        riders: (rostersByManager[manager.id] || []).map((r) => ({
          nom: r.nom,
          equipe: r.equipe,
          prix_achat: r.prix_signature,
        })),
      }));

      const { data, error } = await supabase.functions.invoke("analyze-rosters", {
        body: { rosters: rostersPayload },
      });

      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }

      setAnalysis(data.analysis);
    } catch (err: any) {
      console.error("AI analysis error:", err);
      toast({
        title: "Erreur d'analyse",
        description: err.message || "Impossible d'analyser les effectifs",
        variant: "destructive",
      });
    } finally {
      setAnalyzingAI(false);
    }
  };

  const handleExportImage = async () => {
    if (!tableRef.current) return;
    
    setExporting(true);
    try {
      const dataUrl = await toPng(tableRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });

      // Create download link
      const link = document.createElement("a");
      link.download = `effectifs_ligue_${new Date().toISOString().split("T")[0]}.png`;
      link.href = dataUrl;
      link.click();

      toast({
        title: "Export réussi",
        description: "L'image a été téléchargée",
      });
    } catch (err) {
      console.error("Export error:", err);
      toast({
        title: "Erreur d'export",
        description: "Impossible d'exporter l'image",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Vue d'ensemble des effectifs
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportImage}
            disabled={loading || exporting}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Exporter image
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleAnalyzeAI}
            disabled={loading || analyzingAI || rosters.length === 0}
          >
            {analyzingAI ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Analyser avec l'IA
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-auto max-h-[50vh] border rounded-md">
            {/* Table container for export */}
            <div ref={tableRef} className="bg-white p-4 min-w-max">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {managers.map((manager) => (
                      <th
                        key={manager.id}
                        className="border border-border bg-muted px-3 py-2 text-left font-semibold min-w-[150px]"
                      >
                        {manager.nom}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxRiders }).map((_, rowIndex) => (
                    <tr key={rowIndex}>
                      {managers.map((manager) => {
                        const rider = rostersByManager[manager.id]?.[rowIndex];
                        return (
                          <td
                            key={manager.id}
                            className="border border-border px-3 py-1.5 align-top"
                          >
                            {rider ? (
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">
                                  {rider.nom}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {rider.equipe} • {rider.prix_signature}M
                                </span>
                              </div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="bg-muted/50 font-semibold">
                    {managers.map((manager) => {
                      const total = (rostersByManager[manager.id] || []).reduce(
                        (sum, r) => sum + r.prix_signature,
                        0
                      );
                      const count = rostersByManager[manager.id]?.length || 0;
                      return (
                        <td
                          key={manager.id}
                          className="border border-border px-3 py-2"
                        >
                          {count} coureurs • {total}M
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AI Analysis section */}
        {analysis && (
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Analyse IA des effectifs
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAnalyzeAI}
                disabled={analyzingAI}
              >
                <RefreshCw className={`h-4 w-4 ${analyzingAI ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <ScrollArea className="max-h-[300px]">
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
                {analysis}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
