import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Star, Users, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

type TopRidersProps = {
  phaseId?: string | null;
  limit?: number;
};

type RiderOwner = {
  manager_id: string;
  manager_nom: string;
};

type TopRider = {
  rider_id: string;
  rider_nom: string;
  rider_equipe: string;
  total_points: number;
  courses_count: number;
  owners?: RiderOwner[];
};

type RiderPointDetail = {
  course_nom: string;
  type_classement: string;
  etape_numero: number | null;
  points: number;
  date_classement: string;
  total_points: number;
};

export const TopRiders = ({ phaseId, limit = 20 }: TopRidersProps) => {
  const [selectedRider, setSelectedRider] = useState<TopRider | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: riders, isLoading } = useQuery({
    queryKey: ["top-riders", phaseId, limit],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-top-riders', {
        body: {
          phase_id: phaseId,
          limit,
        },
      });

      if (error) throw error;
      return data?.items as TopRider[] || [];
    },
  });

  const { data: riderDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ["rider-details", selectedRider?.rider_id, phaseId],
    queryFn: async () => {
      if (!selectedRider) return null;

      const { data, error } = await supabase.functions.invoke('manager-coureur-points-detail', {
        body: {
          coureur_id: selectedRider.rider_id,
          phase_id: phaseId,
        },
      });

      if (error) throw error;
      return data as RiderPointDetail[] || [];
    },
    enabled: !!selectedRider,
  });

  const handleRiderClick = (rider: TopRider) => {
    setSelectedRider(rider);
    setDetailsOpen(true);
  };

  const maxPoints = riders?.[0]?.total_points || 1;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalPoints = riderDetails?.[0]?.total_points || 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Top Coureurs
          </CardTitle>
          <CardDescription>
            {phaseId ? "Meilleurs coureurs de la phase" : "Meilleurs coureurs toutes phases"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {riders?.map((rider, idx) => {
              const progressPercent = (rider.total_points / maxPoints) * 100;
              
              return (
                <Card 
                  key={rider.rider_id} 
                  className="overflow-hidden cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleRiderClick(rider)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{rider.rider_nom}</p>
                        {rider.rider_equipe && (
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {rider.rider_equipe}
                          </p>
                        )}
                      </div>
                      <Badge 
                        variant={idx < 3 ? "default" : "secondary"}
                        className="ml-2 shrink-0"
                      >
                        #{idx + 1}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Points</span>
                        <span className="font-bold">{rider.total_points}</span>
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                      <p className="text-xs text-muted-foreground text-right">
                        {rider.courses_count} {rider.courses_count > 1 ? 'courses' : 'course'}
                      </p>
                    </div>

                    {/* Managers section */}
                    {phaseId ? (
                      rider.owners && rider.owners.length > 0 ? (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-1">Managers</p>
                          <div className="flex flex-wrap gap-1">
                            {rider.owners.slice(0, 2).map((owner) => (
                              <Badge key={owner.manager_id} variant="outline" className="text-xs">
                                {owner.manager_nom}
                              </Badge>
                            ))}
                            {rider.owners.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{rider.owners.length - 2}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground">Managers : —</p>
                        </div>
                      )
                    ) : (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground italic">
                          Sélectionnez une phase pour voir les managers
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {!riders || riders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Aucun point pour la période sélectionnée
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rider Details Drawer */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {selectedRider?.rider_nom}
            </SheetTitle>
            {selectedRider?.rider_equipe && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="h-4 w-4" />
                {selectedRider.rider_equipe}
              </p>
            )}
            {phaseId && selectedRider?.owners && selectedRider.owners.length > 0 && (
              <div className="pt-2">
                <p className="text-sm font-medium">
                  Propriétaire(s) (Phase) : {selectedRider.owners.map(o => o.manager_nom).join(', ')}
                </p>
              </div>
            )}
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Points</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{totalPoints}</p>
              </CardContent>
            </Card>

            {isLoadingDetails ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : riderDetails && riderDetails.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Détail des points</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Étape</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {riderDetails.map((detail, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{detail.course_nom}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{detail.type_classement}</Badge>
                          </TableCell>
                          <TableCell>{detail.etape_numero || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {detail.date_classement ? format(new Date(detail.date_classement), 'dd/MM/yyyy') : '—'}
                          </TableCell>
                          <TableCell className="text-right font-semibold">{detail.points}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Aucun détail disponible
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
