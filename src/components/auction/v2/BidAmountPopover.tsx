import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Minus } from "lucide-react";

interface BidAmountPopoverProps {
  trigger: React.ReactNode;
  rider: {
    rider_id: string;
    rider_nom: string;
    rider_team: string;
    cote: number | null;
  };
  onSubmit: (amount: number) => void;
  remainingBudget: number;
  currency: string;
  step?: number;
  initialAmount?: number;
}

export function BidAmountPopover({
  trigger,
  rider,
  onSubmit,
  remainingBudget,
  currency,
  step = 1,
  initialAmount,
}: BidAmountPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState(initialAmount || 0);
  const [error, setError] = useState("");

  useEffect(() => {
    setAmount(initialAmount || rider.cote || step);
    setError("");
  }, [rider, initialAmount, step]);

  const minAmount = rider.cote || step;
  const simulatedRemaining = remainingBudget - amount + (initialAmount || 0);

  const handleIncrement = () => {
    setAmount((prev) => prev + step);
    setError("");
  };

  const handleDecrement = () => {
    setAmount((prev) => Math.max(minAmount, prev - step));
    setError("");
  };

  const handleAmountChange = (value: string) => {
    // Strip non-digits and convert to integer
    const sanitized = value.replace(/[^0-9]/g, '');
    const num = parseInt(sanitized) || 0;
    setAmount(num);
    setError("");
  };

  const handleSubmit = () => {
    if (amount < minAmount) {
      setError(`Le montant minimum est ${minAmount}`);
      return;
    }

    if (simulatedRemaining < 0) {
      setError("Budget insuffisant");
      return;
    }

    onSubmit(amount);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80" align="center">
        <div className="space-y-4">
          {/* Header */}
          <div>
            <h4 className="font-medium">{rider.rider_nom}</h4>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono">{rider.rider_team}</span>
              {rider.cote && <span>• {rider.cote}</span>}
            </div>
          </div>

          {/* Amount input */}
          <div className="space-y-2">
            <Label htmlFor="amount-desktop">Montant</Label>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleDecrement}
                className="h-9 w-9"
                type="button"
              >
                <Minus className="h-4 w-4" />
              </Button>

              <div className="relative flex-1">
                <Input
                  id="amount-desktop"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="text-center"
                />
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleIncrement}
                className="h-9 w-9"
                type="button"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {rider.cote && (
              <p className="text-xs text-muted-foreground">
                Min: {minAmount}
              </p>
            )}
          </div>

          {/* Budget preview */}
          <div className="text-sm space-y-1 bg-muted p-3 rounded-md">
            <div className="flex justify-between">
              <span>Budget restant</span>
              <span>{remainingBudget}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Après enchère</span>
              <span className={simulatedRemaining < 0 ? 'text-destructive' : ''}>
                {simulatedRemaining}
              </span>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1"
              disabled={!!error || amount < minAmount}
            >
              Valider
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
