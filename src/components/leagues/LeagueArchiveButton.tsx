import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Archive } from "lucide-react";

type LeagueArchiveButtonProps = {
  leagueId: string;
  leagueName: string;
  onArchived: () => void;
};

export function LeagueArchiveButton({ leagueId, leagueName, onArchived }: LeagueArchiveButtonProps) {
  const [isArchiving, setIsArchiving] = useState(false);

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      const { error } = await supabase.functions.invoke('leagues-archive', {
        body: { leagueId },
      });

      if (error) throw error;

      toast.success('Ligue archivée avec succès');
      onArchived();
    } catch (error: any) {
      console.error('Error archiving league:', error);
      toast.error(error.message || 'Erreur lors de l\'archivage');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Archive className="h-4 w-4 mr-2" />
          Archiver
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archiver cette ligue ?</AlertDialogTitle>
          <AlertDialogDescription>
            Êtes-vous sûr de vouloir archiver <strong>{leagueName}</strong> ?
            <br /><br />
            La ligue restera visible pour tous les membres, mais ne sera plus active.
            Cette action peut être inversée si nécessaire.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleArchive} disabled={isArchiving}>
            {isArchiving ? 'Archivage...' : 'Archiver'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
