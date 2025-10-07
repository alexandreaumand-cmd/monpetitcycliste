import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, TrendingUp, TrendingDown, X } from "lucide-react";

interface PointDetail {
  course_nom: string;
  type_classement: string;
  etape_numero: number | null;
  points: number;
  date_classement: string;
}

interface RiderPointsDetailProps {
  isOpen: boolean;
  onClose: () => void;
  riderId: string;
  riderName: string;
  riderTeam: string;
  riderPrice: number;
  phaseId: string;
  managerId?: string;
}

export const RiderPointsDetail = ({
  isOpen,
  onClose,
  riderId,
  riderName,
  riderTeam,
  riderPrice,
  phaseId,
  managerId
}: RiderPointsDetailProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ['rider-points-detail', riderId, phaseId, managerId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('rider-points-detail', {
        body: { 
          coureur_id: riderId, 
          phase_id: phaseId,
          manager_id: managerId 
        }
      });

      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!riderId && !!phaseId
  });

  const pointsDetail: PointDetail[] = data?.history || [];
  const totalPoints = data?.total_points || 0;
  const ratio = riderPrice > 0 ? totalPoints / riderPrice : 0;

  const getRatioColor = (ratio: number) => {
    if (ratio >= 2) return "text-green-600";
    if (ratio >= 1) return "text-blue-600";
    if (ratio >= 0.5) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DrawerTitle className="text-2xl">{riderName}</DrawerTitle>
              <DrawerDescription>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-sm text-muted-foreground">{riderTeam}</span>
                  <span className="text-sm">Prix: {riderPrice.toFixed(0)}</span>
                </div>
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>

          <div className="flex items-center gap-6 mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <div>
                <div className="text-2xl font-bold">{totalPoints}</div>
                <div className="text-xs text-muted-foreground">Points totaux</div>
              </div>
            </div>
            <div className={`flex items-center gap-2 ${getRatioColor(ratio)}`}>
              {ratio > 1 ? (
                <TrendingUp className="h-5 w-5" />
              ) : ratio < 1 ? (
                <TrendingDown className="h-5 w-5" />
              ) : null}
              <div>
                <div className="text-2xl font-bold">{ratio.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">Ratio</div>
              </div>
            </div>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto p-6">
          <h3 className="font-semibold mb-4">Historique des points</h3>
          
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : pointsDetail.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Aucun point marqué</p>
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Étape</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pointsDetail.map((detail, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{detail.course_nom}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{detail.type_classement}</Badge>
                      </TableCell>
                      <TableCell>{detail.etape_numero || '—'}</TableCell>
                      <TableCell className="text-right font-semibold">
                        <div className="flex items-center justify-end gap-1">
                          <Trophy className="h-3 w-3 text-primary" />
                          {detail.points}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(detail.date_classement).toLocaleDateString('fr-FR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
