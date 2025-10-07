import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResultsEntryStudio } from "./ResultsEntryStudio";
import { normalizeCourseType } from "@/lib/courseType";

type RaceType = "stage" | "oneday";

type CourseData = {
  course_id: string;
  course_nom: string;
  categorie: string;
  type_course: "One day" | "Stage race";
  date_debut: string;
  date_fin: string;
  nb_etapes: number;
  phase_id: string;
};

export const ResultsEntry = () => {
  const [selectedRaceType, setSelectedRaceType] = useState<RaceType | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);

  // Fetch courses based on race type
  const { data: courses } = useQuery({
    queryKey: ['courses-for-entry', selectedRaceType],
    queryFn: async () => {
      if (!selectedRaceType) return [];
      
      const ilike = selectedRaceType === 'stage' ? '%stage%' : '%one%';
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .ilike('type_course', ilike)
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
      let nb_etapes: number;

      // Special case: WT GT always has 21 stages
      if (data.categorie === 'WT GT') {
        nb_etapes = 21;
      } else {
        // Normal calculation based on dates
        const dateDebut = data.date_debut ? new Date(data.date_debut) : null;
        const dateFin = data.date_fin ? new Date(data.date_fin) : null;
        const daysDiff = dateDebut && dateFin 
          ? Math.ceil((dateFin.getTime() - dateDebut.getTime()) / (1000 * 60 * 60 * 24)) + 1
          : 1;
        nb_etapes = Math.max(1, daysDiff);
      }

      return {
        course_id: data.id,
        course_nom: data.nom,
        categorie: data.categorie,
        type_course: normalizeCourseType(data.type_course).display,
        date_debut: data.date_debut,
        date_fin: data.date_fin,
        nb_etapes,
        phase_id: data.phase_id,
      } as CourseData;
    },
    enabled: !!selectedCourseId,
  });

  const handleRaceTypeChange = (value: string) => {
    setSelectedRaceType(value as RaceType);
    setSelectedCourseId(null);
  };

  const handleCourseChange = (value: string) => {
    setSelectedCourseId(value);
  };

  const openStudio = () => {
    if (courseData) {
      setStudioOpen(true);
    }
  };

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
                <SelectItem value="oneday">Course d'un jour</SelectItem>
                <SelectItem value="stage">Course à étapes</SelectItem>
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

          {/* Course Info & Launch Button */}
          {courseData && (
            <div className="p-4 bg-muted rounded-md space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{courseData.categorie}</Badge>
                  <Badge variant="outline">{courseData.type_course}</Badge>
                </div>
                <p><strong>Dates:</strong> {courseData.date_debut} → {courseData.date_fin}</p>
                {courseData.type_course === 'Stage race' && (
                  <p><strong>Nombre d'étapes:</strong> {courseData.nb_etapes}</p>
                )}
              </div>
              
              <Button onClick={openStudio} className="w-full" size="lg">
                Ouvrir le Studio de saisie
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Entry Studio */}
      {courseData && studioOpen && (
        <ResultsEntryStudio
          course={courseData}
          mode="create"
          onClose={() => setStudioOpen(false)}
        />
      )}
    </>
  );
};
