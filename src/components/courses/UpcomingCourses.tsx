import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Trophy, Clock, MapPin } from "lucide-react";
import { CoursePointsDrawer } from "./CoursePointsDrawer";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

interface CourseData {
  course_id: string;
  nom: string;
  categorie: string;
  categorie_for_points: string;
  type_course: string;
  date_debut: string;
  date_fin: string;
  phase_index: number;
  nb_jours: number;
  nb_etapes_estimees: number;
  points_total: number;
  points_etapes: number;
  points_gc: number;
  points_pts: number;
  points_mont: number;
  points_jeune: number;
  points_etapes_unitaire: number;
  is_uwt: boolean;
  wt_tier: string | null;
}

export const UpcomingCourses = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("proximity");
  const [selectedCourse, setSelectedCourse] = useState<CourseData | null>(null);

  const { data: courses, isLoading } = useQuery({
    queryKey: ['upcoming-courses'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('v_course_points_theoriques')
        .select('*')
        .gte('date_debut', today)
        .order('date_debut', { ascending: true });
      
      if (error) throw error;
      return data as CourseData[];
    }
  });

  const { data: phases } = useQuery({
    queryKey: ['phases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('index_dans_saison')
        .order('index_dans_saison');
      if (error) throw error;
      return data;
    }
  });

  const filteredAndSortedCourses = courses?.filter(course => {
    const matchesSearch = course.nom.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPhase = phaseFilter === "all" || course.phase_index?.toString() === phaseFilter;
    const matchesCategory = categoryFilter === "all" || course.categorie === categoryFilter;
    const matchesType = typeFilter === "all" || course.type_course === typeFilter;
    
    return matchesSearch && matchesPhase && matchesCategory && matchesType;
  })?.sort((a, b) => {
    const today = new Date();
    switch (sortBy) {
      case "proximity":
        const daysA = differenceInDays(new Date(a.date_debut), today);
        const daysB = differenceInDays(new Date(b.date_debut), today);
        return daysA - daysB;
      case "points":
        return (b.points_total || 0) - (a.points_total || 0);
      case "date":
        return new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime();
      case "category":
        return a.categorie.localeCompare(b.categorie);
      default:
        return 0;
    }
  });

  const categories = [...new Set(courses?.map(c => c.categorie) || [])];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Courses à venir
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Input
              placeholder="Rechercher une course..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Toutes les phases" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les phases</SelectItem>
                {phases?.map(p => (
                  <SelectItem key={p.index_dans_saison} value={p.index_dans_saison.toString()}>
                    Phase {p.index_dans_saison}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Toutes catégories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tous types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="One day">Course d'un jour</SelectItem>
                <SelectItem value="Stage race">Course par étapes</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Trier par..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="proximity">Proximité</SelectItem>
                <SelectItem value="points">Points max</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="category">Catégorie</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Courses List */}
      {!filteredAndSortedCourses || filteredAndSortedCourses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Aucune course à venir dans la période sélectionnée.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedCourses.map(course => {
            const daysUntil = differenceInDays(new Date(course.date_debut), new Date());
            const daysLabel = daysUntil === 0 ? "Aujourd'hui" : `J-${daysUntil}`;
            const etapesLabel = course.type_course === 'Stage race' 
              ? `${course.nb_etapes_estimees} étapes` 
              : "Course d'un jour";

            return (
              <Card key={course.course_id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedCourse(course)}>
                <CardHeader>
                  <div className="space-y-2">
                    <CardTitle className="text-lg">{course.nom}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      {course.phase_index && (
                        <Badge variant="secondary">Phase {course.phase_index}</Badge>
                      )}
                      <Badge variant="outline">{course.categorie}</Badge>
                      <Badge variant="outline">{course.type_course}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {format(new Date(course.date_debut), 'dd MMM', { locale: fr })}
                        {course.date_fin && course.date_fin !== course.date_debut && (
                          <> → {format(new Date(course.date_fin), 'dd MMM', { locale: fr })}</>
                        )}
                        {' '}({course.nb_jours}j)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{daysLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{etapesLabel}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-primary" />
                        <span className="text-2xl font-bold text-primary">
                          {course.points_total || 0}
                        </span>
                        <span className="text-sm text-muted-foreground">pts</span>
                      </div>
                      <span className="text-xs text-primary hover:underline">
                        Voir détail →
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CoursePointsDrawer 
        course={selectedCourse} 
        open={!!selectedCourse}
        onOpenChange={(open) => !open && setSelectedCourse(null)}
      />
    </div>
  );
};
