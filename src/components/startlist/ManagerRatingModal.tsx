import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Manager {
  manager_id: string;
  manager_nom: string;
  avg_stars: number | null;
}

interface ManagerRatingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startlistId: string;
  managers: Manager[];
  onRatingsUpdated: () => void;
}

export function ManagerRatingModal({ 
  open, 
  onOpenChange, 
  startlistId, 
  managers,
  onRatingsUpdated 
}: ManagerRatingModalProps) {
  const [ratings, setRatings] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    managers.forEach(m => {
      if (m.avg_stars) {
        initial[m.manager_id] = Math.round(m.avg_stars);
      }
    });
    return initial;
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleStarClick = (managerId: string, stars: number) => {
    setRatings(prev => ({ ...prev, [managerId]: stars }));
  };

  const handleSave = async () => {
    const ratingsArray = Object.entries(ratings)
      .filter(([_, stars]) => stars > 0)
      .map(([manager_id, stars]) => ({ manager_id, stars }));

    if (ratingsArray.length === 0) {
      toast.error("Aucune note saisie");
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.functions.invoke('rate-managers', {
        body: { startlist_id: startlistId, ratings: ratingsArray }
      });

      if (error) throw error;

      toast.success("Notes enregistrées", {
        description: `${ratingsArray.length} manager(s) noté(s)`
      });
      onRatingsUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error("Erreur lors de l'enregistrement", {
        description: error.message || "Une erreur s'est produite"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderStars = (managerId: string) => {
    const currentRating = ratings[managerId] || 0;
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            onClick={() => handleStarClick(managerId, star)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={`h-6 w-6 ${
                star <= currentRating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground/30'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Noter les managers</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {managers.map(manager => (
            <div key={manager.manager_id} className="flex items-center justify-between py-3 border-b last:border-0">
              <span className="font-medium">{manager.manager_nom}</span>
              {renderStars(manager.manager_id)}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
