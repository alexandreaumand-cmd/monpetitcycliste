import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResultsEntryDrawer } from "./ResultsEntryDrawer";
import { CheckCircle2, Lock, AlertCircle } from "lucide-react";

type RaceType = "stage races" | "one day race";
type ClassementType = "Etape" | "General" | "Points" | "Montagne" | "Jeune";

type CourseData = {
  course_id: string;
  course_nom: string;
  categorie: string;
  type_course: string;
  date_debut: string;
  date_fin: string;
  nb_etapes: number;
  phase_id: string;
};

export const ResultsEntry = () => {
  const [selectedRaceType, setSelectedRaceType] = useState<RaceType | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerConfig, setDrawerConfig] = useState<{
    classement: ClassementType;
    etape?: number;
  } | null>(null);
  const [activeStageTab, setActiveStageTab] = useState<string>("1");
  const [activeFinalsTab, setActiveFinalsTab] = useState<ClassementType>("General");

  // Fetch courses based on race type
  const { data: courses } = useQuery({
    queryKey: ['courses-for-entry', selectedRaceType],
    queryFn: async () => {
      if (!selectedRaceType) return [];
      
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('type_course', selectedRaceType)
        .order('date_debut', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedRaceType,
  });

  // Get course metadata
  const { data: courseData } = useQuery({
    queryKey: ['course-meta', selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return null;
      
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', selectedCourseId)
        .single();
      
      if (error) throw error;

      // Calculate nb_etapes
      const dateDebut = data.date_debut ? new Date(data.date_debut) : null;
      const dateFin = data.date_fin ? new Date(data.date_fin) : null;
      const daysDiff = dateDebut && dateFin 
        ? Math.ceil((dateFin.getTime() - dateDebut.getTime()) / (1000 * 60 * 60 * 24)) + 1
        : 1;

      return {
        course_id: data.id,
        course_nom: data.nom,
        categorie: data.categorie,
        type_course: data.type_course,
        date_debut: data.date_debut,
        date_fin: data.date_fin,
        nb_etapes: Math.max(1, daysDiff),
        phase_id: data.phase_id,
      } as CourseData;
    },
    enabled: !!selectedCourseId,
  });

  // Get stage completion status (for stage races)
  const { data: stageCompletion } = useQuery({
    queryKey: ['stage-completion', selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return { etapes_saisies: 0 };
      
      const { data, error } = await supabase
        .from('race_results')
        .select('etape_numero')
        .eq('course_id', selectedCourseId)
        .eq('type_classement', 'Etape')
        .not('etape_numero', 'is', null);
      
      if (error) throw error;
      
      const uniqueStages = new Set(data?.map(r => r.etape_numero) || []);
      return { etapes_saisies: uniqueStages.size };
    },
    enabled: !!selectedCourseId && courseData?.type_course === 'stage races',
  });

  // Get results status for final classifications
  const { data: resultsStatus } = useQuery({
    queryKey: ['results-status', selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return null;
      
      const { data, error } = await supabase
        .from('race_results')
        .select('type_classement')
        .eq('course_id', selectedCourseId)
        .in('type_classement', ['General', 'Points', 'Montagne', 'Jeune']);
      
      if (error) throw error;
      
      return {
        has_gc: data?.some(r => r.type_classement === 'General') || false,
        has_pts: data?.some(r => r.type_classement === 'Points') || false,
        has_kom: data?.some(r => r.type_classement === 'Montagne') || false,
        has_u23: data?.some(r => r.type_classement === 'Jeune') || false,
      };
    },
    enabled: !!selectedCourseId,
  });

  const handleRaceTypeChange = (value: string) => {
    setSelectedRaceType(value as RaceType);
    setSelectedCourseId(null);
    setActiveStageTab("1");
    setActiveFinalsTab("General");
  };

  const handleCourseChange = (value: string) => {
    setSelectedCourseId(value);
    setActiveStageTab("1");
    setActiveFinalsTab("General");
  };

  const openDrawer = (classement: ClassementType, etape?: number) => {
    setDrawerConfig({ classement, etape });
    setDrawerOpen(true);
  };

  const allStagesCompleted = courseData 
    ? (stageCompletion?.etapes_saisies || 0) >= courseData.nb_etapes
    : false;

  const progressPercent = courseData
    ? ((stageCompletion?.etapes_saisies || 0) / courseData.nb_etapes) * 100
    : 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Saisie des résultats</CardTitle>
          <CardDescription>
            Workflow guidé pour la saisie manuelle des résultats de course
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Race Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Type de course</label>
            <Select value={selectedRaceType || ""} onValueChange={handleRaceTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner le type de course" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="one day race">Course d'un jour</SelectItem>
                <SelectItem value="stage races">Course à étapes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Course Selection */}
          {selectedRaceType && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Course</label>
              <Select value={selectedCourseId || ""} onValueChange={handleCourseChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une course" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {courses?.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.nom} - {course.categorie}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Course Info */}
          {courseData && (
            <div className="p-4 bg-muted rounded-md space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{courseData.categorie}</Badge>
                <Badge variant="outline">{courseData.type_course}</Badge>
              </div>
              <p><strong>Dates:</strong> {courseData.date_debut} → {courseData.date_fin}</p>
              {courseData.type_course === 'stage races' && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span><strong>Progression:</strong> {stageCompletion?.etapes_saisies || 0} / {courseData.nb_etapes} étapes</span>
                    {allStagesCompleted && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>
              )}
            </div>
          )}

          {/* ONE-DAY RACE WORKFLOW */}
          {courseData && courseData.type_course === 'one day race' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Classement Général</h3>
                {resultsStatus?.has_gc && (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Saisi
                  </Badge>
                )}
              </div>
              <Button 
                onClick={() => openDrawer('General')}
                className="w-full"
              >
                {resultsStatus?.has_gc ? 'Modifier le classement' : 'Saisir le classement'}
              </Button>
            </div>
          )}

          {/* STAGE RACE WORKFLOW */}
          {courseData && courseData.type_course === 'stage races' && (
            <div className="space-y-6">
              {/* STEP 1: Stages */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Étape 1 : Saisie des étapes</h3>
                </div>

                <Tabs value={activeStageTab} onValueChange={setActiveStageTab}>
                  <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${Math.min(courseData.nb_etapes, 8)}, 1fr)` }}>
                    {Array.from({ length: courseData.nb_etapes }, (_, i) => (
                      <TabsTrigger key={i + 1} value={`${i + 1}`}>
                        Étape {i + 1}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {Array.from({ length: courseData.nb_etapes }, (_, i) => (
                    <TabsContent key={i + 1} value={`${i + 1}`} className="space-y-4">
                      <Button 
                        onClick={() => openDrawer('Etape', i + 1)}
                        className="w-full"
                      >
                        Saisir l'étape {i + 1}
                      </Button>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              {/* Unlock notification */}
              {allStagesCompleted && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Toutes les étapes sont saisies 🎉 Les classements finaux sont maintenant accessibles.
                  </AlertDescription>
                </Alert>
              )}

              {/* STEP 2: Final Classifications */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">Étape 2 : Classements finaux</h3>
                  {!allStagesCompleted && (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {!allStagesCompleted && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Les classements finaux ne sont accessibles qu'après la saisie de toutes les étapes.
                    </AlertDescription>
                  </Alert>
                )}

                <Tabs 
                  value={activeFinalsTab} 
                  onValueChange={(v) => setActiveFinalsTab(v as ClassementType)}
                  className={!allStagesCompleted ? 'opacity-50 pointer-events-none' : ''}
                >
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="General">GC</TabsTrigger>
                    <TabsTrigger value="Points">Points</TabsTrigger>
                    <TabsTrigger value="Montagne">Montagne</TabsTrigger>
                    <TabsTrigger value="Jeune">Jeune</TabsTrigger>
                  </TabsList>

                  <TabsContent value="General" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Classement Général</span>
                      {resultsStatus?.has_gc && (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Saisi
                        </Badge>
                      )}
                    </div>
                    <Button 
                      onClick={() => openDrawer('General')}
                      disabled={!allStagesCompleted}
                      className="w-full"
                    >
                      {resultsStatus?.has_gc ? 'Modifier' : 'Saisir'}
                    </Button>
                  </TabsContent>

                  <TabsContent value="Points" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Classement par Points</span>
                      {resultsStatus?.has_pts && (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Saisi
                        </Badge>
                      )}
                    </div>
                    <Button 
                      onClick={() => openDrawer('Points')}
                      disabled={!allStagesCompleted}
                      className="w-full"
                    >
                      {resultsStatus?.has_pts ? 'Modifier' : 'Saisir'}
                    </Button>
                  </TabsContent>

                  <TabsContent value="Montagne" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Classement de la Montagne</span>
                      {resultsStatus?.has_kom && (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Saisi
                        </Badge>
                      )}
                    </div>
                    <Button 
                      onClick={() => openDrawer('Montagne')}
                      disabled={!allStagesCompleted}
                      className="w-full"
                    >
                      {resultsStatus?.has_kom ? 'Modifier' : 'Saisir'}
                    </Button>
                  </TabsContent>

                  <TabsContent value="Jeune" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Classement des Jeunes</span>
                      {resultsStatus?.has_u23 && (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Saisi
                        </Badge>
                      )}
                    </div>
                    <Button 
                      onClick={() => openDrawer('Jeune')}
                      disabled={!allStagesCompleted}
                      className="w-full"
                    >
                      {resultsStatus?.has_u23 ? 'Modifier' : 'Saisir'}
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Entry Drawer */}
      {courseData && drawerConfig && (
        <ResultsEntryDrawer
          open={drawerOpen}
          onOpenChange={(open) => {
            setDrawerOpen(open);
            if (!open) setDrawerConfig(null);
          }}
          course={{
            ...courseData,
            // Override with forced values from drawerConfig
            type_course: drawerConfig.classement === 'Etape' ? 'stage races' : courseData.type_course,
          }}
          initialClassement={drawerConfig.classement}
          initialEtape={drawerConfig.etape}
        />
      )}
    </>
  );
};
