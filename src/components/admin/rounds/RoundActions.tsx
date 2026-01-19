import { Button } from "@/components/ui/button";
import { Play, Square, CalendarIcon } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, formatDistanceToNow, addHours } from "date-fns";
import { fr } from "date-fns/locale";

interface RoundActionsProps {
  isOpen: boolean;
  canLaunch: boolean;
  canClose: boolean;
  onLaunch: (deadlineAt: string) => void;
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
  const [deadlineDate, setDeadlineDate] = useState<Date>(addHours(new Date(), 48));

  const handleQuickLaunch = () => {
    const deadline = addHours(new Date(), 48);
    onLaunch(deadline.toISOString());
  };

  const handleCustomLaunch = () => {
    onLaunch(deadlineDate.toISOString());
    setShowLaunchDialog(false);
  };

  const updateTime = (hours?: number, minutes?: number) => {
    const newDate = new Date(deadlineDate);
    if (hours !== undefined) newDate.setHours(hours);
    if (minutes !== undefined) newDate.setMinutes(minutes);
    setDeadlineDate(newDate);
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
          Lancer nouveau round (48h)
            </Button>
            <Button 
              onClick={() => {
                setDeadlineDate(addHours(new Date(), 48));
                setShowLaunchDialog(true);
              }}
              disabled={isLoading}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              <CalendarIcon className="h-4 w-4" />
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Lancer un nouveau round</DialogTitle>
            <DialogDescription>
              Définissez la date et l'heure de clôture
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            {/* Date Picker */}
            <div className="space-y-2">
              <Label>Date de clôture</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(deadlineDate, "PPP", { locale: fr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={deadlineDate}
                    onSelect={(date) => date && setDeadlineDate(date)}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return date < today;
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Time Picker */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Heures</Label>
                <Select 
                  value={deadlineDate.getHours().toString()}
                  onValueChange={(h) => updateTime(parseInt(h), undefined)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({length: 24}, (_, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {i.toString().padStart(2, '0')}h
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Minutes</Label>
                <Select 
                  value={deadlineDate.getMinutes().toString()}
                  onValueChange={(m) => updateTime(undefined, parseInt(m))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 15, 30, 45].map(m => (
                      <SelectItem key={m} value={m.toString()}>
                        {m.toString().padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <p className="text-muted-foreground">Clôture prévue :</p>
              <p className="font-medium">
                {format(deadlineDate, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
              </p>
              <p className="text-xs text-muted-foreground">
                Dans {formatDistanceToNow(deadlineDate, { locale: fr, addSuffix: true })}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLaunchDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCustomLaunch}>
              Lancer le round
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
