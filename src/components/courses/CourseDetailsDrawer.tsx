import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Progress } from "@/components/ui/progress";

interface CourseDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: {
    nom: string;
    nb_etapes_estimees: number;
    points_etapes: number;
    points_etapes_unitaire: number;
    points_gc: number;
    points_pts: number;
    points_mont: number;
    points_jeune: number;
    points_total: number;
  } | null;
}

export const CourseDetailsDrawer = ({ open, onOpenChange, course }: CourseDetailsDrawerProps) => {
  if (!course) return null;

  const pointsBreakdown = [
    { label: "Étapes", points: course.points_etapes, detail: `${course.nb_etapes_estimees} × ${course.points_etapes_unitaire}`, color: "bg-blue-500" },
    { label: "Classement Général", points: course.points_gc, color: "bg-bordure-gold" },
    { label: "Points (maillot vert)", points: course.points_pts, color: "bg-green-500" },
    { label: "Montagne", points: course.points_mont, color: "bg-red-500" },
    { label: "Jeune", points: course.points_jeune, color: "bg-purple-500" },
  ].filter(item => item.points > 0);

  const maxPoints = Math.max(...pointsBreakdown.map(p => p.points), 1);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-2xl">
          <DrawerHeader>
            <DrawerTitle>{course.nom} — Détail des points</DrawerTitle>
            <DrawerDescription>
              Répartition des {course.points_total} points théoriques
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="p-4 pb-8 space-y-4">
            {pointsBreakdown.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <div className="font-medium">{item.label}</div>
                  <div className="text-sm text-muted-foreground">
                    {item.points} pts {item.detail && `(${item.detail})`}
                  </div>
                </div>
                <Progress 
                  value={(item.points / maxPoints) * 100} 
                  className="h-2"
                />
              </div>
            ))}
            
            <div className="mt-6 p-4 bg-muted rounded-lg text-sm text-muted-foreground">
              <strong>Note :</strong> Nombre d'étapes estimé à partir des dates (jours de course). 
              Les points finaux dépendent du barème de la catégorie et des classements réellement disputés.
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
