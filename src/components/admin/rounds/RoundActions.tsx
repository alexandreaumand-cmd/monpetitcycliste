import { Button } from "@/components/ui/button";
import { Play, Square, RotateCcw, History } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RoundActionsProps {
  isOpen: boolean;
  canLaunch: boolean;
  canClose: boolean;
  onLaunch: (deadlineHours: number) => void;
  onClose: () => void;
  isLoading: boolean;
}

export const RoundActions = ({
  isOpen,
  canLaunch,
  canClose,
  onLaunch,
  onClose,
  isLoading
}: RoundActionsProps) => {
  const [showLaunchDialog, setShowLaunchDialog] = useState(false);
  const [deadlineHours, setDeadlineHours] = useState("24");

  const handleQuickLaunch = () => {
    onLaunch(24);
  };

  const handleCustomLaunch = () => {
    onLaunch(parseInt(deadlineHours) || 24);
    setShowLaunchDialog(false);
  };

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {canLaunch && !isOpen && (
          <>
            <Button 
              onClick={handleQuickLaunch}
              disabled={isLoading}
              size="lg"
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Lancer nouveau round (24h)
            </Button>
            <Button 
              onClick={() => setShowLaunchDialog(true)}
              disabled={isLoading}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              <History className="h-4 w-4" />
              Personnaliser
            </Button>
          </>
        )}
        
        {canClose && isOpen && (
          <Button 
            onClick={onClose}
            disabled={isLoading}
            size="lg"
            variant="destructive"
            className="gap-2"
          >
            <Square className="h-4 w-4" />
            Clôturer le round
          </Button>
        )}
      </div>

      <Dialog open={showLaunchDialog} onOpenChange={setShowLaunchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lancer un nouveau round</DialogTitle>
            <DialogDescription>
              Définissez la durée avant la deadline
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="deadline" className="text-right">
                Heures
              </Label>
              <Input
                id="deadline"
                type="number"
                value={deadlineHours}
                onChange={(e) => setDeadlineHours(e.target.value)}
                className="col-span-3"
                min="1"
                max="168"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLaunchDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCustomLaunch}>
              Lancer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
