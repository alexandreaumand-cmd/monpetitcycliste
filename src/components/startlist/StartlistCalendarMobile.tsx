import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Course {
  id: string;
  nom: string;
  date_debut: string;
  date_fin: string;
  categorie?: string;
  type_course?: string;
  phases?: { index_dans_saison: number };
}

interface StartlistCalendarMobileProps {
  courses: Course[];
  hasStartlist: (raceId: string) => boolean;
  isPcsValidated: (raceId: string) => boolean;
  onSelectRace: (race: Course) => void;
}

const WEEKDAYS_SHORT = ["L", "M", "M", "J", "V", "S", "D"];

export const StartlistCalendarMobile = ({
  courses,
  hasStartlist,
  isPcsValidated,
  onSelectRace,
}: StartlistCalendarMobileProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Get category priority for sorting (lower = higher priority)
  const getCategoryPriority = (course: Course): number => {
    const cat = course.categorie?.toLowerCase() || "";
    if (cat.includes("wt") || cat === "worldtour" || cat.includes(' wt ') || cat.includes(' wt') || cat.startsWith('wt ')) return 1;
    if (cat.includes("proseries") || cat.includes("pro series")) return 2;
    if (cat.includes(".1")) return 3;
    return 4;
  };

  // Group courses by day
  const coursesByDay = useMemo(() => {
    const map = new Map<string, Course[]>();
    
    courses.forEach((course) => {
      if (!course.date_debut) return;
      
      const startDate = startOfDay(new Date(course.date_debut));
      const endDate = course.date_fin ? startOfDay(new Date(course.date_fin)) : startDate;
      
      // Add course to each day of its duration
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      days.forEach((day) => {
        const key = format(day, "yyyy-MM-dd");
        const existing = map.get(key) || [];
        // Avoid duplicates
        if (!existing.find(c => c.id === course.id)) {
          existing.push(course);
        }
        map.set(key, existing);
      });
    });
    
    // Sort courses within each day by priority
    map.forEach((dayCourses, key) => {
      map.set(key, dayCourses.sort((a, b) => getCategoryPriority(a) - getCategoryPriority(b)));
    });
    
    return map;
  }, [courses]);

  // Get course color based on category
  const getCourseColor = (course: Course) => {
    const cat = course.categorie?.toLowerCase() || "";
    if (cat.includes("wt") || cat === "worldtour" || cat.includes(' wt ') || cat.includes(' wt') || cat.startsWith('wt ')) {
      return "bg-amber-500 text-white";
    }
    if (cat.includes("proseries") || cat.includes("pro series")) {
      return "bg-blue-500 text-white";
    }
    if (cat.includes(".1")) {
      return "bg-green-500 text-white";
    }
    return "bg-muted text-foreground";
  };

  // Calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Add padding for first day of month (Monday = 0)
  const firstDayOfWeek = (monthStart.getDay() + 6) % 7;
  const paddingDays = Array(firstDayOfWeek).fill(null);

  const handleDayClick = (day: Date) => {
    const key = format(day, "yyyy-MM-dd");
    const dayCourses = coursesByDay.get(key);
    if (dayCourses && dayCourses.length > 0) {
      if (dayCourses.length === 1) {
        onSelectRace(dayCourses[0]);
      } else {
        setSelectedDay(day);
        setSheetOpen(true);
      }
    }
  };

  const selectedDayCourses = selectedDay 
    ? coursesByDay.get(format(selectedDay, "yyyy-MM-dd")) || []
    : [];

  return (
    <div className="space-y-3">
      {/* Header with month navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-2">
          <h3 className="font-semibold capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: fr })}
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setCurrentMonth(new Date())}
          >
            Aujourd'hui
          </Button>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="border rounded-xl overflow-hidden bg-card">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {WEEKDAYS_SHORT.map((day, i) => (
            <div
              key={i}
              className="py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {paddingDays.map((_, i) => (
            <div key={`pad-${i}`} className="aspect-square border-b border-r last:border-r-0" />
          ))}
          
          {days.map((day, i) => {
            const key = format(day, "yyyy-MM-dd");
            const dayCourses = coursesByDay.get(key) || [];
            const hasRaces = dayCourses.length > 0;
            const hasSL = dayCourses.some(c => hasStartlist(c.id));
            const hasValidatedSL = dayCourses.some(c => isPcsValidated(c.id));

            return (
              <div
                key={key}
                className={cn(
                  "aspect-square border-b border-r p-0.5 relative cursor-pointer transition-colors",
                  !isSameMonth(day, currentMonth) && "opacity-30",
                  hasRaces && "hover:bg-muted/50",
                  isToday(day) && "bg-primary/5"
                )}
                onClick={() => handleDayClick(day)}
              >
                {/* Day number */}
                <div className={cn(
                  "text-xs font-medium mb-0.5 text-center",
                  isToday(day) && "text-primary font-bold"
                )}>
                  {format(day, "d")}
                </div>
                
                {/* Course indicators (dots) */}
                {hasRaces && (
                  <div className="flex flex-wrap justify-center gap-0.5">
                    {dayCourses.slice(0, 3).map((course, idx) => (
                      <div
                        key={course.id}
                        className={cn(
                          "w-2 h-2 rounded-full",
                          getCourseColor(course).replace('text-white', '').replace('text-foreground', '')
                        )}
                      />
                    ))}
                    {dayCourses.length > 3 && (
                      <span className="text-[8px] text-muted-foreground">+{dayCourses.length - 3}</span>
                    )}
                  </div>
                )}
                
                {/* SL validation indicator */}
                {hasValidatedSL && (
                  <div className="absolute top-0.5 right-0.5">
                    <CheckCircle2 className="h-2.5 w-2.5 text-green-600" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 justify-center text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span>WorldTour</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span>ProSeries</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>.1</span>
        </div>
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-green-600" />
          <span>SL officielle</span>
        </div>
      </div>

      {/* Bottom sheet for day with multiple courses */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[70vh]">
          <SheetHeader>
            <SheetTitle className="capitalize">
              {selectedDay && format(selectedDay, "EEEE d MMMM", { locale: fr })}
            </SheetTitle>
          </SheetHeader>
          
          <div className="mt-4 space-y-2 overflow-y-auto">
            {selectedDayCourses.map((course) => {
              const hasSL = hasStartlist(course.id);
              const isValidated = isPcsValidated(course.id);
              
              return (
                <button
                  key={course.id}
                  className="w-full text-left p-3 rounded-xl border hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setSheetOpen(false);
                    onSelectRace(course);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{course.nom}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(course.date_debut), "d MMM", { locale: fr })}
                        {course.date_fin && course.date_fin !== course.date_debut && (
                          <> - {format(new Date(course.date_fin), "d MMM", { locale: fr })}</>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {course.categorie && (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs",
                            getCourseColor(course)
                          )}
                        >
                          {course.categorie}
                        </Badge>
                      )}
                      {isValidated && (
                        <Badge className="bg-green-600 text-white text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          SL
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
