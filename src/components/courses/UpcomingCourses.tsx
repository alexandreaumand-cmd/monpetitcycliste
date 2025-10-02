import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Search, Calendar } from "lucide-react";
import { CourseDetailsDrawer } from "./CourseDetailsDrawer";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";

interface UpcomingCourse {
  course_id: string;
  nom: string;
  categorie: string;
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
}

export const UpcomingCourses = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPhase, setSelectedPhase] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("days_until");
  const [selectedCourse, setSelectedCourse] = useState<UpcomingCourse | null>(null);

  const { data: courses, isLoading } = useQuery({
    queryKey: ['upcoming-courses'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('v_course_points_theoriques')
        .select('*')
        .gte('date_debut', today)
        .order('date_debut', { ascending: true });
      
      if (error) throw error;
      return data as UpcomingCourse[];
    }
  });

  const { data: phases } = useQuery({
    queryKey: ['phases-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('index_dans_saison')
        .order('index_dans_saison', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  const getDaysUntil = (dateDebut: string) => {
    const today = new Date();
    const start = new Date(dateDebut);
    const diffTime = start.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredAndSortedCourses = courses
    ?.filter(course => {
      const matchesSearch = course.nom.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPhase = selectedPhase === "all" || course.phase_index?.toString() === selectedPhase;
      const matchesCategory = selectedCategory === "all" || course.categorie === selectedCategory;
      const matchesType = selectedType === "all" || course.type_course === selectedType;
      
      return matchesSearch && matchesPhase && matchesCategory && matchesType;
    })
    ?.sort((a, b) => {
      switch (sortBy) {
        case "days_until":
          return getDaysUntil(a.date_debut) - getDaysUntil(b.date_debut);
        case "points_desc":
          return (b.points_total || 0) - (a.points_total || 0);
        case "date_asc":
          return new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime();
        default:
          return 0;
      }
    });

  const categories = Array.from(new Set(courses?.map(c => c.categorie).filter(Boolean))) as string[];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <div className="flex gap-2 mt-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
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
      {/* Filters Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une course..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={selectedPhase} onValueChange={setSelectedPhase}>
              <SelectTrigger>
                <SelectValue placeholder="Phase" />
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

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="One day">Course d'un jour</SelectItem>
                <SelectItem value="Stage race">Course par étapes</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="days_until">Proximité</SelectItem>
                <SelectItem value="points_desc">Points (max)</SelectItem>
                <SelectItem value="date_asc">Date de début</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Courses Grid */}
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedCourses.map(course => {
            const daysUntil = getDaysUntil(course.date_debut);
            const daysLabel = daysUntil === 0 ? "Aujourd'hui" : `J-${daysUntil}`;
            const durationLabel = `${course.nb_jours} j`;
            const etapesLabel = course.type_course === 'Stage race' 
              ? `${course.nb_etapes_estimees} étapes` 
              : "Course d'un jour";

            return (
              <Card key={course.course_id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="space-y-2">
                    <CardTitle className="text-lg">{course.nom}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      {course.phase_index && (
                        <Badge variant="secondary">Phase {course.phase_index}</Badge>
                      )}
                      <Badge variant="outline" className="font-mono text-xs">
                        {course.categorie}
                      </Badge>
                      <Badge variant="outline">{course.type_course}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {format(new Date(course.date_debut), 'd MMM', { locale: fr })}
                        {course.date_fin && course.date_fin !== course.date_debut && (
                          <> → {format(new Date(course.date_fin), 'd MMM yyyy', { locale: fr })}</>
                        )}
                      </span>
                      <span className="text-muted-foreground">({durationLabel})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={daysUntil === 0 ? "font-bold text-primary" : "text-muted-foreground"}>
                        {daysLabel}
                      </span>
                      <span className="text-muted-foreground">• {etapesLabel}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      <div className="text-2xl font-bold text-primary">
                        {course.points_total || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">points max</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCourse(course)}
                      className="gap-1"
                    >
                      Détail
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedCourse && (
        <CourseDetailsDrawer
          course={selectedCourse}
          open={!!selectedCourse}
          onOpenChange={(open) => !open && setSelectedCourse(null)}
        />
      )}
    </div>
  );
};
