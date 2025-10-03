import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, ChevronDown, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface CourseLeaderboardProps {
  phaseId: string | null;
  saisonId?: string | null;
}

export const CourseLeaderboard = ({ phaseId, saisonId }: CourseLeaderboardProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchCourse, setSearchCourse] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("tous");
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Get filter options
  const { data: filterOptions } = useQuery({
    queryKey: ["courses-filter-options", saisonId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("courses-filter-options", {
        body: { saison_id: saisonId }
      });
      if (error) throw error;
      return data as { categories: string[]; classement_types: string[] };
    },
  });

  // Get courses list
  const { data: coursesList, isLoading: coursesLoading } = useQuery({
    queryKey: ["list-courses-with-results", saisonId, phaseId, selectedCategory, searchCourse],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-courses-with-results", {
        body: {
          saison_id: saisonId,
          phase_id: phaseId,
          category: selectedCategory === "all" ? null : selectedCategory,
          search: searchCourse || null,
          limit: 100,
          offset: 0
        }
      });
      if (error) throw error;
      return data as { items: any[]; total: number };
    },
  });

  // Get stages for selected course
  const { data: stagesData } = useQuery({
    queryKey: ["course-stages", selectedCourse],
    queryFn: async () => {
      if (!selectedCourse) return null;
      const { data, error } = await supabase.functions.invoke("course-stages", {
        body: { course_id: selectedCourse }
      });
      if (error) throw error;
      return data as { stages: number[] };
    },
    enabled: !!selectedCourse && selectedType === "Etape",
  });

  // Get leaderboard
  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({
    queryKey: ["course-leaderboard", selectedCourse, selectedType, selectedStage],
    queryFn: async () => {
      if (!selectedCourse) return null;
      const { data, error } = await supabase.functions.invoke("course-leaderboard", {
        body: {
          course_id: selectedCourse,
          type_classement: selectedType === "tous" ? null : selectedType,
          etape_numero: selectedType === "Etape" && selectedStage ? parseInt(selectedStage) : null
        }
      });
      if (error) throw error;
      return data as {
        course: { id: string; nom: string; date_debut: string; category: string };
        leaderboard: Array<{ rank: number; manager_id: string; manager_nom: string; points: number }>;
        contributors: Array<{ manager_id: string; rider_id: string; rider_nom: string; rider_equipe: string | null; points: number }>;
      };
    },
    enabled: !!selectedCourse,
  });

  const handleExportCSV = async () => {
    if (!selectedCourse) return;
    
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-course-leaderboard-csv`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          course_id: selectedCourse,
          type_classement: selectedType === "tous" ? null : selectedType,
          etape_numero: selectedType === "Etape" && selectedStage ? parseInt(selectedStage) : null
        })
      }
    );
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `classement_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  };

  const toggleRow = (managerId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(managerId)) {
      newExpanded.delete(managerId);
    } else {
      newExpanded.add(managerId);
    }
    setExpandedRows(newExpanded);
  };

  const getContributorsForManager = (managerId: string) => {
    if (!leaderboard) return [];
    return leaderboard.contributors
      .filter(c => c.manager_id === managerId)
      .sort((a, b) => b.points - a.points);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
          <CardDescription>Sélectionnez les critères de recherche</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Catégorie</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {filterOptions?.categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Recherche course</label>
              <Input
                placeholder="Nom de la course..."
                value={searchCourse}
                onChange={(e) => setSearchCourse(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Course</label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une course" />
                </SelectTrigger>
                <SelectContent>
                  {coursesLoading ? (
                    <div className="p-2 text-sm text-muted-foreground">Chargement...</div>
                  ) : (
                    coursesList?.items.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.nom} — {course.date_debut ? format(new Date(course.date_debut), "dd/MM", { locale: fr }) : ''}
                        {course.phase_label && ` (${course.phase_label})`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedCourse && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type de classement</label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">Tous (global course)</SelectItem>
                    {filterOptions?.classement_types.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedType === "Etape" && stagesData && stagesData.stages.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium"># Étape</label>
                  <Select value={selectedStage} onValueChange={setSelectedStage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une étape" />
                    </SelectTrigger>
                    <SelectContent>
                      {stagesData.stages.map((stage) => (
                        <SelectItem key={stage} value={stage.toString()}>
                          Étape {stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {selectedCourse && leaderboard && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{leaderboard.course.nom}</CardTitle>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">{leaderboard.course.category}</Badge>
                  {selectedType !== "tous" && <Badge variant="outline">{selectedType}</Badge>}
                  {selectedType === "Etape" && selectedStage && (
                    <Badge variant="outline">Étape {selectedStage}</Badge>
                  )}
                </div>
              </div>
              <Button onClick={handleExportCSV} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {leaderboardLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !leaderboard.leaderboard.length ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun point pour ces filtres
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="w-16">Rang</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.leaderboard.map((entry) => {
                    const contributors = getContributorsForManager(entry.manager_id);
                    const isExpanded = expandedRows.has(entry.manager_id);
                    
                    return (
                      <Collapsible key={entry.manager_id} asChild open={isExpanded}>
                        <>
                          <TableRow className="cursor-pointer hover:bg-muted/50">
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleRow(entry.manager_id)}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell className="font-bold">#{entry.rank}</TableCell>
                            <TableCell className="font-medium">{entry.manager_nom}</TableCell>
                            <TableCell className="text-right font-bold">{entry.points}</TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell colSpan={4} className="bg-muted/30 p-4">
                                <div className="space-y-2">
                                  <div className="text-sm font-medium text-muted-foreground mb-2">
                                    Coureurs contributeurs
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {contributors.map((contributor) => (
                                      <div
                                        key={contributor.rider_id}
                                        className="flex items-center justify-between p-2 rounded border bg-background"
                                      >
                                        <div>
                                          <div className="font-medium">{contributor.rider_nom}</div>
                                          {contributor.rider_equipe && (
                                            <Badge variant="outline" className="mt-1 text-xs">
                                              {contributor.rider_equipe}
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="font-bold">{contributor.points} pts</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
