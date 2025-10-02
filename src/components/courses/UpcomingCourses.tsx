import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CourseCard } from "./CourseCard";
import { CourseDetailsDrawer } from "./CourseDetailsDrawer";
import { CoursesFilters } from "./CoursesFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "lucide-react";

export const UpcomingCourses = () => {
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("days_until");

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
      return data;
    }
  });

  const { data: phases } = useQuery({
    queryKey: ['phases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('index_dans_saison')
        .order('index_dans_saison', { ascending: true });

      if (error) throw error;
      return data;
    }
  });

  const handleShowDetails = (course: any) => {
    setSelectedCourse(course);
    setDrawerOpen(true);
  };

  // Filter and sort courses
  const filteredCourses = courses?.filter(course => {
    if (searchTerm && !course.nom.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (phaseFilter !== "all" && course.phase_index !== parseInt(phaseFilter)) {
      return false;
    }
    if (categoryFilter !== "all" && course.categorie !== categoryFilter) {
      return false;
    }
    if (typeFilter !== "all" && course.type_course !== typeFilter) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    const today = new Date();
    const aDaysUntil = Math.floor((new Date(a.date_debut).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const bDaysUntil = Math.floor((new Date(b.date_debut).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    switch (sortBy) {
      case "days_until":
        return aDaysUntil - bDaysUntil;
      case "points_total":
        return (b.points_total || 0) - (a.points_total || 0);
      case "date_debut":
        return new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime();
      case "categorie":
        return (a.categorie || "").localeCompare(b.categorie || "");
      default:
        return 0;
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (!filteredCourses || filteredCourses.length === 0) {
    return (
      <div className="space-y-4">
        <CoursesFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          phaseFilter={phaseFilter}
          onPhaseFilterChange={setPhaseFilter}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          phases={phases || []}
        />
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucune course à venir</h3>
          <p className="text-muted-foreground">
            Aucune course ne correspond aux critères sélectionnés.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CoursesFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        phaseFilter={phaseFilter}
        onPhaseFilterChange={setPhaseFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        phases={phases || []}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCourses.map((course) => {
          const today = new Date();
          const daysUntil = Math.floor(
            (new Date(course.date_debut).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );

          return (
            <CourseCard
              key={course.course_id}
              course={course}
              daysUntil={daysUntil}
              onShowDetails={() => handleShowDetails(course)}
            />
          );
        })}
      </div>

      <CourseDetailsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        course={selectedCourse}
      />
    </div>
  );
};
