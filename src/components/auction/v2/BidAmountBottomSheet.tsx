import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MobileBottomSheet } from "@/components/mobile";
import { Plus, Minus } from "lucide-react";

interface BidAmountBottomSheetProps {
  open: boolean;
  onClose: () => void;
  rider: {
    rider_id: string;
    rider_nom: string;
    rider_team: string;
    cote: number | null;
  } | null;
  onSubmit: (amount: number) => void;
  remainingBudget: number;
  currency: string;
  step?: number;
  initialAmount?: number;
}

export function BidAmountBottomSheet({
  open,
  onClose,
  rider,
  onSubmit,
  remainingBudget,
  currency,
  step = 1,
  initialAmount,
}: BidAmountBottomSheetProps) {
  const [amount, setAmount] = useState(initialAmount || 0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (rider) {
      // Set initial amount to cote or current amount
      setAmount(initialAmount || rider.cote || step);
      setError("");
    }
  }, [rider, initialAmount, step]);

  if (!rider) return null;

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
    // Validate
    if (amount < minAmount) {
      setError(`Le montant minimum est ${minAmount}`);
      return;
    }

    if (simulatedRemaining < 0) {
      setError("Budget insuffisant");
      return;
    }

    onSubmit(amount);
    onClose();
  };

  return (
    <MobileBottomSheet 
      open={open} 
      onOpenChange={onClose}
      title={rider.rider_nom}
      description={`${rider.rider_team}${rider.cote ? ` • Côte: ${rider.cote}` : ''}`}
    >
      <div className="space-y-6">

        {/* Amount input */}
        <div className="space-y-2">
          <Label htmlFor="amount">Montant de l'enchère</Label>
          <div className="flex items-center gap-2">
            <Button
              size="lg"
              variant="outline"
              onClick={handleDecrement}
              className="h-14 w-14 shrink-0"
              type="button"
            >
              <Minus className="h-5 w-5" />
            </Button>

            <div className="relative flex-1">
              <Input
                id="amount"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="h-14 text-center text-2xl font-bold"
              />
            </div>

            <Button
              size="lg"
              variant="outline"
              onClick={handleIncrement}
              className="h-14 w-14 shrink-0"
              type="button"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          {rider.cote && (
            <p className="text-sm text-muted-foreground">
              Montant minimum: {minAmount}
            </p>
          )}
        </div>

        {/* Budget preview */}
        <div className="rounded-lg bg-muted p-4 space-y-1">
          <div className="flex justify-between text-sm">
            <span>Budget restant actuel</span>
            <span className="font-medium">{remainingBudget}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Après cette enchère</span>
            <span className={`font-medium ${simulatedRemaining < 0 ? 'text-destructive' : 'text-foreground'}`}>
              {simulatedRemaining}
            </span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            size="lg"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1"
            size="lg"
            disabled={!!error || amount < minAmount}
          >
            Valider
          </Button>
        </div>
      </div>
    </MobileBottomSheet>
  );
}
