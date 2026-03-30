import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X, Calendar, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
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

function getCategoryGroup(categorie: string | null): string {
  if (!categorie) return 'Autres';
  const lower = categorie.toLowerCase();
  if (lower.includes('wt') || lower.includes('gt') || lower.includes('monument')) return 'WT';
  if (lower.includes('.pro')) return '.Pro';
  if (lower.includes('.1')) return '.1';
  return 'Autres';
}

export function CourseSelector({ seasonId, selectedCourseIds, onSelectionChange }: CourseSelectorProps) {
  const { t } = useTranslation('leagues');
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'date' | 'points'>('date');

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses-for-league', seasonId],
    queryFn: async () => {
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

  const { data: pointsMap = new Map() } = useQuery({
    queryKey: ['course-points-theoriques', seasonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_course_points_theoriques')
        .select('course_id, points_total')
        .eq('saison_id', seasonId);

      if (error) throw error;
      const map = new Map<string, number>();
      (data || []).forEach((row: any) => {
        map.set(row.course_id, Number(row.points_total) || 0);
      });
      return map;
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
    const today = new Date().toISOString().slice(0, 10);
    let filtered = courses.filter(c => {
      const startDate = c.date_debut;
      return startDate ? startDate > today : true;
    });
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(c => c.nom.toLowerCase().includes(q));
    }
    if (typeFilter) {
      filtered = filtered.filter(c => c.type_course === typeFilter);
    }
    if (categoryFilter) {
      filtered = filtered.filter(c => getCategoryGroup(c.categorie) === categoryFilter);
    }

    // Sort
    if (sortMode === 'points') {
      filtered = [...filtered].sort((a, b) => {
        const pa = pointsMap.get(a.id) || 0;
        const pb = pointsMap.get(b.id) || 0;
        return pb - pa;
      });
    } else {
      filtered = [...filtered].sort((a, b) => {
        const da = a.date_debut || '';
        const db = b.date_debut || '';
        return da.localeCompare(db);
      });
    }

    return filtered;
  }, [courses, search, typeFilter, categoryFilter, sortMode, pointsMap]);

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

  const categories = useMemo(() => {
    const set = new Set(courses.map(c => getCategoryGroup(c.categorie)));
    const order = ['WT', '.Pro', '.1', 'Autres'];
    return order.filter(cat => set.has(cat));
  }, [courses]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-4">{t('join.loadingLeagues', 'Chargement...')}</div>;
  }

  return (
    <div className="space-y-3">
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('settings.searchCourses', 'Rechercher une course...')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filters row 1: Type */}
      <TooltipProvider delayDuration={300}>
        <div className="flex flex-wrap gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant={typeFilter === null ? "default" : "outline"}
                className="cursor-pointer text-[11px]"
                onClick={() => setTypeFilter(null)}
              >
                {t('settings.all', 'Tous')}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="z-[100]"><p>{t('settings.filterTooltipAll')}</p></TooltipContent>
          </Tooltip>
          {types.map(type => {
            const tooltipKey = type === 'stage_race' ? 'filterTooltipStageRace' : 'filterTooltipOneDay';
            return (
              <Tooltip key={type}>
                <TooltipTrigger asChild>
                  <Badge
                    variant={typeFilter === type ? "default" : "outline"}
                    className="cursor-pointer text-[11px]"
                    onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                  >
                    {type === 'stage_race' ? t('settings.stageRace', 'Étapes') : t('settings.oneDay', '1 jour')}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="z-[100]"><p>{t(`settings.${tooltipKey}`)}</p></TooltipContent>
              </Tooltip>
            );
          })}
          <span className="w-px bg-border mx-0.5" />
          {categories.map(cat => {
            const tooltipKeyMap: Record<string, string> = { 'WT': 'filterTooltipWT', '.Pro': 'filterTooltipPro', '.1': 'filterTooltip1', 'Autres': 'filterTooltipOthers' };
            return (
              <Tooltip key={cat}>
                <TooltipTrigger asChild>
                  <Badge
                    variant={categoryFilter === cat ? "default" : "outline"}
                    className="cursor-pointer text-[11px]"
                    onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                  >
                    {cat}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="z-[100]"><p>{t(`settings.${tooltipKeyMap[cat]}`)}</p></TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Sort row */}
        <div className="flex gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant={sortMode === 'date' ? "default" : "outline"}
                className="cursor-pointer text-[11px] gap-1"
                onClick={() => setSortMode('date')}
              >
                <Calendar className="h-3 w-3" /> Date
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="z-[100]"><p>{t('settings.sortTooltipDate')}</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant={sortMode === 'points' ? "default" : "outline"}
                className="cursor-pointer text-[11px] gap-1"
                onClick={() => setSortMode('points')}
              >
                <Trophy className="h-3 w-3" /> Points
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="z-[100]"><p>{t('settings.sortTooltipPoints')}</p></TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Course list */}
      <ScrollArea className="h-[300px] border rounded-md">
        <div className="p-2 space-y-1">
          {filteredCourses.map(course => {
            const isSelected = selectedCourseIds.includes(course.id);
            const pts = pointsMap.get(course.id);
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
                {pts !== undefined && pts > 0 && (
                  <Badge className="shrink-0 text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">
                    {Math.round(pts).toLocaleString()} pts
                  </Badge>
                )}
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
