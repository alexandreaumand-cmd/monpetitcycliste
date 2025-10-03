import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown, Trophy, ArrowUpDown, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface Coureur {
  coureur_id: string;
  nom: string;
  equipe: string;
  prix_achat: number;
  cote_initiale: number;
  points_total: number;
  ratio_points_par_prix: number;
}

interface PointDetail {
  course_nom: string;
  type_classement: string;
  etape_numero: number | null;
  points: number;
  date_classement: string;
  total_points: number;
}

type SortBy = 'points' | 'ratio' | 'prix';

export const MyTeam = () => {
  const [coureurs, setCoureurs] = useState<Coureur[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>('points');
  
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCoureur, setSelectedCoureur] = useState<Coureur | null>(null);
  const [pointsDetail, setPointsDetail] = useState<PointDetail[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadTeam();
  }, []);

  const loadTeam = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manager-my-team', {
        body: { phase_id: null }
      });

      if (error) throw error;
      setCoureurs(data.coureurs || []);
    } catch (error) {
      console.error('Error loading team:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCoureurDetail = async (coureur: Coureur) => {
    setSelectedCoureur(coureur);
    setDrawerOpen(true);
    setLoadingDetail(true);

    try {
      const { data, error } = await supabase.functions.invoke('manager-coureur-points-detail', {
        body: { coureur_id: coureur.coureur_id, phase_id: null }
      });

      if (error) throw error;
      setPointsDetail(data.history || []);
    } catch (error) {
      console.error('Error loading coureur detail:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const sortedCoureurs = [...coureurs].sort((a, b) => {
    switch (sortBy) {
      case 'points':
        return b.points_total - a.points_total;
      case 'ratio':
        return b.ratio_points_par_prix - a.ratio_points_par_prix;
      case 'prix':
        return b.prix_achat - a.prix_achat;
      default:
        return 0;
    }
  });

  const getRatioColor = (ratio: number) => {
    if (ratio > 1) return "text-green-600 dark:text-green-400";
    if (ratio < 1) return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  const getRatioBgColor = (ratio: number) => {
    if (ratio > 1) return "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900";
    if (ratio < 1) return "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900";
    return "";
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Mon équipe</h1>
          <p className="text-muted-foreground">
            {coureurs.length} coureur{coureurs.length > 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Trier par:</span>
          <Button
            variant={sortBy === 'points' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('points')}
          >
            <Trophy className="h-4 w-4 mr-2" />
            Points
          </Button>
          <Button
            variant={sortBy === 'ratio' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('ratio')}
          >
            <ArrowUpDown className="h-4 w-4 mr-2" />
            Ratio
          </Button>
          <Button
            variant={sortBy === 'prix' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('prix')}
          >
            Prix
          </Button>
        </div>
      </div>

      {coureurs.length === 0 ? (
        <Card className="p-12 text-center">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Équipe vide</h3>
          <p className="text-muted-foreground">
            Votre équipe est vide pour cette phase
          </p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coureur</TableHead>
                  <TableHead>Équipe</TableHead>
                  <TableHead className="text-right">Prix d'achat</TableHead>
                  <TableHead className="text-right">Cote initiale</TableHead>
                  <TableHead className="text-right">Points totaux</TableHead>
                  <TableHead className="text-right">Ratio pts/€</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCoureurs.map((coureur) => (
                  <TableRow 
                    key={coureur.coureur_id}
                    className={`cursor-pointer hover:bg-muted/50 ${getRatioBgColor(coureur.ratio_points_par_prix)}`}
                    onClick={() => openCoureurDetail(coureur)}
                  >
                    <TableCell className="font-medium">{coureur.nom}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{coureur.equipe}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {coureur.prix_achat.toFixed(0)}€
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {coureur.cote_initiale.toFixed(0)}€
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Trophy className="h-4 w-4 text-primary" />
                        <span className="font-bold text-lg">{coureur.points_total}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className={`flex items-center justify-end gap-1 font-semibold ${getRatioColor(coureur.ratio_points_par_prix)}`}>
                        {coureur.ratio_points_par_prix > 1 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : coureur.ratio_points_par_prix < 1 ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : null}
                        <span>{coureur.ratio_points_par_prix.toFixed(2)} pts/€</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
            {sortedCoureurs.map((coureur) => (
              <Card 
                key={coureur.coureur_id}
                className={`cursor-pointer hover:shadow-lg transition-shadow ${getRatioBgColor(coureur.ratio_points_par_prix)}`}
                onClick={() => openCoureurDetail(coureur)}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{coureur.nom}</CardTitle>
                  <Badge variant="secondary" className="w-fit">{coureur.equipe}</Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prix d'achat:</span>
                    <span className="font-semibold">{coureur.prix_achat.toFixed(0)}€</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cote:</span>
                    <span>{coureur.cote_initiale.toFixed(0)}€</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <div className="flex items-center gap-1">
                      <Trophy className="h-4 w-4 text-primary" />
                      <span className="font-bold text-lg">{coureur.points_total}</span>
                    </div>
                    <div className={`flex items-center gap-1 font-semibold text-sm ${getRatioColor(coureur.ratio_points_par_prix)}`}>
                      {coureur.ratio_points_par_prix > 1 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : coureur.ratio_points_par_prix < 1 ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : null}
                      <span>{coureur.ratio_points_par_prix.toFixed(2)} pts/€</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Drawer détail */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="border-b">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DrawerTitle className="text-2xl">{selectedCoureur?.nom}</DrawerTitle>
                <DrawerDescription>
                  {selectedCoureur && (
                    <div className="flex items-center gap-3 mt-2">
                      <Badge variant="secondary">{selectedCoureur.equipe}</Badge>
                      <span className="text-sm">Prix: {selectedCoureur.prix_achat.toFixed(0)}€</span>
                      <span className="text-sm">Cote: {selectedCoureur.cote_initiale.toFixed(0)}€</span>
                    </div>
                  )}
                </DrawerDescription>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>

            {selectedCoureur && (
              <div className="flex items-center gap-6 mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-2xl font-bold">{selectedCoureur.points_total}</div>
                    <div className="text-xs text-muted-foreground">Points totaux</div>
                  </div>
                </div>
                <div className={`flex items-center gap-2 ${getRatioColor(selectedCoureur.ratio_points_par_prix)}`}>
                  {selectedCoureur.ratio_points_par_prix > 1 ? (
                    <TrendingUp className="h-5 w-5" />
                  ) : selectedCoureur.ratio_points_par_prix < 1 ? (
                    <TrendingDown className="h-5 w-5" />
                  ) : null}
                  <div>
                    <div className="text-2xl font-bold">{selectedCoureur.ratio_points_par_prix.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">pts/€</div>
                  </div>
                </div>
              </div>
            )}
          </DrawerHeader>

          <div className="overflow-y-auto p-6">
            <h3 className="font-semibold mb-4">Historique des points</h3>
            
            {loadingDetail ? (
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
    </div>
  );
};
