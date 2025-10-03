import { useEffect, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trophy } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
}

export const CourseLeaderboardDrawer = ({ open, onOpenChange, courseId }: Props) => {
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && courseId) {
      loadLeaderboard();
    }
  }, [open, courseId]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manager-results', {
        body: {
          action: 'course_leaderboard',
          course_id: courseId,
        },
      });

      if (error) throw error;

      setLeaders(data.leaders || []);
    } catch (error: any) {
      console.error('Error loading leaderboard:', error);
      toast.error(error.message || "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Classement managers sur cette course
          </DrawerTitle>
        </DrawerHeader>
        <div className="p-4">
          {loading ? (
            <p className="text-muted-foreground">Chargement...</p>
          ) : leaders.length === 0 ? (
            <p className="text-muted-foreground">Points en attente de calcul</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Rang</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaders.map((leader, idx) => (
                  <TableRow key={leader.manager_id}>
                    <TableCell className="font-bold">#{idx + 1}</TableCell>
                    <TableCell>{leader.manager_nom}</TableCell>
                    <TableCell className="text-right font-medium">
                      {leader.total_points}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
