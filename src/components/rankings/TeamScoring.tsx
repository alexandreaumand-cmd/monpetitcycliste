import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Target, Eye } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface TeamScoringProps {
  phaseId: string | null;
  saisonId?: string | null;
}

export const TeamScoring = ({ phaseId, saisonId }: TeamScoringProps) => {
  const [selectedManager, setSelectedManager] = useState<string>("");
  const [search, setSearch] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedRider, setSelectedRider] = useState<{id: string, nom: string} | null>(null);

  const { data: managers } = useQuery({
    queryKey: ["managers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("managers")
        .select("id, nom")
        .order("nom");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: teamData, isLoading } = useQuery({
    queryKey: ["team-scoring", selectedManager, phaseId, saisonId, search],
    queryFn: async () => {
      if (!selectedManager) return null;
      
      const { data, error } = await supabase.functions.invoke("get-team-scoring", {
        body: { 
          manager_id: selectedManager,
          phase_id: phaseId,
          saison_id: saisonId,
          search: search || null
        }
      });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedManager,
  });

  const { data: riderDetails } = useQuery({
    queryKey: ["rider-points-detail", selectedRider?.id, phaseId, saisonId],
    queryFn: async () => {
      if (!selectedRider) return null;
      
      const { data, error } = await supabase.functions.invoke("get-rider-points-table", {
        body: {
          rider_id: selectedRider.id,
          phase_id: phaseId,
          saison_id: saisonId
        }
      });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedRider && detailsOpen,
  });

  const handleShowDetails = (riderId: string, riderNom: string) => {
    setSelectedRider({ id: riderId, nom: riderNom });
    setDetailsOpen(true);
  };

  if (!selectedManager) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <Users className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <p className="text-lg font-medium">Choisissez une équipe</p>
              <p className="text-sm text-muted-foreground mt-1">
                Sélectionnez un manager pour afficher les coureurs scorés
              </p>
            </div>
            <Select value={selectedManager} onValueChange={setSelectedManager}>
              <SelectTrigger className="w-64 mx-auto">
                <SelectValue placeholder="Sélectionner un manager" />
              </SelectTrigger>
              <SelectContent>
                {managers?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
          <CardDescription>Équipe et recherche</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Manager</label>
              <Select value={selectedManager} onValueChange={setSelectedManager}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers?.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rechercher un coureur</label>
              <Input
                placeholder="Nom du coureur..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {teamData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Total de points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teamData.totals.points_total}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Moyenne / course
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {teamData.totals.courses_count > 0
                  ? Math.round(teamData.totals.points_total / teamData.totals.courses_count)
                  : 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Courses scorées
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teamData.totals.courses_count}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Riders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Coureurs scorés</CardTitle>
          <CardDescription>
            {teamData?.items.length || 0} coureur(s) avec des points
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : !teamData?.items.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun coureur n'a marqué de points sur ce scope
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coureur</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Courses</TableHead>
                  <TableHead className="text-right">Dernier point</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamData.items.map((item) => (
                  <TableRow key={item.rider_id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.rider_nom}</div>
                        {item.rider_equipe && (
                          <Badge variant="outline" className="mt-1">
                            {item.rider_equipe}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {item.points_total}
                    </TableCell>
                    <TableCell className="text-right">{item.nb_courses}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {item.last_scored_at
                        ? format(new Date(item.last_scored_at), "dd/MM", { locale: fr })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleShowDetails(item.rider_id, item.rider_nom)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Rider Details Drawer */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Détail — {selectedRider?.nom}</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {riderDetails && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">{riderDetails.rider.nom}</div>
                    {riderDetails.rider.equipe && (
                      <Badge variant="outline" className="mt-1">
                        {riderDetails.rider.equipe}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Total points</div>
                    <div className="text-2xl font-bold">{riderDetails.total}</div>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phase</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead className="text-right">Place</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {riderDetails.rows.map((row: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>{row.phase_label}</TableCell>
                        <TableCell>{row.course_nom}</TableCell>
                        <TableCell className="text-right">
                          {row.place ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {row.points}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
