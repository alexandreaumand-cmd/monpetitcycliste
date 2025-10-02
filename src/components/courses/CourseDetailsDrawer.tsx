import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, TrendingUp, Mountain, Star, User } from "lucide-react";

interface Course {
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

interface CourseDetailsDrawerProps {
  course: Course;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CourseDetailsDrawer = ({ course, open, onOpenChange }: CourseDetailsDrawerProps) => {
  const pointsBreakdown = [
    {
      label: "Étapes",
      value: course.points_etapes || 0,
      detail: course.type_course === 'Stage race' 
        ? `${course.nb_etapes_estimees} × ${course.points_etapes_unitaire} pts`
        : "N/A",
      icon: TrendingUp,
      color: "text-blue-600",
    },
    {
      label: "Classement Général",
      value: course.points_gc || 0,
      detail: "Maillot jaune",
      icon: Trophy,
      color: "text-yellow-600",
    },
    {
      label: "Points",
      value: course.points_pts || 0,
      detail: "Maillot vert",
      icon: Star,
      color: "text-green-600",
    },
    {
      label: "Montagne",
      value: course.points_mont || 0,
      detail: "Maillot à pois",
      icon: Mountain,
      color: "text-red-600",
    },
    {
      label: "Jeune",
      value: course.points_jeune || 0,
      detail: "Maillot blanc",
      icon: User,
      color: "text-purple-600",
    },
  ].filter(item => item.value > 0);

  const maxValue = Math.max(...pointsBreakdown.map(item => item.value));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">{course.nom}</SheetTitle>
          <SheetDescription>Détail des points</SheetDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="outline" className="font-mono text-xs">
              {course.categorie}
            </Badge>
            <Badge variant="outline">{course.type_course}</Badge>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Total */}
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="text-sm text-muted-foreground mb-1">Total des points</div>
            <div className="text-3xl font-bold text-primary">{course.points_total}</div>
          </div>

          {/* Breakdown */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Répartition par classement
            </h3>
            
            {pointsBreakdown.map((item) => {
              const Icon = item.icon;
              const percentage = (item.value / maxValue) * 100;
              
              return (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${item.color}`} />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{item.value} pts</div>
                      <div className="text-xs text-muted-foreground">{item.detail}</div>
                    </div>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </div>

          {/* Note */}
          <div className="p-4 rounded-lg bg-muted/50 text-xs text-muted-foreground">
            <p>
              <strong>Note :</strong> Le nombre d'étapes est estimé à partir des dates (jours de course). 
              Les points finaux dépendent du barème de la catégorie et des classements réellement disputés.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
