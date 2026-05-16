import { useState } from "react";
import { Loader2, Radio, Plus, Archive, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface LiveCourseLite {
  course_id: string;
  current_etape?: number | null;
  courses?: {
    nom?: string | null;
    categorie?: string | null;
    type_course?: string | null;
    date_debut?: string | null;
    date_fin?: string | null;
  } | null;
}

interface AvailableCourse {
  id: string;
  nom: string;
  categorie?: string | null;
}

interface ActiveCourseHeaderProps {
  liveCourses: LiveCourseLite[] | undefined;
  liveCoursesLoading: boolean;
  activeCourseId: string | null;
  onSelectCourse: (id: string | null) => void;
  availableCourses: AvailableCourse[] | undefined;
  selectedNewCourseId: string;
  onSelectedNewCourseIdChange: (v: string) => void;
  onActivate: () => void;
  activatePending: boolean;
  canActivate: boolean;
  onDeactivate: (id: string) => void;
  deactivatePending: boolean;
  isMultiStage: boolean;
  selectedEtape: number | null;
  onStageChange: (etape: number) => void;
}

export const ActiveCourseHeader = ({
  liveCourses,
  liveCoursesLoading,
  activeCourseId,
  onSelectCourse,
  availableCourses,
  selectedNewCourseId,
  onSelectedNewCourseIdChange,
  onActivate,
  activatePending,
  canActivate,
  onDeactivate,
  deactivatePending,
  isMultiStage,
  selectedEtape,
  onStageChange,
}: ActiveCourseHeaderProps) => {
  const activeCourse = liveCourses?.find((lc) => lc.course_id === activeCourseId);
  const [expanded, setExpanded] = useState(!activeCourseId);

  return (
    <Card>
      <CardContent className="pt-3 pb-3 space-y-2">
        {/* Active course summary row */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeCourse ? (
            <>
              <Radio className="h-4 w-4 text-primary animate-pulse shrink-0" />
              <span className="font-semibold text-sm truncate">
                {activeCourse.courses?.nom || activeCourse.course_id}
              </span>
              {activeCourse.courses?.categorie && (
                <Badge variant="outline" className="text-[10px]">
                  {activeCourse.courses.categorie}
                </Badge>
              )}
              {isMultiStage && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30">
                  <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    Étape
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={21}
                    value={selectedEtape ?? 1}
                    onChange={(e) =>
                      onStageChange(parseInt(e.target.value) || 1)
                    }
                    className="w-12 h-7 rounded border border-input bg-background px-1.5 text-sm text-center font-bold"
                  />
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-8 gap-1 text-xs"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                Gérer
              </Button>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">
              Aucune course active
            </span>
          )}
        </div>

        {(expanded || !activeCourse) && (
          <div className="space-y-2 pt-2 border-t">
            {liveCoursesLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Chargement...</span>
              </div>
            ) : liveCourses && liveCourses.length > 0 ? (
              <div className="space-y-1">
                {liveCourses.map((lc) => (
                  <div
                    key={lc.course_id}
                    className={cn(
                      "flex items-center justify-between gap-2 px-2 py-1.5 border rounded-md transition-colors cursor-pointer text-sm",
                      activeCourseId === lc.course_id
                        ? "bg-primary/10 border-primary/30"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => onSelectCourse(lc.course_id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Radio
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          activeCourseId === lc.course_id
                            ? "text-primary"
                            : "text-muted-foreground"
                        )}
                      />
                      <span className="truncate">
                        {lc.courses?.nom || lc.course_id}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          confirm(
                            `Archiver "${lc.courses?.nom || lc.course_id}" ?`
                          )
                        ) {
                          onDeactivate(lc.course_id);
                        }
                      }}
                      disabled={deactivatePending}
                      title="Archiver"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex gap-2">
              <Select
                value={selectedNewCourseId}
                onValueChange={onSelectedNewCourseIdChange}
              >
                <SelectTrigger className="flex-1 h-9 text-sm">
                  <SelectValue placeholder="Ajouter une course…" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {availableCourses?.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.nom}{" "}
                      {course.categorie ? `(${course.categorie})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={onActivate}
                disabled={!selectedNewCourseId || activatePending || !canActivate}
                className="h-9"
              >
                {activatePending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
