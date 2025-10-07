import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { useState, useMemo } from "react";

interface MyBid {
  bid_id: string;
  coureur_id: string;
  rider_nom: string;
  rider_team: string;
  cote: number | null;
  amount: number;
}

interface MyBidsListProps {
  bids: MyBid[];
  onUpdateAmount: (bid_id: string, coureur_id: string, amount: number) => void;
  onRemove: (bid_id: string) => void;
  currency: string;
  step?: number;
  isUpdating?: boolean;
}

export function MyBidsList({
  bids,
  onUpdateAmount,
  onRemove,
  currency,
  step = 1,
  isUpdating,
}: MyBidsListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleStartEdit = (bid: MyBid) => {
    setEditingId(bid.bid_id);
    setEditValue(bid.amount.toString());
  };

  const handleSaveEdit = (bid: MyBid) => {
    const newAmount = parseFloat(editValue);
    if (newAmount >= (bid.cote || 1)) {
      onUpdateAmount(bid.bid_id, bid.coureur_id, newAmount);
    }
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  // Sort bids by amount descending
  const sortedBids = useMemo(() => {
    return [...bids].sort((a, b) => b.amount - a.amount);
  }, [bids]);

  if (bids.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-muted-foreground mb-1">Aucun coureur sélectionné</p>
        <p className="text-sm text-muted-foreground">
          Commence par rechercher et ajouter des coureurs
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5 p-4">
      <h3 className="text-xs font-medium text-muted-foreground mb-2">
        Mes enchères ({bids.length})
      </h3>

      {sortedBids.map((bid) => (
        <div
          key={bid.bid_id}
          className="flex items-center justify-between py-0.5 px-2 hover:bg-muted/50 rounded-md transition-colors"
        >
          {/* Rider name */}
          <span className="font-medium text-xs flex-1 truncate pr-2">{bid.rider_nom}</span>

          {/* Amount controls */}
          <div className="flex items-center gap-1">
            {editingId === bid.bid_id ? (
              <>
                <Input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveEdit(bid);
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                  className="w-16 h-7 text-center text-xs"
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSaveEdit(bid)}
                  className="h-7 w-7 p-0 text-xs"
                >
                  ✓
                </Button>
              </>
            ) : (
              <button
                onClick={() => handleStartEdit(bid)}
                className="min-w-12 h-7 px-2 text-xs font-medium hover:bg-muted rounded-md transition-colors"
              >
                {bid.amount}
              </button>
            )}

            {/* Remove button */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRemove(bid.bid_id)}
              disabled={isUpdating}
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
