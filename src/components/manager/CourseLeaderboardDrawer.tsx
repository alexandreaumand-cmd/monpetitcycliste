import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CourseLeaderboardDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
}

export const CourseLeaderboardDrawer = ({ open, onOpenChange, courseId }: CourseLeaderboardDrawerProps) => {
  const { toast } = useToast();
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
          course_id: courseId
        }
      });

      if (error) throw error;

      setLeaders(data.leaders || []);
    } catch (error: any) {
      console.error('Error loading leaderboard:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger le classement"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Classement managers</SheetTitle>
        </SheetHeader>

        <div className="mt-6">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : leaders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Points en attente de calcul
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaders.map((leader, idx) => (
                  <TableRow key={leader.manager_id}>
                    <TableCell className="font-medium">{idx + 1}</TableCell>
                    <TableCell>{leader.manager_nom}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {leader.total_points}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
