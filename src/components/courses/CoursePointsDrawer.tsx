import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, TrendingUp, Mountain, Award, Star } from "lucide-react";

interface CourseData {
  course_id: string;
  nom: string;
  categorie: string;
  type_course: string;
  nb_etapes_estimees: number;
  points_total: number;
  points_etapes: number;
  points_gc: number;
  points_pts: number;
  points_mont: number;
  points_jeune: number;
  points_etapes_unitaire: number;
}

interface CoursePointsDrawerProps {
  course: CourseData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CoursePointsDrawer = ({ course, open, onOpenChange }: CoursePointsDrawerProps) => {
  if (!course) return null;

  const pointsData = [
    {
      label: "Étapes",
      points: course.points_etapes || 0,
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      detail: course.type_course === 'Stage race' 
        ? `${course.nb_etapes_estimees} × ${course.points_etapes_unitaire} pts`
        : null
    },
    {
      label: "Classement Général",
      points: course.points_gc || 0,
      icon: Trophy,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
      detail: null
    },
    {
      label: "Points (maillot vert)",
      points: course.points_pts || 0,
      icon: Award,
      color: "text-green-600",
      bgColor: "bg-green-100",
      detail: null
    },
    {
      label: "Montagne",
      points: course.points_mont || 0,
      icon: Mountain,
      color: "text-red-600",
      bgColor: "bg-red-100",
      detail: null
    },
    {
      label: "Jeune",
      points: course.points_jeune || 0,
      icon: Star,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      detail: null
    }
  ];

  const maxPoints = Math.max(...pointsData.map(d => d.points));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">{course.nom}</SheetTitle>
          <SheetDescription>Détail des points à gagner</SheetDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="outline">{course.categorie}</Badge>
            <Badge variant="outline">{course.type_course}</Badge>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Total */}
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Points totaux</span>
              <span className="text-3xl font-bold text-primary">
                {course.points_total}
              </span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="space-y-4">
            <h3 className="font-semibold">Répartition par classement</h3>
            {pointsData.map((item, index) => {
              const Icon = item.icon;
              const percentage = maxPoints > 0 ? (item.points / maxPoints) * 100 : 0;

              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded ${item.bgColor}`}>
                        <Icon className={`h-4 w-4 ${item.color}`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{item.label}</p>
                        {item.detail && (
                          <p className="text-xs text-muted-foreground">{item.detail}</p>
                        )}
                      </div>
                    </div>
                    <span className={`font-bold ${item.color}`}>
                      {item.points}
                    </span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </div>

          {/* Note */}
          <div className="p-4 rounded-lg bg-muted text-sm text-muted-foreground">
            <p>
              <strong>Note :</strong> Le nombre d'étapes est estimé à partir des dates de course.
              Les points finaux dépendent du barème de la catégorie et des classements réellement disputés.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
