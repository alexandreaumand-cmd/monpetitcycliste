import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Target, Loader2, Zap, Lock, Unlock, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { format, addDays, differenceInCalendarDays, isPast } from "date-fns";
import { fr } from "date-fns/locale";

interface PotentialDeadline {
  courseId: string;
  courseName: string;
  courseCategorie: string | null;
  pronosticType: string;
  etapeNumero: number | null;
  defaultDeadlineAt: string; // ISO string
  courseTypeLabel: string;
}

interface ExistingDeadline {
  id: string;
  course_id: string;
  etape_numero: number | null;
  pronostic_type: string;
  deadline_at: string;
  reminder_sent_at: string | null;
  courses?: { nom: string; categorie: string | null };
}

const isStageRace = (typeRace: string | null) => {
  if (!typeRace) return false;
  const lower = typeRace.toLowerCase();
  return lower.includes("stage") || lower.includes("etape") || lower.includes("étape");
};

const TYPE_LABELS: Record<string, string> = {
  one_day_winner: "Vainqueur",
  gc_winner: "CG",
  stage_winner: "Étape",
};

export const PronosticDeadlinesManager = () => {
  const { t } = useTranslation("arena");
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deadlineOverrides, setDeadlineOverrides] = useState<Record<string, string>>({});
  const [tttOverrides, setTttOverrides] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [evaluating, setEvaluating] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch upcoming courses
  const { data: courses } = useQuery({
    queryKey: ["admin-upcoming-courses"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("courses")
        .select("id, nom, categorie, type_course, date_debut, date_fin")
        .or(`date_fin.gte.${today},date_debut.gte.${today}`)
        .order("date_debut", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing deadlines
  const { data: deadlines, isLoading: deadlinesLoading } = useQuery({
    queryKey: ["admin-pronostic-deadlines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("arena_pronostic_deadlines")
        .select("id, course_id, etape_numero, pronostic_type, deadline_at, reminder_sent_at, courses(nom, categorie)")
        .order("deadline_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ExistingDeadline[];
    },
  });

  // Build a set of existing deadline keys for quick lookup
  const existingKeys = useMemo(() => {
    const keys = new Set<string>();
    deadlines?.forEach((d) => {
      keys.add(`${d.course_id}|${d.pronostic_type}|${d.etape_numero ?? "null"}`);
    });
    return keys;
  }, [deadlines]);

  // Generate all potential deadlines from the calendar
  const potentialDeadlines = useMemo(() => {
    if (!courses) return [];
    const result: PotentialDeadline[] = [];

    for (const course of courses) {
      if (isStageRace(course.type_course)) {
        const dateDebut = new Date(course.date_debut + "T00:00:00");
        const dateFin = new Date(course.date_fin + "T00:00:00");
        const nbEtapes = differenceInCalendarDays(dateFin, dateDebut) + 1;

        // GC Winner
        result.push({
          courseId: course.id,
          courseName: course.nom,
          courseCategorie: course.categorie,
          pronosticType: "gc_winner",
          etapeNumero: null,
          defaultDeadlineAt: new Date(course.date_debut + "T12:00:00").toISOString(),
          courseTypeLabel: "CG",
        });

        // Each stage
        for (let i = 1; i <= nbEtapes; i++) {
          const stageDate = addDays(dateDebut, i - 1);
          const year = stageDate.getFullYear();
          const month = String(stageDate.getMonth() + 1).padStart(2, "0");
          const day = String(stageDate.getDate()).padStart(2, "0");
          result.push({
            courseId: course.id,
            courseName: course.nom,
            courseCategorie: course.categorie,
            pronosticType: "stage_winner",
            etapeNumero: i,
            defaultDeadlineAt: new Date(`${year}-${month}-${day}T12:00:00`).toISOString(),
            courseTypeLabel: `Étape ${i}`,
          });
        }
      } else {
        // One-day race
        result.push({
          courseId: course.id,
          courseName: course.nom,
          courseCategorie: course.categorie,
          pronosticType: "one_day_winner",
          etapeNumero: null,
          defaultDeadlineAt: new Date(course.date_debut + "T12:00:00").toISOString(),
          courseTypeLabel: "Vainqueur",
        });
      }
    }

    return result;
  }, [courses]);

  // Group potential deadlines by course
  const groupedByCourse = useMemo(() => {
    const map = new Map<string, { courseName: string; categorie: string | null; items: PotentialDeadline[] }>();
    for (const pd of potentialDeadlines) {
      if (!map.has(pd.courseId)) {
        map.set(pd.courseId, { courseName: pd.courseName, categorie: pd.courseCategorie, items: [] });
      }
      map.get(pd.courseId)!.items.push(pd);
    }
    return map;
  }, [potentialDeadlines]);

  const getKey = (pd: PotentialDeadline) =>
    `${pd.courseId}|${pd.pronosticType}|${pd.etapeNumero ?? "null"}`;

  const isOpened = (pd: PotentialDeadline) => existingKeys.has(getKey(pd));

  // Get the effective deadline date (override or default)
  const getEffectiveDeadline = (pd: PotentialDeadline) => {
    const key = getKey(pd);
    return deadlineOverrides[key] || pd.defaultDeadlineAt;
  };

  // Parse ISO to date input value (YYYY-MM-DD)
  const toDateInput = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // Parse ISO to time input value (HH:MM)
  const toTimeInput = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // Update deadline override from date/time inputs
  const updateDeadlineDate = (key: string, currentIso: string, newDate: string) => {
    const time = toTimeInput(currentIso);
    setDeadlineOverrides((prev) => ({ ...prev, [key]: new Date(`${newDate}T${time}:00`).toISOString() }));
  };

  const updateDeadlineTime = (key: string, currentIso: string, newTime: string) => {
    const date = toDateInput(currentIso);
    setDeadlineOverrides((prev) => ({ ...prev, [key]: new Date(`${date}T${newTime}:00`).toISOString() }));
  };

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCourseExpand = (courseId: string) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  // Select all unopened deadlines for a course
  const toggleSelectCourse = (courseId: string) => {
    const group = groupedByCourse.get(courseId);
    if (!group) return;
    const unopenedKeys = group.items.filter((pd) => !isOpened(pd)).map(getKey);
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = unopenedKeys.every((k) => next.has(k));
      if (allSelected) {
        unopenedKeys.forEach((k) => next.delete(k));
      } else {
        unopenedKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  // Bulk open selected deadlines
  const handleBulkOpen = async () => {
    if (selected.size === 0) return;
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: manager } = await supabase
        .from("managers")
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (!manager?.id) throw new Error("Profil manager non trouvé");

      const toInsert = potentialDeadlines
        .filter((pd) => selected.has(getKey(pd)))
        .map((pd) => ({
          course_id: pd.courseId,
          etape_numero: pd.etapeNumero,
          pronostic_type: pd.pronosticType,
          deadline_at: getEffectiveDeadline(pd),
          created_by: manager.id,
        }));

      if (toInsert.length === 0) return;

      const { error } = await supabase.from("arena_pronostic_deadlines").insert(toInsert);
      if (error) {
        if (error.code === "23505") {
          toast.error(t("admin.deadlines.duplicateError"));
        } else {
          throw error;
        }
        return;
      }

      toast.success(t("admin.deadlines.bulkSuccess", { count: toInsert.length }));
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-pronostic-deadlines"] });
      queryClient.invalidateQueries({ queryKey: ["arena-pronostic-deadlines"] });
    } catch (error: any) {
      toast.error(error.message || "Erreur");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase
        .from("arena_pronostic_deadlines")
        .delete()
        .eq("id", deleteId);
      if (error) throw error;
      toast.success(t("admin.deadlines.deleted"));
      queryClient.invalidateQueries({ queryKey: ["admin-pronostic-deadlines"] });
      queryClient.invalidateQueries({ queryKey: ["arena-pronostic-deadlines"] });
    } catch (error: any) {
      toast.error(error.message || "Erreur");
    } finally {
      setDeleteId(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleEvaluate = async (deadline: ExistingDeadline) => {
    setEvaluating(deadline.id);
    try {
      const { data, error } = await supabase.functions.invoke("arena-evaluate-pronostics", {
        body: {
          course_id: deadline.course_id,
          etape_numero: deadline.etape_numero,
          pronostic_type: deadline.pronostic_type,
        },
      });
      if (error) throw error;
      toast.success(`Évaluation : ${data.correct_count} correct(s), ${data.incorrect_count} incorrect(s)`);
      queryClient.invalidateQueries({ queryKey: ["arena-my-pronostics"] });
      queryClient.invalidateQueries({ queryKey: ["arena-pronostic-standings"] });
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'évaluation");
    } finally {
      setEvaluating(null);
    }
  };

  // Find existing deadline for a potential deadline
  const getExistingDeadline = (pd: PotentialDeadline) => {
    return deadlines?.find(
      (d) =>
        d.course_id === pd.courseId &&
        d.pronostic_type === pd.pronosticType &&
        d.etape_numero === pd.etapeNumero
    );
  };

  const selectedCount = selected.size;

  return (
    <div className="space-y-6">
      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg backdrop-blur">
          <span className="text-sm font-medium">
            {t("admin.deadlines.selectedCount", { count: selectedCount })}
          </span>
          <Button onClick={handleBulkOpen} disabled={isSubmitting} size="sm">
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Unlock className="h-4 w-4 mr-2" />
            )}
            {t("admin.deadlines.openSelected")}
          </Button>
        </div>
      )}

      {/* Calendar-based deadline list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {t("admin.deadlines.calendarTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {deadlinesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-1">
              {Array.from(groupedByCourse.entries()).map(([courseId, group]) => {
                const isExpanded = expandedCourses.has(courseId);
                const allItems = group.items;
                const unopenedItems = allItems.filter((pd) => !isOpened(pd));
                const openedCount = allItems.length - unopenedItems.length;
                const allCourseSelected = unopenedItems.length > 0 && unopenedItems.every((pd) => selected.has(getKey(pd)));
                const someCourseSelected = unopenedItems.some((pd) => selected.has(getKey(pd)));
                const isMultiStage = allItems.length > 1;

                return (
                  <div key={courseId} className="border rounded-lg overflow-hidden">
                    {/* Course header row */}
                    <div
                      className="flex flex-wrap items-center gap-1.5 sm:gap-2 px-3 py-2.5 bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => isMultiStage ? toggleCourseExpand(courseId) : undefined}
                    >
                      {/* Checkbox for selecting all unopened items of this course */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={allCourseSelected}
                          // @ts-ignore
                          indeterminate={someCourseSelected && !allCourseSelected}
                          onCheckedChange={() => {
                            if (!isMultiStage) {
                              // For one-day races, just toggle the single item
                              const key = getKey(allItems[0]);
                              if (!isOpened(allItems[0])) toggleSelect(key);
                            } else {
                              toggleSelectCourse(courseId);
                            }
                          }}
                          disabled={unopenedItems.length === 0}
                        />
                      </div>

                      {/* Expand/collapse for multi-stage */}
                      {isMultiStage ? (
                        isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )
                      ) : (
                        <div className="w-4 shrink-0" />
                      )}

                      <span className="font-medium text-sm flex-1 truncate min-w-[100px]">{group.courseName}</span>
                      {group.categorie && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {group.categorie}
                        </Badge>
                      )}

                      {/* Status badge */}
                      {openedCount === allItems.length ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 text-xs shrink-0">
                          <Unlock className="h-3 w-3 mr-1" />
                          {allItems.length > 1 ? `${openedCount}/${allItems.length}` : t("admin.deadlines.opened")}
                        </Badge>
                      ) : openedCount > 0 ? (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {openedCount}/{allItems.length}
                        </Badge>
                      ) : null}

                      {/* For one-day races, show info on a new row on mobile */}
                      {!isMultiStage && (
                        <div className="w-full sm:w-auto sm:flex-none mt-1.5 sm:mt-0 pl-8 sm:pl-0">
                          <OneLineDeadlineInfo
                            pd={allItems[0]}
                            existing={getExistingDeadline(allItems[0])}
                            effectiveDeadline={getEffectiveDeadline(allItems[0])}
                            onDateChange={(date) => updateDeadlineDate(getKey(allItems[0]), getEffectiveDeadline(allItems[0]), date)}
                            onTimeChange={(time) => updateDeadlineTime(getKey(allItems[0]), getEffectiveDeadline(allItems[0]), time)}
                            toDateInput={toDateInput}
                            toTimeInput={toTimeInput}
                            onEvaluate={() => {
                              const ex = getExistingDeadline(allItems[0]);
                              if (ex) handleEvaluate(ex);
                            }}
                            onDelete={() => {
                              const ex = getExistingDeadline(allItems[0]);
                              if (ex) {
                                setDeleteId(ex.id);
                                setDeleteDialogOpen(true);
                              }
                            }}
                            evaluating={evaluating}
                          />
                        </div>
                      )}
                    </div>

                    {/* Expanded stage rows */}
                    {isMultiStage && isExpanded && (
                      <div className="divide-y">
                        {allItems.map((pd) => {
                          const key = getKey(pd);
                          const opened = isOpened(pd);
                          const existing = getExistingDeadline(pd);
                          const expired = existing ? isPast(new Date(existing.deadline_at)) : false;

                          return (
                            <div
                              key={key}
                              className={`flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 px-3 py-2.5 sm:py-2 pl-8 sm:pl-10 text-sm transition-colors ${
                                opened
                                  ? "bg-green-50/50 dark:bg-green-950/10"
                                  : "hover:bg-muted/20"
                              }`}
                            >
                              {/* Top row: checkbox + label + status */}
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                <div onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={selected.has(key)}
                                    onCheckedChange={() => toggleSelect(key)}
                                    disabled={opened}
                                  />
                                </div>

                                <span className="font-medium w-20 shrink-0">
                                  {pd.courseTypeLabel}
                                </span>

                                <div className="flex-1" />

                                {opened ? (
                                  <div className="flex items-center gap-1 sm:hidden">
                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 text-xs">
                                      <Unlock className="h-3 w-3 mr-1" />
                                      {t("admin.deadlines.opened")}
                                    </Badge>
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-xs sm:hidden">
                                    <Lock className="h-3 w-3 mr-1" />
                                    {t("admin.deadlines.notOpened")}
                                  </Badge>
                                )}
                              </div>

                              {/* Bottom row: date/time inputs or deadline info + actions */}
                              <div className="flex items-center gap-1.5 pl-7 sm:pl-0 sm:flex-1">
                                {!opened && (
                                  <div className="flex items-center gap-1.5 flex-1" onClick={(e) => e.stopPropagation()}>
                                    <Input
                                      type="date"
                                      value={toDateInput(getEffectiveDeadline(pd))}
                                      onChange={(e) => updateDeadlineDate(key, getEffectiveDeadline(pd), e.target.value)}
                                      className="h-7 text-xs flex-1 sm:w-[130px] sm:flex-none px-1.5"
                                    />
                                    <Input
                                      type="time"
                                      value={toTimeInput(getEffectiveDeadline(pd))}
                                      onChange={(e) => updateDeadlineTime(key, getEffectiveDeadline(pd), e.target.value)}
                                      className="h-7 text-xs w-[80px] sm:w-[85px] px-1.5"
                                    />
                                  </div>
                                )}
                                {opened && (
                                  <span className="text-muted-foreground text-xs flex-1">
                                    {format(new Date(existing!.deadline_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                                  </span>
                                )}

                                {/* Desktop status badge */}
                                {opened ? (
                                  <div className="hidden sm:flex items-center gap-1">
                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 text-xs">
                                      <Unlock className="h-3 w-3 mr-1" />
                                      {t("admin.deadlines.opened")}
                                    </Badge>
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-xs hidden sm:flex">
                                    <Lock className="h-3 w-3 mr-1" />
                                    {t("admin.deadlines.notOpened")}
                                  </Badge>
                                )}

                                {/* Action buttons - always visible */}
                                {opened && expired && existing && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => handleEvaluate(existing)}
                                    disabled={evaluating === existing.id}
                                  >
                                    {evaluating === existing.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Zap className="h-3 w-3" />
                                    )}
                                    <span className="ml-1">Évaluer</span>
                                  </Button>
                                )}
                                {opened && existing && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7"
                                    onClick={() => {
                                      setDeleteId(existing.id);
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.deadlines.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.deadlines.deleteDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.deadlines.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {t("admin.deadlines.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Inline info for one-day races
const OneLineDeadlineInfo = ({
  pd,
  existing,
  effectiveDeadline,
  onDateChange,
  onTimeChange,
  toDateInput,
  toTimeInput,
  onEvaluate,
  onDelete,
  evaluating,
}: {
  pd: PotentialDeadline;
  existing: ExistingDeadline | undefined;
  effectiveDeadline: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  toDateInput: (iso: string) => string;
  toTimeInput: (iso: string) => string;
  onEvaluate: () => void;
  onDelete: () => void;
  evaluating: string | null;
}) => {
  const { t } = useTranslation("arena");
  const opened = !!existing;
  const expired = existing ? isPast(new Date(existing.deadline_at)) : false;

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {!opened ? (
        <>
          <Input
            type="date"
            value={toDateInput(effectiveDeadline)}
            onChange={(e) => onDateChange(e.target.value)}
            className="h-7 text-xs flex-1 sm:w-[130px] sm:flex-none px-1.5"
          />
          <Input
            type="time"
            value={toTimeInput(effectiveDeadline)}
            onChange={(e) => onTimeChange(e.target.value)}
            className="h-7 text-xs w-[80px] sm:w-[85px] px-1.5"
          />
        </>
      ) : (
        <>
          <span className="text-xs text-muted-foreground">
            {format(new Date(existing.deadline_at), "dd/MM HH:mm", { locale: fr })}
          </span>
          {expired && existing && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={onEvaluate}
              disabled={evaluating === existing.id}
            >
              {evaluating === existing.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </>
      )}
    </div>
  );
};
