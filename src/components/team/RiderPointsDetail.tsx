import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileBottomSheet } from "@/components/mobile";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface RiderPointsDetailProps {
  isOpen: boolean;
  onClose: () => void;
  riderId: string;
  riderName: string;
  riderTeam: string;
  riderPrice: number;
  phaseId: string;
  saisonId?: string;
}

export const RiderPointsDetail = ({
  isOpen,
  onClose,
  riderId,
  riderName,
  riderTeam,
  riderPrice,
  phaseId,
  saisonId,
}: RiderPointsDetailProps) => {
  const { data: riderPointsTable, isLoading } = useQuery({
    queryKey: ['rider-points-table', riderId, saisonId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-rider-points-table', {
        body: { 
          rider_id: riderId,
          saison_id: saisonId
        }
      });
      
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!riderId && !!saisonId,
  });

  const rows = riderPointsTable?.rows || [];
  
  const riderStats = useMemo(() => {
    const totalPoints = rows.reduce((sum: number, row: any) => sum + (row.points || 0), 0);
    const uniqueRaces = new Set(rows.map((row: any) => row.course_id)).size;
    const wins = rows.filter((row: any) => 
      row.position === 1 && 
      !row.type_classement?.startsWith('Porteur')
    ).length;
    const ratio = riderPrice > 0 ? (totalPoints / riderPrice).toFixed(2) : '0.00';
    
    return {
      totalPoints,
      totalRaces: uniqueRaces,
      wins,
      ratio: parseFloat(ratio)
    };
  }, [rows, riderPrice]);

  const rowsByPhase = useMemo(() => {
    const grouped = rows.reduce((acc: any, row: any) => {
      const phaseKey = row.phase_nom || 'Sans phase';
      if (!acc[phaseKey]) {
        acc[phaseKey] = [];
      }
      acc[phaseKey].push(row);
      return acc;
    }, {});
    
    return Object.entries(grouped).map(([phaseName, phaseRows]: [string, any]) => ({
      phaseName,
      rows: phaseRows,
      totalPoints: phaseRows.reduce((sum: number, r: any) => sum + (r.points || 0), 0)
    }));
  }, [rows]);

  const getRatioColor = (ratio: number) => {
    if (ratio >= 1.5) return "text-green-600";
    if (ratio >= 1.0) return "text-blue-600";
    if (ratio >= 0.8) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <MobileBottomSheet
      open={isOpen}
      onOpenChange={onClose}
      title={riderName}
      description={`${riderTeam} - Prix: ${riderPrice}`}
    >
      <div className="space-y-6">
        {/* Statistics Overview */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-lg border bg-card">
              <div className="text-3xl font-bold text-primary">{riderStats.totalPoints}</div>
              <div className="text-sm text-muted-foreground">Points totaux</div>
            </div>
            <div className="text-center p-4 rounded-lg border bg-card">
              <div className="text-3xl font-bold">{riderStats.totalRaces}</div>
              <div className="text-sm text-muted-foreground">Courses avec points</div>
            </div>
            <div className="text-center p-4 rounded-lg border bg-card">
              <div className="text-3xl font-bold text-yellow-600">{riderStats.wins}</div>
              <div className="text-sm text-muted-foreground">Victoires</div>
            </div>
            <div className="text-center p-4 rounded-lg border bg-card">
              <div className="flex items-center justify-center gap-2">
                <div className={`text-3xl font-bold ${getRatioColor(riderStats.ratio)}`}>
                  {riderStats.ratio}
                </div>
                {riderStats.ratio >= 1.5 ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : riderStats.ratio < 0.8 ? (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                ) : null}
              </div>
              <div className="text-sm text-muted-foreground">Ratio pts/prix</div>
            </div>
          </div>
        )}

        {/* Points History by Phase */}
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : rowsByPhase.length > 0 ? (
          <div className="space-y-4">
            <h4 className="font-semibold">Détails par phase</h4>
            <Accordion type="single" collapsible className="w-full">
              {rowsByPhase.map((phase: any, phaseIndex: number) => (
                <AccordionItem key={phaseIndex} value={`phase-${phaseIndex}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <span className="font-medium">{phase.phaseName}</span>
                      <span className="text-primary font-semibold">
                        {phase.totalPoints} pts
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {phase.rows.map((row: any, rowIndex: number) => (
                        <div 
                          key={rowIndex}
                          className="p-3 rounded-lg border bg-card/50 text-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{row.course_nom}</p>
                              <p className="text-xs text-muted-foreground">
                                {row.type_classement}
                                {row.etape_numero && ` - Étape ${row.etape_numero}`}
                                {row.position && ` - Position ${row.position}`}
                              </p>
                              {row.commentaire && (
                                <p className="text-xs text-blue-600 italic mt-1">
                                  {row.commentaire}
                                </p>
                              )}
                            </div>
                            <div className={`font-bold whitespace-nowrap ${
                              row.commentaire ? 'text-blue-600' : 'text-primary'
                            }`}>
                              {row.points} pts
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucun point enregistré pour cette saison
          </p>
        )}
      </div>
    </MobileBottomSheet>
  );
};
