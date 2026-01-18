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
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("auction");
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
      <div className="p-3 border-t bg-background">
        <Button
          onClick={handleClick}
          disabled={!canSubmit || isSubmitting}
          className="w-full h-10"
        >
          {isSubmitting ? (
            t("submit.validating")
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {t("submit.validate")}
            </>
          )}
        </Button>
      </div>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("submit.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>{t("submit.confirmMessage")}</p>
                <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("submit.bidsCount")}:</span>
                    <span className="font-medium">{draft_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("submit.totalAmount")}:</span>
                    <span className="font-medium">{draft_sum}</span>
                  </div>
                </div>
                <p className="text-sm">{t("submit.confirmQuestion")}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("submit.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {t("submit.confirmFinal")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
