import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calculator, AlertCircle, Wrench } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { useLeagueSeason } from "@/hooks/useLeagueSeason";

export const PointsComputeManager = () => {
  const { season } = useLeagueSeason();
  const { toast } = useToast();

  // Section "Recalcul complet d'une phase"
  const [fullRecalcSeasonId, setFullRecalcSeasonId] = useState<string>("");
  const [fullRecalcPhaseId, setFullRecalcPhaseId] = useState<string>("");
  const [computing, setComputing] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Section "Recalcul course spécifique"
  const [courseSeasonId, setCourseSeasonId] = useState<string>("");
  const [coursePhaseId, setCoursePhaseId] = useState<string>("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [computingCourse, setComputingCourse] = useState(false);
  const [courseResult, setCourseResult] = useState<any>(null);

  // Section "Réparation automatique"
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<any>(null);

  // Fetch saisons
  const { data: seasons } = useQuery({
    queryKey: ['saisons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saisons')
        .select('id, annee')
        .order('annee', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Fetch phases pour section "Recalcul complet"
  const { data: fullRecalcPhases } = useQuery({
    queryKey: ['phases-full-recalc', fullRecalcSeasonId],
    queryFn: async () => {
      if (!fullRecalcSeasonId) return [];
      const { data, error } = await supabase
        .from('phases')
        .select('*')
        .eq('saison_id', fullRecalcSeasonId)
        .order('index_dans_saison', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!fullRecalcSeasonId
  });

  // Fetch phases pour section "Recalcul course"
  const { data: coursePhases } = useQuery({
    queryKey: ['phases-course-recalc', courseSeasonId],
    queryFn: async () => {
      if (!courseSeasonId) return [];
      const { data, error } = await supabase
        .from('phases')
        .select('*')
        .eq('saison_id', courseSeasonId)
        .order('index_dans_saison', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!courseSeasonId
  });

  // Fetch courses
  const { data: courses } = useQuery({
    queryKey: ['courses', coursePhaseId],
    queryFn: async () => {
      if (!coursePhaseId) return [];
      const { data, error } = await supabase
        .from('courses')
        .select('id, nom, categorie, date_debut, date_fin')
        .eq('phase_id', coursePhaseId)
        .order('date_debut', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!coursePhaseId
  });

  // Auto-sélection de la saison courante au chargement
  useEffect(() => {
    if (season && !fullRecalcSeasonId) {
      setFullRecalcSeasonId(season.id);
    }
    if (season && !courseSeasonId) {
      setCourseSeasonId(season.id);
    }
  }, [season]);

  // Auto-sélection de la phase active pour "Recalcul complet"
  useEffect(() => {
    if (fullRecalcPhases && fullRecalcPhases.length > 0) {
      const activePhase = fullRecalcPhases.find(p => p.statut === 'active');
      setFullRecalcPhaseId(activePhase?.id || fullRecalcPhases[0].id);
    }
  }, [fullRecalcPhases]);

  // Auto-sélection de la phase active pour "Recalcul course"
  useEffect(() => {
    if (coursePhases && coursePhases.length > 0) {
      const activePhase = coursePhases.find(p => p.statut === 'active');
      setCoursePhaseId(activePhase?.id || coursePhases[0].id);
    }
  }, [coursePhases]);

  // Reset en cascade
  const handleFullRecalcSeasonChange = (seasonId: string) => {
    setFullRecalcSeasonId(seasonId);
    setFullRecalcPhaseId("");
  };

  const handleCourseSeasonChange = (seasonId: string) => {
    setCourseSeasonId(seasonId);
    setCoursePhaseId("");
    setSelectedCourseId("");
  };

  const handleCoursePhaseChange = (phaseId: string) => {
    setCoursePhaseId(phaseId);
    setSelectedCourseId("");
  };

  const handleCompute = async () => {
    if (!fullRecalcPhaseId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une phase",
        variant: "destructive"
      });
      return;
    }

    const confirmed = window.confirm(
      "⚠️ ATTENTION : Cette action va recalculer TOUS les points pour cette phase.\n\n" +
      "Cela va :\n" +
      "• Recalculer les points de toutes les courses de la phase\n" +
      "• Mettre à jour tous les totaux managers\n" +
      "• Peut prendre plusieurs secondes\n\n" +
      "Êtes-vous sûr de vouloir continuer ?"
    );

    if (!confirmed) return;

    setComputing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('compute-points', {
        body: { phase_id: fullRecalcPhaseId }
      });

      if (error) throw error;

      setResult(data);
      toast({
        title: "✅ Calcul terminé avec succès",
        description: `${data.courses_processed} courses traitées → ${data.total_rows} points calculés pour tous les managers`
      });
    } catch (error: any) {
      console.error('Error computing points:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de calculer les points",
        variant: "destructive"
      });
    } finally {
      setComputing(false);
    }
  };

  const handleComputeCourse = async () => {
    if (!selectedCourseId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une course",
        variant: "destructive"
      });
      return;
    }

    setComputingCourse(true);
    setCourseResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('admin-recompute-course', {
        body: { course_id: selectedCourseId }
      });

      if (error) throw error;

      setCourseResult(data);
      toast({
        title: "✅ Calcul terminé avec succès",
        description: `${data.rows_upserted} entrées mises à jour pour la course ${selectedCourseId}`
      });
    } catch (error: any) {
      console.error('Error computing course points:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de calculer les points de la course",
        variant: "destructive"
      });
    } finally {
      setComputingCourse(false);
    }
  };

  const handleFixPorteurPoints = async () => {
    setFixing(true);
    setFixResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('auto-fix-missing-porteur-points');

      if (error) throw error;

      setFixResult(data);
      toast({
        title: "✅ Réparation terminée",
        description: `${data.courses_processed} courses traitées, ${data.total_points_added} points ajoutés`
      });
    } catch (error: any) {
      console.error('Error fixing porteur points:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de réparer les points porteurs",
        variant: "destructive"
      });
    } finally {
      setFixing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Recalcul des points
        </CardTitle>
        <CardDescription>
          ⚠️ Recalcule TOUS les points pour une phase complète (toutes les courses). Cette action reconstruit complètement le ledger de points.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">🔁 Recalcul complet d'une phase</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Recalcule tous les points de toutes les courses d'une phase
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Saison</Label>
              <Select value={fullRecalcSeasonId} onValueChange={handleFullRecalcSeasonChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une saison" />
                </SelectTrigger>
                <SelectContent>
                  {seasons?.map((season) => (
                    <SelectItem key={season.id} value={season.id}>
                      Saison {season.annee}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Phase</Label>
              <Select 
                value={fullRecalcPhaseId} 
                onValueChange={setFullRecalcPhaseId}
                disabled={!fullRecalcSeasonId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une phase" />
                </SelectTrigger>
                <SelectContent>
                  {fullRecalcPhases?.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      Phase {phase.index_dans_saison} - {phase.statut}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleCompute}
              disabled={computing || !fullRecalcPhaseId}
              className="w-full"
            >
              {computing ? "Calcul en cours..." : "Recalculer toute la phase"}
            </Button>
          </div>
        </div>

        {result && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Résultat :</strong>
              <br />
              • {result.courses_processed} courses traitées
              <br />
              • {result.total_rows} lignes de points créées/mises à jour
              {result.missing_bareme && result.missing_bareme.length > 0 && (
                <>
                  <br />
                  <br />
                  <strong className="text-destructive">⚠️ Barèmes manquants :</strong>
                  <pre className="mt-2 text-xs">
                    {JSON.stringify(result.missing_bareme, null, 2)}
                  </pre>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Separator className="my-6" />

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">🎯 Recalcul d'une course spécifique</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Recalcule les points d'une seule course
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Saison</Label>
              <Select value={courseSeasonId} onValueChange={handleCourseSeasonChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une saison" />
                </SelectTrigger>
                <SelectContent>
                  {seasons?.map((season) => (
                    <SelectItem key={season.id} value={season.id}>
                      Saison {season.annee}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Phase</Label>
              <Select 
                value={coursePhaseId} 
                onValueChange={handleCoursePhaseChange}
                disabled={!courseSeasonId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une phase" />
                </SelectTrigger>
                <SelectContent>
                  {coursePhases?.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      Phase {phase.index_dans_saison} - {phase.statut}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Course</Label>
              <Select 
                value={selectedCourseId} 
                onValueChange={setSelectedCourseId}
                disabled={!coursePhaseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une course" />
                </SelectTrigger>
                <SelectContent>
                  {courses?.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.id} - {course.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleComputeCourse}
              disabled={computingCourse || !selectedCourseId}
              className="w-full"
            >
              {computingCourse ? "Calcul en cours..." : "Recalculer cette course"}
            </Button>
          </div>

          {courseResult && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Résultat :</strong>
                <br />
                • {courseResult.rows_upserted} entrées mises à jour
                {courseResult.missing_bareme && courseResult.missing_bareme.length > 0 && (
                  <>
                    <br />
                    <br />
                    <strong className="text-destructive">⚠️ Barèmes manquants :</strong>
                    <pre className="mt-2 text-xs">
                      {JSON.stringify(courseResult.missing_bareme, null, 2)}
                    </pre>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Separator className="my-6" />

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Réparation automatique</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Détecte et corrige automatiquement les points manquants pour les porteurs de maillots
            </p>
          </div>

          <Button 
            onClick={handleFixPorteurPoints}
            disabled={fixing}
            variant="outline"
            className="w-full"
          >
            <Wrench className="h-4 w-4 mr-2" />
            {fixing ? "Réparation en cours..." : "Réparer les points porteurs"}
          </Button>

          {fixResult && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Résultat de la réparation :</strong>
                <br />
                • {fixResult.courses_processed} courses traitées
                <br />
                • {fixResult.total_points_added} points ajoutés
                <br />
                • {fixResult.successful} succès / {fixResult.failed} échecs
                {fixResult.results && fixResult.results.length > 0 && (
                  <>
                    <br />
                    <br />
                    <strong>Détails :</strong>
                    <div className="mt-2 space-y-1 text-xs">
                      {fixResult.results.map((r: any, i: number) => (
                        <div key={i} className={r.success ? "text-green-600" : "text-destructive"}>
                          {r.success ? "✓" : "✗"} {r.course_nom} ({r.course_id})
                          {r.rows_upserted && ` - ${r.rows_upserted} points ajoutés`}
                          {r.error && ` - Erreur: ${r.error}`}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
