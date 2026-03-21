import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { computePerCourseSettings } from "@/lib/leagues/templates";

type Course = {
  id: string;
  nom: string;
  type_course: string | null;
  categorie: string | null;
  date_debut: string | null;
  date_fin: string | null;
  pays: string | null;
};

type CourseSelectorProps = {
  seasonId: string;
  selectedCourseIds: string[];
  onSelectionChange: (ids: string[]) => void;
};

export function CourseSelector({ seasonId, selectedCourseIds, onSelectionChange }: CourseSelectorProps) {
  const { t } = useTranslation('leagues');
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses-for-league', seasonId],
    queryFn: async () => {
      // Get phase IDs for this season
      const { data: phases } = await supabase
        .from('phases')
        .select('id')
        .eq('saison_id', seasonId);
      
      if (!phases?.length) return [];

      const phaseIds = phases.map(p => p.id);

      const { data, error } = await supabase
        .from('courses')
        .select('id, nom, type_course, categorie, date_debut, date_fin, pays')
        .in('phase_id', phaseIds)
        .order('date_debut', { ascending: true });

      if (error) throw error;
      return (data || []) as Course[];
    },
    enabled: !!seasonId,
  });

  const selectedCourses = useMemo(
    () => courses.filter(c => selectedCourseIds.includes(c.id)),
    [courses, selectedCourseIds]
  );

  const settings = useMemo(
    () => computePerCourseSettings(selectedCourses),
    [selectedCourses]
  );

  const filteredCourses = useMemo(() => {
    let filtered = courses;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(c => c.nom.toLowerCase().includes(q));
    }
    if (typeFilter) {
      filtered = filtered.filter(c => c.type_course === typeFilter);
    }
    return filtered;
  }, [courses, search, typeFilter]);

  const toggleCourse = (courseId: string) => {
    if (selectedCourseIds.includes(courseId)) {
      onSelectionChange(selectedCourseIds.filter(id => id !== courseId));
    } else {
      onSelectionChange([...selectedCourseIds, courseId]);
    }
  };

  const types = useMemo(() => {
    const set = new Set(courses.map(c => c.type_course).filter(Boolean));
    return Array.from(set) as string[];
  }, [courses]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-4">{t('join.loadingLeagues', 'Chargement...')}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Selected courses summary */}
      {selectedCourseIds.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {selectedCourses.map(c => (
              <Badge key={c.id} variant="secondary" className="gap-1">
                {c.nom}
                <button onClick={() => toggleCourse(c.id)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Badge variant="default">{t('settings.budget')}: {settings.budget}</Badge>
            <Badge variant="default">{t('settings.maxRiders')}: {settings.maxRiders}</Badge>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('settings.searchCourses', 'Rechercher une course...')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          <Badge
            variant={typeFilter === null ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setTypeFilter(null)}
          >
            {t('settings.all', 'Tous')}
          </Badge>
          {types.map(type => (
            <Badge
              key={type}
              variant={typeFilter === type ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setTypeFilter(typeFilter === type ? null : type)}
            >
              {type === 'stage_race' ? t('settings.stageRace', 'Étapes') : t('settings.oneDay', '1 jour')}
            </Badge>
          ))}
        </div>
      </div>

      {/* Course list */}
      <ScrollArea className="h-[300px] border rounded-md">
        <div className="p-2 space-y-1">
          {filteredCourses.map(course => {
            const isSelected = selectedCourseIds.includes(course.id);
            return (
              <div
                key={course.id}
                className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                  isSelected ? 'bg-primary/10' : 'hover:bg-muted'
                }`}
                onClick={() => toggleCourse(course.id)}
              >
                <Checkbox checked={isSelected} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{course.nom}</p>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    {course.date_debut && <span>{course.date_debut}</span>}
                    {course.categorie && <span>• {course.categorie}</span>}
                    {course.type_course && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {course.type_course === 'stage_race' ? 'Étapes' : '1 jour'}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filteredCourses.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('settings.noCourses', 'Aucune course trouvée')}
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
