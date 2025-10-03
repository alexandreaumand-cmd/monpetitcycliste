import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { OneDayResultsForm } from "./OneDayResultsForm";
import { Calendar, Trophy, CheckCircle2, Circle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type OneDayCourse = {
  course_id: string;
  course_nom: string;
  categorie: string;
  date_debut: string;
  date_fin: string;
  phase_id: string;
  has_results: boolean;
};

export const OneDayRacesManager = () => {
  const [dayRange, setDayRange] = useState(30);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<OneDayCourse | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // Fetch one-day courses
  const { data: courses, isLoading } = useQuery({
    queryKey: ['oneday-courses', dayRange],
    queryFn: async () => {
      const cutoffDate = new Date(Date.now() - dayRange * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, nom, categorie, date_debut, date_fin, phase_id, type_course')
        .eq('type_course', 'one-day races')
        .gte('date_fin', cutoffDate)
        .order('date_fin', { ascending: false });
      
      if (coursesError) throw coursesError;

      // Check for results
      const coursesWithStatus = await Promise.all(
        (coursesData || []).map(async (course) => {
          const { count } = await supabase
            .from('race_results')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', course.id)
            .eq('type_classement', 'General');

          return {
            course_id: course.id,
            course_nom: course.nom,
            categorie: course.categorie || '',
            date_debut: course.date_debut || '',
            date_fin: course.date_fin || '',
            phase_id: course.phase_id || '',
            has_results: (count || 0) > 0
          };
        })
      );

      return coursesWithStatus;
    },
  });

  const filteredCourses = courses?.filter(course => {
    if (categoryFilter !== "all" && course.categorie !== categoryFilter) return false;
    if (searchFilter && !course.course_nom.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

  // Get unique categories for filter
  const categories = Array.from(new Set(courses?.map(c => c.categorie) || [])).filter(Boolean);

  const handleOpenForm = (course: OneDayCourse) => {
    setSelectedCourse(course);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setSelectedCourse(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Courses d'un jour</h2>
        <p className="text-muted-foreground">Saisie et modification des résultats des courses d'un jour</p>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex gap-2">
          <Button
            variant={dayRange === 7 ? "default" : "outline"}
            size="sm"
            onClick={() => setDayRange(7)}
          >
            7 jours
          </Button>
          <Button
            variant={dayRange === 30 ? "default" : "outline"}
            size="sm"
            onClick={() => setDayRange(30)}
          >
            30 jours
          </Button>
          <Button
            variant={dayRange === 90 ? "default" : "outline"}
            size="sm"
            onClick={() => setDayRange(90)}
          >
            90 jours
          </Button>
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Rechercher une course..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {/* Courses List */}
      {isLoading ? (
        <div className="text-center py-8">Chargement des courses...</div>
      ) : filteredCourses?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucune course trouvée
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredCourses?.map((course) => (
            <Card key={course.course_id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5" />
                      {course.course_nom}
                    </CardTitle>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="secondary">{course.categorie}</Badge>
                      {course.has_results ? (
                        <Badge variant="default" className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Résultats saisis
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Circle className="h-3 w-3" />
                          En attente
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button onClick={() => handleOpenForm(course)}>
                    {course.has_results ? 'Modifier' : 'Saisie initiale'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {new Date(course.date_fin).toLocaleDateString('fr-FR')}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedCourse && formOpen && (
        <OneDayResultsForm
          course={selectedCourse}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
};
