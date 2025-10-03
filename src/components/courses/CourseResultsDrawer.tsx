import { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Search, Calculator } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";

interface CourseMeta {
  course_nom: string;
  categorie: string;
  date_debut: string;
  date_fin: string;
  types_disponibles: string[];
  etapes_disponibles: number[];
}

interface ResultRow {
  race_result_id: string;
  row_position: number | null;
  statut: string;
  coureur_id: string;
  coureur_nom: string;
  equipe: string;
  manager_id: string | null;
  manager_nom: string | null;
  points_officiels: number | null;
  points_theoriques: number;
  is_my_rider: boolean;
}

interface CourseResultsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string | null;
}

export const CourseResultsDrawer = ({ open, onOpenChange, courseId }: CourseResultsDrawerProps) => {
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const [meta, setMeta] = useState<CourseMeta | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedEtape, setSelectedEtape] = useState<number | null>(null);
  const [topN, setTopN] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    if (open && courseId) {
      loadMeta();
    }
  }, [open, courseId]);

  useEffect(() => {
    if (meta && selectedType) {
      loadResults();
    }
  }, [selectedType, selectedEtape, meta]);

  const loadMeta = async () => {
    if (!courseId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('results-course-meta-v2', {
        body: { course_id: courseId }
      });

      if (error) throw error;

      if (data?.meta) {
        setMeta(data.meta);
        
        // Set default type (prefer General, otherwise first available)
        const types = data.meta.types_disponibles || [];
        const defaultType = types.includes('General') ? 'General' : types[0];
        setSelectedType(defaultType);

        // Set default etape if Etape type
        if (defaultType === 'Etape' && data.meta.etapes_disponibles?.length > 0) {
          setSelectedEtape(data.meta.etapes_disponibles[data.meta.etapes_disponibles.length - 1]);
        }
      }
    } catch (error) {
      console.error('Error loading course meta:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadResults = async () => {
    if (!courseId || !selectedType) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('results-course-table', {
        body: {
          course_id: courseId,
          type_classement: selectedType,
          etape_numero: selectedType === 'Etape' ? selectedEtape : null
        }
      });

      if (error) throw error;

      setResults(data?.rows || []);
    } catch (error) {
      console.error('Error loading results:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    if (type === 'Etape' && meta?.etapes_disponibles?.length) {
      setSelectedEtape(meta.etapes_disponibles[meta.etapes_disponibles.length - 1]);
    } else {
      setSelectedEtape(null);
    }
  };

  const handleComputePoints = async () => {
    if (!courseId) return;
    
    setComputing(true);
    try {
      const { data, error } = await supabase.functions.invoke('compute-points', {
        body: { course_id: courseId }
      });

      if (error) throw error;

      const missingCount = data.missing_bareme?.length || 0;
      const message = missingCount > 0
        ? `${data.rows_upserted} points calculés. ⚠️ ${missingCount} barèmes manquants.`
        : `${data.rows_upserted} points calculés avec succès.`;

      toast({
        title: "✓ Calcul terminé",
        description: message,
      });

      if (missingCount > 0) {
        console.warn('Missing bareme:', data.missing_bareme);
      }

      // Reload results
      await loadResults();
    } catch (error: any) {
      console.error('Error computing points:', error);
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors du calcul des points",
        variant: "destructive",
      });
    } finally {
      setComputing(false);
    }
  };

  // Client-side filtering
  const filteredResults = results.filter(r => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return r.coureur_nom.toLowerCase().includes(search) || 
           r.equipe?.toLowerCase().includes(search);
  });

  // Split finished and non-finished
  const finishedResults = filteredResults
    .filter(r => r.statut === 'finished' && r.row_position !== null)
    .slice(0, topN);
  
  const nonFinishedResults = filteredResults
    .filter(r => r.statut !== 'finished' || r.row_position === null);

  const displayedResults = [...finishedResults, ...nonFinishedResults];

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, { label: string; variant: "destructive" | "secondary" | "outline" }> = {
      dnf: { label: "DNF", variant: "destructive" },
      dns: { label: "DNS", variant: "secondary" },
      dsq: { label: "DSQ", variant: "outline" }
    };
    return variants[statut.toLowerCase()] || null;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center justify-between gap-3">
            <div className="flex flex-col items-start gap-1">
              {meta ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl font-bold">{meta.course_nom}</span>
                    <Badge variant="outline">{meta.categorie}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
                    <Calendar className="h-4 w-4" />
                    {meta.date_debut && format(new Date(meta.date_debut), 'dd MMM', { locale: fr })}
                    {meta.date_fin && meta.date_fin !== meta.date_debut && (
                      <> - {format(new Date(meta.date_fin), 'dd MMM yyyy', { locale: fr })}</>
                    )}
                  </div>
                </>
              ) : (
                <Skeleton className="h-6 w-64" />
              )}
            </div>
            {isAdmin && (
              <Button
                onClick={handleComputePoints}
                disabled={computing}
                size="sm"
                variant="outline"
              >
                <Calculator className="h-4 w-4 mr-2" />
                {computing ? "Calcul..." : "Recalculer points"}
              </Button>
            )}
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4 overflow-y-auto">
          {/* Type selector pills */}
          <div className="flex gap-2 flex-wrap">
            {meta?.types_disponibles?.map((type) => (
              <Button
                key={type}
                variant={selectedType === type ? "default" : "outline"}
                size="sm"
                onClick={() => handleTypeChange(type)}
              >
                {type}
              </Button>
            ))}
          </div>

          {/* Etape selector if applicable */}
          {selectedType === 'Etape' && meta?.etapes_disponibles && (
            <Select
              value={selectedEtape?.toString() || ""}
              onValueChange={(value) => setSelectedEtape(parseInt(value))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sélectionner étape" />
              </SelectTrigger>
              <SelectContent>
                {meta.etapes_disponibles.map((etape) => (
                  <SelectItem key={etape} value={etape.toString()}>
                    Étape {etape}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Top N selector */}
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-sm text-muted-foreground">Top:</span>
            {[10, 15, 25, 50].map((n) => (
              <Button
                key={n}
                variant={topN === n ? "default" : "outline"}
                size="sm"
                onClick={() => setTopN(n)}
              >
                {n}
              </Button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher coureur ou équipe..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Results count */}
          {!loading && displayedResults.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Affichage de {displayedResults.length} résultat{displayedResults.length > 1 ? 's' : ''}
              {searchQuery && ` sur ${results.length} total`}
            </div>
          )}

          {/* Results table */}
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : displayedResults.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {results.length === 0 
                ? "Aucun résultat pour ce classement" 
                : "Aucun résultat ne correspond à votre recherche"}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Pos./Statut</TableHead>
                    <TableHead>Coureur</TableHead>
                    <TableHead className="hidden md:table-cell">Équipe</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="hidden sm:table-cell">Manager</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedResults.map((row) => {
                    const isFinished = row.statut === 'finished' && row.row_position !== null;
                    const statutBadge = getStatutBadge(row.statut);
                    const hasOfficialPoints = row.points_officiels !== null;
                    const points = hasOfficialPoints ? row.points_officiels : row.points_theoriques;
                    
                    return (
                      <TableRow
                        key={row.race_result_id}
                        className={row.is_my_rider ? "bg-primary/5 border-l-2 border-l-primary" : ""}
                      >
                        <TableCell className="font-medium">
                          {isFinished ? (
                            <div className="flex items-center gap-2">
                              {row.row_position && row.row_position <= 3 && (
                                <span className={`text-lg ${
                                  row.row_position === 1 ? "text-yellow-500" :
                                  row.row_position === 2 ? "text-gray-400" :
                                  "text-amber-600"
                                }`}>
                                  {row.row_position === 1 ? "🥇" : 
                                   row.row_position === 2 ? "🥈" : "🥉"}
                                </span>
                              )}
                              <span>{row.row_position}</span>
                            </div>
                          ) : statutBadge ? (
                            <Badge variant={statutBadge.variant}>
                              {statutBadge.label}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{row.coureur_nom}</span>
                              {row.is_my_rider && (
                                <Badge variant="default" className="text-xs">Mon équipe</Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground md:hidden">{row.equipe}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {row.equipe && (
                            <Badge variant="outline" className="text-xs">
                              {row.equipe}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isFinished ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="font-semibold text-lg">{points}</span>
                              <Badge 
                                variant={hasOfficialPoints ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {hasOfficialPoints ? "Officiel" : "Barème"}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                          {row.manager_nom || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
