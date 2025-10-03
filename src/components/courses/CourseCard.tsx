import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Trophy, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { normalizeCourseType } from "@/lib/courseType";

interface CourseCardProps {
  course: {
    course_id: string;
    nom: string;
    categorie: string;
    type_course: string;
    date_debut: string;
    date_fin: string;
    phase_index: number | null;
    nb_jours: number;
    nb_etapes_estimees: number;
    points_total: number;
  };
  daysUntil: number;
  onShowDetails: () => void;
}

export const CourseCard = ({ course, daysUntil, onShowDetails }: CourseCardProps) => {
  const durationLabel = `${course.nb_jours} j`;
  const normalized = normalizeCourseType(course.type_course);
  const etapesLabel = normalized.isStage
    ? `${course.nb_etapes_estimees} étapes` 
    : "Course d'un jour";

  const countdownLabel = daysUntil === 0 ? "Aujourd'hui" : `J-${daysUntil}`;
  const countdownColor = daysUntil === 0 ? "text-primary" : "text-muted-foreground";

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-semibold text-lg flex-1">{course.nom}</h3>
          <div className="flex flex-wrap gap-2">
            {course.phase_index && (
              <Badge variant="secondary">Phase {course.phase_index}</Badge>
            )}
            <Badge variant="outline">{course.categorie}</Badge>
            <Badge variant="outline">{normalized.display}</Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {format(new Date(course.date_debut), 'dd MMM', { locale: fr })} → {format(new Date(course.date_fin), 'dd MMM yyyy', { locale: fr })}
              <span className="ml-2 text-xs">({durationLabel})</span>
            </span>
          </div>
          <div className={`font-medium ${countdownColor}`}>
            {countdownLabel}
          </div>
          <div className="text-muted-foreground">
            {etapesLabel}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <div>
              <div className="text-2xl font-bold text-primary">
                {course.points_total}
              </div>
              <div className="text-xs text-muted-foreground">points à gagner</div>
            </div>
          </div>
          
          <Button variant="ghost" size="sm" onClick={onShowDetails}>
            Détail
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
