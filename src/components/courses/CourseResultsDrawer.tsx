import { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Calendar } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface CourseMeta {
  course_nom: string;
  categorie: string;
  date_debut: string;
  date_fin: string;
  types_disponibles: string[];
  etapes_disponibles: number[];
}

interface ResultRow {
  row_position: number;
  statut: string;
  coureur_id: string;
  coureur_nom: string;
  equipe: string;
  manager_id: string | null;
  manager_nom: string | null;
  points_officiels: number | null;
  points_theoriques: number;
  points: number;
  is_my_rider: boolean;
  has_official_points: boolean;
}

interface CourseResultsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string | null;
}

export const CourseResultsDrawer = ({ open, onOpenChange, courseId }: CourseResultsDrawerProps) => {
  const [meta, setMeta] = useState<CourseMeta | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedEtape, setSelectedEtape] = useState<number | null>(null);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [hasOfficialPoints, setHasOfficialPoints] = useState(false);

  useEffect(() => {
    if (open && courseId) {
      loadMeta();
    }
  }, [open, courseId]);

  useEffect(() => {
    if (meta && selectedType) {
      loadResults();
    }
  }, [selectedType, selectedEtape, limit, meta]);

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
        
        // Set default type
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
      const { data, error } = await supabase.functions.invoke('results-course-top', {
        body: {
          course_id: courseId,
          type_classement: selectedType,
          etape_numero: selectedType === 'Etape' ? selectedEtape : null,
          limit
        }
      });

      if (error) throw error;

      setResults(data?.rows || []);
      setHasOfficialPoints(data?.has_official_points || false);
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

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-3">
            {meta ? (
              <>
                <Trophy className="h-5 w-5 text-primary" />
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-2">
                    <span>{meta.course_nom}</span>
                    <Badge variant="outline">{meta.categorie}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
                    <Calendar className="h-4 w-4" />
                    {meta.date_debut && format(new Date(meta.date_debut), 'dd MMM', { locale: fr })}
                    {meta.date_fin && meta.date_fin !== meta.date_debut && (
                      <> - {format(new Date(meta.date_fin), 'dd MMM yyyy', { locale: fr })}</>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <Skeleton className="h-6 w-64" />
            )}
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4 overflow-y-auto">
          {/* Type and Etape selectors */}
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

          {/* Limit selector */}
          <div className="flex gap-2">
            <span className="text-sm text-muted-foreground self-center">Top:</span>
            {[10, 15, 25].map((n) => (
              <Button
                key={n}
                variant={limit === n ? "default" : "outline"}
                size="sm"
                onClick={() => setLimit(n)}
              >
                {n}
              </Button>
            ))}
          </div>

          {/* Results table */}
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Pas de résultats disponibles pour cette sélection
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Pos.</TableHead>
                    <TableHead>Coureur</TableHead>
                    <TableHead className="hidden md:table-cell">Équipe</TableHead>
                    <TableHead className="text-right">
                      Points
                      {hasOfficialPoints && (
                        <Badge variant="secondary" className="ml-2 text-xs">Officiels</Badge>
                      )}
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">Manager</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((row) => (
                    <TableRow
                      key={row.coureur_id}
                      className={row.is_my_rider ? "bg-primary/5" : ""}
                    >
                      <TableCell className="font-medium">
                        {row.row_position <= 3 ? (
                          <div className="flex items-center gap-1">
                            <Trophy className={`h-4 w-4 ${
                              row.row_position === 1 ? 'text-yellow-500' :
                              row.row_position === 2 ? 'text-gray-400' :
                              'text-amber-600'
                            }`} />
                            {row.row_position}
                          </div>
                        ) : (
                          row.row_position
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{row.coureur_nom}</span>
                          <span className="text-xs text-muted-foreground md:hidden">{row.equipe}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {row.equipe}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {row.points}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {row.manager_nom ? (
                          <div className="flex items-center gap-1">
                            <span>{row.manager_nom}</span>
                            {row.is_my_rider && (
                              <Badge variant="default" className="text-xs">Mon équipe</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
