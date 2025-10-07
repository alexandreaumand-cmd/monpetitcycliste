import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { useState, useMemo } from "react";

interface MyBid {
  bid_id?: string;
  coureur_id: string;
  rider_nom: string;
  rider_team: string;
  cote: number | null;
  amount: number;
  is_existing?: boolean;
  round_number?: number;
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

  // Sort bids: new bids first, then existing roster, then by amount descending
  const sortedBids = useMemo(() => {
    return [...bids].sort((a, b) => {
      // New bids (is_existing = false) come first
      if (!a.is_existing && b.is_existing) return -1;
      if (a.is_existing && !b.is_existing) return 1;
      // Within same type, sort by amount descending
      return b.amount - a.amount;
    });
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
    <div className="space-y-0.5 px-3">
      <h3 className="text-sm font-semibold mb-2">
        Mes enchères ({bids.length})
      </h3>

      {sortedBids.map((bid) => (
        <div
          key={bid.bid_id || bid.coureur_id}
          className={`flex items-center justify-between py-0.5 px-2 rounded-md transition-colors ${
            bid.is_existing ? 'opacity-60 bg-muted/30' : 'hover:bg-muted/50'
          }`}
        >
          {/* Rider name */}
          <div className="flex flex-col flex-1 truncate pr-2">
            <span className={`font-medium text-xs truncate ${bid.is_existing ? 'text-muted-foreground' : ''}`}>
              {bid.rider_nom}
            </span>
            {bid.is_existing && bid.round_number && (
              <span className="text-[10px] text-muted-foreground">Round {bid.round_number}</span>
            )}
          </div>

          {/* Amount controls */}
          <div className="flex items-center gap-1">
            {bid.is_existing ? (
              // Existing rider: just show amount
              <span className="min-w-12 h-7 px-2 text-xs font-medium flex items-center justify-center text-muted-foreground">
                {bid.amount}
              </span>
            ) : (
              // New bid: editable
              <>
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

                {/* Remove button - only for new bids */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => bid.bid_id && onRemove(bid.bid_id)}
                  disabled={isUpdating}
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
