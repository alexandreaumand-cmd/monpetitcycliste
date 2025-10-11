import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

interface Starter {
  coureur_id: string;
  nom: string;
  equipe?: string;
}

interface Manager {
  manager_id: string;
  manager_nom: string;
  avg_stars: number | null;
  starters: Starter[];
  starters_count: number;
}

interface ManagerRatingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startlistId: string;
  managers: Manager[];
  onRatingsUpdated: () => void;
  initialGlobalNote?: string;
}

export function ManagerRatingModal({ 
  open, 
  onOpenChange, 
  startlistId, 
  managers,
  onRatingsUpdated,
  initialGlobalNote 
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
  const [globalNote, setGlobalNote] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setGlobalNote(initialGlobalNote || "");
    }
  }, [initialGlobalNote, open]);

  const handleStarClick = (managerId: string, stars: number) => {
    setRatings(prev => ({ ...prev, [managerId]: stars }));
  };

  const handleSave = async () => {
    const ratingsArray = Object.entries(ratings)
      .filter(([_, stars]) => stars > 0)
      .map(([manager_id, stars]) => ({ manager_id, stars }));

    if (ratingsArray.length === 0 && !globalNote.trim()) {
      toast.error("Aucune note saisie");
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.functions.invoke('rate-managers', {
        body: { 
          startlist_id: startlistId, 
          ratings: ratingsArray,
          global_note: globalNote.trim() || null
        }
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
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Noter les managers</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-4">
          {managers.map(manager => (
            <Collapsible key={manager.manager_id} className="border rounded-lg">
              <div className="p-4">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <ChevronDown className="h-4 w-4 transition-transform ui-expanded:rotate-180" />
                      <span className="font-medium">{manager.manager_nom}</span>
                      <Badge variant="secondary">{manager.starters_count} coureur{manager.starters_count > 1 ? 's' : ''}</Badge>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      {renderStars(manager.manager_id)}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-6 mt-3 space-y-1 border-t pt-3">
                    {manager.starters.map(starter => (
                      <div key={starter.coureur_id} className="text-sm flex justify-between py-1">
                        <span>{starter.nom}</span>
                        <span className="text-muted-foreground">{starter.equipe}</span>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
        
        {/* Commentaire global */}
        <div className="border-t pt-4 mt-2">
          <label className="text-sm font-medium mb-2 block">
            Commentaire général sur la startlist (optionnel)
          </label>
          <Textarea
            value={globalNote}
            onChange={(e) => setGlobalNote(e.target.value)}
            placeholder="Ex: Excellent niveau général, belles sélections stratégiques..."
            className="min-h-[80px] resize-none"
            maxLength={500}
          />
          <span className="text-xs text-muted-foreground mt-1 block">
            {globalNote.length} / 500 caractères
          </span>
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
