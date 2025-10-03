import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CourseLeaderboardDrawer } from "./CourseLeaderboardDrawer";
import { Trophy } from "lucide-react";

interface CourseResultsDetailProps {
  course: any;
  managerId: string;
}

export const CourseResultsDetail = ({ course, managerId }: CourseResultsDetailProps) => {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedEtape, setSelectedEtape] = useState<string>("");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  useEffect(() => {
    if (course) {
      // Auto-select first available type
      const firstType = course.types?.[0];
      if (firstType) {
        setSelectedType(firstType);
      }
    }
  }, [course]);

  useEffect(() => {
    if (course && selectedType) {
      loadResults();
    }
  }, [course, selectedType, selectedEtape]);

  const loadResults = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manager-results', {
        body: {
          action: 'course_results',
          course_id: course.course_id,
          type_classement: selectedType,
          etape_numero: selectedType === 'Etape' ? parseInt(selectedEtape || '1') : undefined
        }
      });

      if (error) throw error;

      setResults(data);

      // Auto-select first etape if type is Etape
      if (selectedType === 'Etape' && !selectedEtape && data.meta?.etapes_disponibles?.length > 0) {
        setSelectedEtape(data.meta.etapes_disponibles[data.meta.etapes_disponibles.length - 1].toString());
      }
    } catch (error: any) {
      console.error('Error loading results:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les résultats"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!course) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Sélectionnez une course pour voir les résultats
      </div>
    );
  }

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, any> = {
      dnf: { label: 'DNF', variant: 'destructive' },
      dns: { label: 'DNS', variant: 'secondary' },
      dsq: { label: 'DSQ', variant: 'outline' }
    };
    const config = variants[statut.toLowerCase()];
    return config ? <Badge variant={config.variant}>{config.label}</Badge> : null;
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-6 border-b space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{results?.meta?.course_nom || course.nom}</h3>
          <p className="text-sm text-muted-foreground">
            {course.date_debut && format(new Date(course.date_debut), 'd MMM', { locale: fr })} → {course.date_fin && format(new Date(course.date_fin), 'd MMM yyyy', { locale: fr })}
            <Badge variant="outline" className="ml-2">{course.categorie}</Badge>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {results?.meta?.types_disponibles?.map((type: string) => (
            <Button
              key={type}
              variant={selectedType === type ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType(type)}
            >
              {type}
            </Button>
          ))}
        </div>

        {selectedType === 'Etape' && results?.meta?.etapes_disponibles?.length > 0 && (
          <Select value={selectedEtape} onValueChange={setSelectedEtape}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sélectionner l'étape" />
            </SelectTrigger>
            <SelectContent>
              {results.meta.etapes_disponibles.map((etape: number) => (
                <SelectItem key={etape} value={etape.toString()}>
                  Étape {etape}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div>
            <span className="text-sm text-muted-foreground">Mes points sur cette course : </span>
            <span className="font-semibold">
              {results?.meta?.my_points_course !== undefined ? results.meta.my_points_course : '—'}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLeaderboardOpen(true)}>
            <Trophy className="h-4 w-4 mr-2" />
            Voir classement managers
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-6">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Pos.</TableHead>
                <TableHead>Coureur</TableHead>
                <TableHead className="w-32">Équipe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results?.rows?.map((row: any, idx: number) => (
                <TableRow 
                  key={idx}
                  className={row.is_my_rider ? "bg-primary/5" : ""}
                >
                  <TableCell className="font-medium">
                    {row.position !== null ? row.position : getStatutBadge(row.statut)}
                  </TableCell>
                  <TableCell>
                    {row.coureur_nom}
                    {row.is_my_rider && (
                      <Badge variant="default" className="ml-2 text-xs">Mon équipe</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.equipe}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ScrollArea>

      <CourseLeaderboardDrawer
        open={leaderboardOpen}
        onOpenChange={setLeaderboardOpen}
        courseId={course.course_id}
      />
    </div>
  );
};
