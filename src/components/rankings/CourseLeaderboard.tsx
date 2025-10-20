import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";

interface CourseLeaderboardProps {
  phaseId: string | null;
  saisonId?: string | null;
}

export const CourseLeaderboard = ({ phaseId, saisonId }: CourseLeaderboardProps) => {
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  // Fetch aggregated leaderboard
  const { data: aggregatedLeaderboard, isLoading } = useQuery({
    queryKey: ["aggregated-leaderboard", saisonId, phaseId, selectedFilters],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-aggregated-leaderboard", {
        body: {
          saison_id: saisonId,
          phase_id: phaseId,
          filters: selectedFilters.length > 0 ? selectedFilters : null
        }
      });
      if (error) throw error;
      return data as {
        leaderboard: Array<{
          rank: number;
          manager_id: string;
          manager_nom: string;
          total_points: number;
          courses_count: number;
          victories_count: number;
        }>;
      };
    },
    enabled: selectedFilters.length > 0
  });

  return (
    <div className="space-y-6">
      {/* Filtre unique par type de course */}
      <Card>
        <CardHeader>
          <CardTitle>Classement par type de course</CardTitle>
          <CardDescription>
            Sélectionnez un ou plusieurs types de courses pour voir le classement agrégé des managers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Types de courses (multi-sélection)</label>
              <div className="border rounded-md p-3 space-y-3 max-h-80 overflow-y-auto bg-background">
                {/* Catégories UCI */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Catégories UCI</p>
                  {['2.1', '1.1', '2.Pro', '1.Pro'].map(cat => (
                    <div key={cat} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`filter-${cat}`}
                        checked={selectedFilters.includes(cat)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedFilters([...selectedFilters, cat]);
                          } else {
                            setSelectedFilters(selectedFilters.filter(f => f !== cat));
                          }
                        }}
                      />
                      <label htmlFor={`filter-${cat}`} className="text-sm cursor-pointer">
                        {cat}
                      </label>
                    </div>
                  ))}
                </div>

                {/* World Tour */}
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">World Tour</p>
                  {[
                    { value: 'GT', label: 'Grands Tours (GT)' },
                    { value: 'Monument', label: 'Monuments' },
                    { value: 'WT_Tours', label: 'Tours WT' },
                    { value: 'WT_Classiques', label: 'Classiques WT' }
                  ].map(item => (
                    <div key={item.value} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`filter-${item.value}`}
                        checked={selectedFilters.includes(item.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedFilters([...selectedFilters, item.value]);
                          } else {
                            setSelectedFilters(selectedFilters.filter(f => f !== item.value));
                          }
                        }}
                      />
                      <label htmlFor={`filter-${item.value}`} className="text-sm cursor-pointer">
                        {item.label}
                      </label>
                    </div>
                  ))}
                </div>

                {/* Bouton reset */}
                {selectedFilters.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-2"
                    onClick={() => setSelectedFilters([])}
                  >
                    Réinitialiser
                  </Button>
                )}
              </div>
            </div>

            {/* Active filters badges */}
            {selectedFilters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedFilters.map(filter => (
                  <Badge key={filter} variant="secondary" className="gap-1">
                    {filter === 'GT' ? 'Grands Tours' : 
                     filter === 'Monument' ? 'Monuments' :
                     filter === 'WT_Tours' ? 'Tours WT' :
                     filter === 'WT_Classiques' ? 'Classiques WT' :
                     filter}
                    <button 
                      onClick={() => setSelectedFilters(selectedFilters.filter(f => f !== filter))}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {selectedFilters.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              Sélectionnez au moins un type de course pour afficher le classement
            </div>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="py-8">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : !aggregatedLeaderboard?.leaderboard.length ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              Aucun point pour ces types de courses
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Classement des managers</CardTitle>
            <CardDescription>
              Basé sur {aggregatedLeaderboard.leaderboard.length} managers ayant marqué des points
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rang</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Courses</TableHead>
                  <TableHead className="text-right">Victoires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregatedLeaderboard.leaderboard.map((entry) => (
                  <TableRow key={entry.manager_id}>
                    <TableCell className="font-bold">#{entry.rank}</TableCell>
                    <TableCell className="font-medium">{entry.manager_nom}</TableCell>
                    <TableCell className="text-right font-bold">{entry.total_points}</TableCell>
                    <TableCell className="text-right">{entry.courses_count}</TableCell>
                    <TableCell className="text-right">
                      {entry.victories_count > 0 && (
                        <Badge variant="outline">{entry.victories_count}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
