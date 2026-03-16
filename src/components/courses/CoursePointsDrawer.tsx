import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, TrendingUp, Mountain, Award, Star } from "lucide-react";
import { isStageRace } from "@/lib/courseType";
import { PointsBaremeSection } from "./PointsBaremeSection";

type TypeClassement = "Etape" | "General" | "Points" | "Montagne" | "Jeune";

interface CourseData {
  course_id: string;
  nom: string;
  categorie: string;
  categorie_for_points: string;
  type_course: string;
  nb_etapes_estimees: number;
  points_total: number;
  points_etapes: number;
  points_gc: number;
  points_pts: number;
  points_mont: number;
  points_jeune: number;
  points_etapes_unitaire: number;
  is_uwt: boolean;
  wt_tier: string | null;
}

interface CoursePointsDrawerProps {
  course: CourseData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CoursePointsDrawer = ({ course, open, onOpenChange }: CoursePointsDrawerProps) => {
  if (!course) return null;

  const pointsData: {
    label: string;
    points: number;
    icon: typeof TrendingUp;
    color: string;
    bgColor: string;
    detail: string | null;
    typeClassement: TypeClassement;
  }[] = [
    {
      label: "Étapes",
      points: course.points_etapes || 0,
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      detail: isStageRace(course.type_course)
        ? `${course.nb_etapes_estimees} × ${course.points_etapes_unitaire} pts`
        : null,
      typeClassement: "Etape"
    },
    {
      label: "Classement Général",
      points: course.points_gc || 0,
      icon: Trophy,
      color: "text-bordure-gold",
      bgColor: "bg-yellow-100",
      detail: null,
      typeClassement: "General"
    },
    {
      label: "Points (maillot vert)",
      points: course.points_pts || 0,
      icon: Award,
      color: "text-green-600",
      bgColor: "bg-green-100",
      detail: null,
      typeClassement: "Points"
    },
    {
      label: "Montagne",
      points: course.points_mont || 0,
      icon: Mountain,
      color: "text-bordure-pink",
      bgColor: "bg-bordure-pink/20",
      detail: null,
      typeClassement: "Montagne"
    },
    {
      label: "Jeune",
      points: course.points_jeune || 0,
      icon: Star,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      detail: null,
      typeClassement: "Jeune"
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
            {course.categorie_for_points !== course.categorie && (
              <Badge variant="secondary">{course.categorie_for_points}</Badge>
            )}
            <Badge variant="outline">{course.type_course}</Badge>
            {course.is_uwt && course.points_total === 0 && (
              <Badge variant="destructive" className="gap-1">
                ⚠️ Config UWT manquante
              </Badge>
            )}
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
                  <PointsBaremeSection 
                    courseId={course.course_id} 
                    typeClassement={item.typeClassement} 
                  />
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
            {course.is_uwt && course.points_total === 0 && (
              <p className="mt-2 text-destructive font-medium">
                ⚠️ Cette course UWT nécessite une configuration du champ <code>wt_tier</code> dans la table courses pour calculer les points.
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
