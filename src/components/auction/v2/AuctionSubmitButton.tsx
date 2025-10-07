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
} from "@/components/ui/alert-dialog";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

interface AuctionSubmitButtonProps {
  canSubmit: boolean;
  onSubmit: () => void;
  isSubmitting: boolean;
  draft_count: number;
  draft_sum: number;
  currency: string;
}

export function AuctionSubmitButton({
  canSubmit,
  onSubmit,
  isSubmitting,
  draft_count,
  draft_sum,
  currency,
}: AuctionSubmitButtonProps) {
  const [showDialog, setShowDialog] = useState(false);

  const handleClick = () => {
    if (canSubmit) {
      setShowDialog(true);
    }
  };

  const handleConfirm = () => {
    onSubmit();
    setShowDialog(false);
  };

  if (draft_count === 0) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 p-3 pb-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t shadow-lg z-50">
        <Button
          onClick={handleClick}
          disabled={!canSubmit || isSubmitting}
          className="w-full h-10"
        >
          {isSubmitting ? (
            "Validation en cours..."
          ) : canSubmit ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Valider mes enchères
            </>
          ) : (
            "Complète tes enchères"
          )}
        </Button>

        {!canSubmit && draft_count > 0 && (
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">
            Vérifie les critères ci-dessus
          </p>
        )}
      </div>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la validation</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Tu es sur le point de valider tes enchères. Une fois validées, 
                  tu ne pourras plus les modifier.
                </p>
                <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nombre d'enchères:</span>
                    <span className="font-medium">{draft_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Montant total:</span>
                    <span className="font-medium">{draft_sum}</span>
                  </div>
                </div>
                <p className="text-sm">
                  Es-tu sûr de vouloir continuer ?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Valider définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
