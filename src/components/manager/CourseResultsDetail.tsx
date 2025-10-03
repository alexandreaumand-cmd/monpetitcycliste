import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trophy, Award } from "lucide-react";
import { CourseLeaderboardDrawer } from "./CourseLeaderboardDrawer";

interface Props {
  courseId: string;
}

export const CourseResultsDetail = ({ courseId }: Props) => {
  const [typeClassement, setTypeClassement] = useState<string>("");
  const [etapeNumero, setEtapeNumero] = useState<number | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const loadResults = async () => {
    if (!typeClassement) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manager-results', {
        body: {
          action: 'course_results',
          course_id: courseId,
          type_classement: typeClassement,
          etape_numero: typeClassement === 'Etape' ? etapeNumero : null,
        },
      });

      if (error) throw error;

      setRows(data.rows || []);
      setMeta(data.meta);
    } catch (error: any) {
      console.error('Error loading results:', error);
      toast.error(error.message || "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset and load meta first
    const loadMeta = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('manager-results', {
          body: {
            action: 'course_results',
            course_id: courseId,
            type_classement: 'General', // Default to get meta
            etape_numero: null,
          },
        });

        if (error) throw error;

        setMeta(data.meta);
        // Set default type to first available
        if (data.meta.types_disponibles?.length > 0) {
          setTypeClassement(data.meta.types_disponibles[0]);
        }
      } catch (error: any) {
        console.error('Error loading meta:', error);
      }
    };

    loadMeta();
  }, [courseId]);

  useEffect(() => {
    if (typeClassement) {
      loadResults();
    }
  }, [typeClassement, etapeNumero]);

  if (!meta) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <CardTitle>{meta.course_nom}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{meta.date_debut} → {meta.date_fin}</span>
              <Badge variant="outline">{meta.categorie}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-center justify-between flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {meta.types_disponibles?.map((type: string) => (
                <Badge
                  key={type}
                  variant={typeClassement === type ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setTypeClassement(type)}
                >
                  {type}
                </Badge>
              ))}
            </div>

            {typeClassement === 'Etape' && meta.etapes_disponibles?.length > 0 && (
              <Select
                value={etapeNumero?.toString() || ""}
                onValueChange={(v) => setEtapeNumero(parseInt(v))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="# Étape" />
                </SelectTrigger>
                <SelectContent>
                  {meta.etapes_disponibles.map((num: number) => (
                    <SelectItem key={num} value={num.toString()}>
                      Étape {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-medium">Mes points sur cette course</div>
                <div className="text-2xl font-bold">{meta.my_points_course || 0}</div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowLeaderboard(true)}>
              <Award className="h-4 w-4 mr-2" />
              Voir classement managers
            </Button>
          </div>

          {loading ? (
            <p className="text-muted-foreground">Chargement des résultats...</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground">Aucun résultat disponible</p>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Pos.</TableHead>
                    <TableHead>Coureur</TableHead>
                    <TableHead>Équipe</TableHead>
                    <TableHead className="text-right">Pts barème</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow
                      key={idx}
                      className={row.is_my_rider ? "bg-primary/5" : ""}
                    >
                      <TableCell className="font-medium">
                        {row.position || (
                          <Badge variant="secondary" className="text-xs">
                            {row.statut.toUpperCase()}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {row.coureur_nom}
                          {row.is_my_rider && (
                            <Badge variant="default" className="text-xs">
                              Mon équipe
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.equipe}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {row.points_barreme || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CourseLeaderboardDrawer
        open={showLeaderboard}
        onOpenChange={setShowLeaderboard}
        courseId={courseId}
      />
    </>
  );
};
