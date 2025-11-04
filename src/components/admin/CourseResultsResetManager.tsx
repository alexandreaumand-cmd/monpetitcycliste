import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Trash2 } from "lucide-react";

export const CourseResultsResetManager = () => {
  const [courseId, setCourseId] = useState("");
  const [courseSaisonFilter, setCourseSaisonFilter] = useState("");
  const [saisonId, setSaisonId] = useState("");
  const [confirmPhraseCourse, setConfirmPhraseCourse] = useState("");
  const [confirmPhraseSeason, setConfirmPhraseSeason] = useState("");
  const [confirmPhraseAll, setConfirmPhraseAll] = useState("");
  const { toast } = useToast();

  // Fetch courses with season info
  const { data: courses } = useQuery({
    queryKey: ['courses-for-reset', courseSaisonFilter],
    queryFn: async () => {
      let query = supabase
        .from('courses')
        .select(`
          id, 
          nom,
          phase_id,
          phases!inner(
            id,
            saison_id,
            saisons!inner(annee)
          )
        `)
        .order('nom');
      
      // Filter by season if selected
      if (courseSaisonFilter) {
        query = query.eq('phases.saison_id', courseSaisonFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch seasons
  const { data: seasons } = useQuery({
    queryKey: ['seasons-for-reset'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saisons')
        .select('*')
        .order('annee', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Reset course mutation
  const resetCourse = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-reset-course-results', {
        body: { course_id: courseId, confirm_phrase: confirmPhraseCourse },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Résultats supprimés",
        description: `${data.results_deleted} résultats et ${data.points_deleted} points supprimés`,
      });
      setConfirmPhraseCourse("");
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
  });

  // Reset season mutation
  const resetSeason = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-reset-season-results', {
        body: { saison_id: saisonId, confirm_phrase: confirmPhraseSeason },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Résultats de la saison supprimés",
        description: `${data.courses_affected} courses affectées, ${data.results_deleted} résultats supprimés`,
      });
      setConfirmPhraseSeason("");
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
  });

  // Reset all mutation (using existing function)
  const resetAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('reset-courses', {
        body: { type: 'all', confirm_phrase: confirmPhraseAll },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Tous les résultats supprimés",
        description: "La base de données a été réinitialisée",
      });
      setConfirmPhraseAll("");
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>🗑️ Reset des résultats de courses</CardTitle>
        <CardDescription>
          Supprimer les résultats et points d'une course, d'une saison, ou tout
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="course">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="course">Une course</TabsTrigger>
            <TabsTrigger value="season">Par saison</TabsTrigger>
            <TabsTrigger value="all">Tout (danger)</TabsTrigger>
          </TabsList>

          <TabsContent value="course" className="space-y-4">
            {/* Season filter */}
            <div className="space-y-2">
              <Label>Filtrer par saison (optionnel)</Label>
              <Select 
                value={courseSaisonFilter} 
                onValueChange={(value) => {
                  setCourseSaisonFilter(value);
                  setCourseId(""); // Reset course selection when season changes
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les saisons" />
                </SelectTrigger>
                <SelectContent>
                  {seasons?.map((season) => (
                    <SelectItem key={season.id} value={season.id}>
                      Saison {season.annee}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {courseSaisonFilter && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setCourseSaisonFilter("");
                    setCourseId("");
                  }}
                  className="h-8"
                >
                  Réinitialiser le filtre
                </Button>
              )}
              {courseSaisonFilter && courses && (
                <p className="text-xs text-muted-foreground">
                  {courses.length} course(s) dans cette saison
                </p>
              )}
            </div>

            {/* Course selector */}
            <div className="space-y-2">
              <Label>Course</Label>
              <Select value={courseId} onValueChange={setCourseId}>
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

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                ⚠️ Supprimera tous les résultats et points de cette course
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Phrase de confirmation</Label>
              <Input
                placeholder={`RESET COURSE ${courseId || '...'}`}
                value={confirmPhraseCourse}
                onChange={(e) => setConfirmPhraseCourse(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Tapez exactement: <code>RESET COURSE {courseId}</code>
              </p>
            </div>

            <Button
              variant="destructive"
              disabled={confirmPhraseCourse !== `RESET COURSE ${courseId}` || !courseId}
              onClick={() => resetCourse.mutate()}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer résultats de cette course
            </Button>
          </TabsContent>

          <TabsContent value="season" className="space-y-4">
            <div className="space-y-2">
              <Label>Saison</Label>
              <Select value={saisonId} onValueChange={setSaisonId}>
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

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                ⚠️ Supprimera tous les résultats de TOUTES les courses de cette saison
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Phrase de confirmation</Label>
              <Input
                placeholder="RESET SAISON RESULTS"
                value={confirmPhraseSeason}
                onChange={(e) => setConfirmPhraseSeason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Tapez exactement: <code>RESET SAISON RESULTS</code>
              </p>
            </div>

            <Button
              variant="destructive"
              disabled={confirmPhraseSeason !== 'RESET SAISON RESULTS' || !saisonId}
              onClick={() => resetSeason.mutate()}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer résultats de la saison
            </Button>
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                ⚠️ DANGER : Supprimera TOUS les résultats de TOUTES les courses
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Phrase de confirmation</Label>
              <Input
                placeholder="RESET ALL RESULTS"
                value={confirmPhraseAll}
                onChange={(e) => setConfirmPhraseAll(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Tapez exactement: <code>RESET ALL RESULTS</code>
              </p>
            </div>

            <Button
              variant="destructive"
              disabled={confirmPhraseAll !== 'RESET ALL RESULTS'}
              onClick={() => resetAll.mutate()}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer TOUS les résultats
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
