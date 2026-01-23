import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isToday, getDay } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Course {
  id: string;
  nom: string;
  date_debut: string;
  date_fin: string;
  categorie?: string;
  type_course?: string;
  phases?: { index_dans_saison: number };
}

interface StartlistCalendarViewProps {
  courses: Course[];
  hasStartlist: (raceId: string) => boolean;
  isPcsValidated: (raceId: string) => boolean;
  onSelectRace: (race: Course) => void;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export const StartlistCalendarView = ({ 
  courses, 
  hasStartlist, 
  isPcsValidated, 
  onSelectRace 
}: StartlistCalendarViewProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get the day of week for the first day (0 = Sunday, adjust for Monday start)
  const startDayOfWeek = getDay(monthStart);
  // Adjust for Monday start (Monday = 0, Sunday = 6)
  const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  // Create padding for days before the month starts
  const paddingDays = Array(adjustedStartDay).fill(null);

  // Get category priority for sorting (lower = higher priority)
  const getCategoryPriority = (course: Course): number => {
    const cat = course.categorie?.toLowerCase() || '';
    // WorldTour: matches .uwt patterns OR contains "wt" (e.g., "Classiques WT Cat 2")
    if (cat.includes('.uwt') || cat.includes(' wt ') || cat.includes(' wt') || cat.startsWith('wt ')) return 1;
    if (cat.includes('.pro') || cat.includes('proseries')) return 2; // ProSeries second
    if (cat.includes('.1')) return 3; // .1 third
    return 4; // Others last
  };

  // Map courses to days
  const coursesByDay = useMemo(() => {
    const map = new Map<string, Course[]>();
    
    courses.forEach(course => {
      // Parse dates and normalize to start of day for proper comparison
      const startDate = new Date(course.date_debut + 'T00:00:00');
      const endDate = new Date(course.date_fin + 'T23:59:59');
      
      // Add course to each day it spans
      daysInMonth.forEach(day => {
        // Normalize the day for comparison
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        const courseStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const courseEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        
        if (dayStart >= courseStart && dayStart <= courseEnd) {
          const key = format(day, 'yyyy-MM-dd');
          const existing = map.get(key) || [];
          // Avoid duplicates
          if (!existing.find(c => c.id === course.id)) {
            map.set(key, [...existing, course]);
          }
        }
      });
    });
    
    // Sort courses by category priority for each day
    map.forEach((dayCourses, key) => {
      map.set(key, dayCourses.sort((a, b) => getCategoryPriority(a) - getCategoryPriority(b)));
    });
    
    return map;
  }, [courses, daysInMonth]);

  const navigatePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const navigateNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const getCourseColor = (course: Course) => {
    // Color based on category - using gold/amber for WorldTour matching the legend
    const cat = course.categorie?.toLowerCase() || '';
    // WorldTour: matches .uwt patterns OR contains "wt" (e.g., "Classiques WT Cat 2")
    if (cat.includes('.uwt') || cat.includes(' wt ') || cat.includes(' wt') || cat.startsWith('wt ')) return 'bg-amber-400/30 border-amber-500 text-amber-900 dark:text-amber-100';
    if (cat.includes('.pro') || cat.includes('proseries')) return 'bg-sky-400/30 border-sky-500 text-sky-900 dark:text-sky-100';
    if (cat.includes('.1')) return 'bg-emerald-400/30 border-emerald-500 text-emerald-900 dark:text-emerald-100';
    return 'bg-muted border-border text-muted-foreground';
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={navigatePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-bold min-w-[180px] text-center capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: fr })}
            </h2>
            <Button variant="outline" size="icon" onClick={navigateNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Aujourd'hui
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Padding cells */}
          {paddingDays.map((_, index) => (
            <div key={`pad-${index}`} className="min-h-[100px] bg-muted/30 rounded-md" />
          ))}
          
          {/* Day cells */}
          {daysInMonth.map(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayCourses = coursesByDay.get(dayKey) || [];
            const isDayToday = isToday(day);

            return (
              <div
                key={dayKey}
                className={cn(
                  "min-h-[100px] border rounded-md p-1 transition-colors",
                  isDayToday && "border-primary border-2 bg-primary/5",
                  !isDayToday && "border-border hover:border-muted-foreground/50"
                )}
              >
                <div className={cn(
                  "text-sm font-medium mb-1 text-right pr-1",
                  isDayToday && "text-primary font-bold",
                  !isDayToday && "text-muted-foreground"
                )}>
                  {format(day, 'd')}
                </div>
                
                <div className="space-y-0.5 overflow-hidden">
                  {dayCourses.slice(0, 3).map(course => {
                    const hasStartlistBadge = hasStartlist(course.id);
                    const isValidated = isPcsValidated(course.id);

                    return (
                      <div
                        key={course.id}
                        onClick={() => onSelectRace(course)}
                        className={cn(
                          "text-xs px-1 py-0.5 rounded border cursor-pointer truncate flex items-center gap-1",
                          getCourseColor(course),
                          "hover:opacity-80 transition-opacity"
                        )}
                        title={`${course.nom} (${course.categorie})`}
                      >
                        {hasStartlistBadge && (
                          <CheckCircle2 className={cn(
                            "h-3 w-3 shrink-0",
                            isValidated ? "text-primary" : "text-muted-foreground"
                          )} />
                        )}
                        <span className="truncate">
                          {course.nom}
                        </span>
                      </div>
                    );
                  })}
                  {dayCourses.length > 3 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-xs text-muted-foreground text-center w-full hover:text-foreground hover:underline transition-colors cursor-pointer">
                          +{dayCourses.length - 3} autres
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-2" align="start">
                        <div className="text-sm font-medium mb-2">
                          {format(day, 'd MMMM yyyy', { locale: fr })}
                        </div>
                        <div className="space-y-1 max-h-60 overflow-y-auto">
                          {dayCourses.map(course => {
                            const hasStartlistBadge = hasStartlist(course.id);
                            const isValidated = isPcsValidated(course.id);
                            return (
                              <div
                                key={course.id}
                                onClick={() => onSelectRace(course)}
                                className={cn(
                                  "text-xs px-2 py-1.5 rounded border cursor-pointer flex items-center gap-1",
                                  getCourseColor(course),
                                  "hover:opacity-80 transition-opacity"
                                )}
                              >
                                {hasStartlistBadge && (
                                  <CheckCircle2 className={cn(
                                    "h-3 w-3 shrink-0",
                                    isValidated ? "text-primary" : "text-muted-foreground"
                                  )} />
                                )}
                                <span className="truncate">{course.nom}</span>
                              </div>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/50" />
            <span>WorldTour</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-sky-500/20 border border-sky-500/50" />
            <span>ProSeries</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/50" />
            <span>.1</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-primary" />
            <span>SL validée</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
            <span>SL disponible</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
