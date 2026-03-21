import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Minus, Plus } from "lucide-react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("auction");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleStartEdit = (bid: MyBid) => {
    setEditingId(bid.bid_id ?? null);
    setEditValue(bid.amount.toString());
  };

  const handleSaveEdit = (bid: MyBid) => {
    const sanitized = editValue.replace(/[^0-9]/g, '');
    const newAmount = parseInt(sanitized) || 0;
    if (newAmount >= (bid.cote || 1)) {
      onUpdateAmount(bid.bid_id, bid.coureur_id, newAmount);
    }
    setEditingId(null);
  };

  const handleSaveAndEditNext = (bid: MyBid) => {
    const sanitized = editValue.replace(/[^0-9]/g, '');
    const newAmount = parseInt(sanitized) || 0;
    if (newAmount >= (bid.cote || 1)) {
      onUpdateAmount(bid.bid_id, bid.coureur_id, newAmount);
    }
    // Find the next new bid in the sorted list
    const newBids = sortedBids.filter(b => !b.is_existing);
    const currentIndex = newBids.findIndex(b => b.bid_id === bid.bid_id || b.coureur_id === bid.coureur_id);
    const nextBid = newBids[currentIndex + 1];
    if (nextBid) {
      setEditingId(nextBid.bid_id ?? null);
      setEditValue(nextBid.amount.toString());
    } else {
      setEditingId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const handleIncrement = (bid: MyBid) => {
    const newAmount = bid.amount + step;
    onUpdateAmount(bid.bid_id!, bid.coureur_id, newAmount);
  };

  const handleDecrement = (bid: MyBid) => {
    const minAmount = bid.cote || 1;
    const newAmount = Math.max(minAmount, bid.amount - step);
    if (newAmount !== bid.amount) {
      onUpdateAmount(bid.bid_id!, bid.coureur_id, newAmount);
    }
  };

  // Existing roster first, then new bids in insertion order (last added at bottom)
  const sortedBids = useMemo(() => {
    const existingBids = bids.filter(b => b.is_existing);
    const newBids = bids.filter(b => !b.is_existing);
    return [...existingBids, ...newBids];
  }, [bids]);

  if (bids.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-muted-foreground mb-1">{t("rider.noSelected")}</p>
        <p className="text-sm text-muted-foreground">
          {t("rider.startSearch")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5 px-3">
      <h3 className="text-sm font-semibold mb-2">
        {t("myBids.count", { count: bids.length })}
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
              // Existing rider: just show amount with cote
              <div className="flex items-center gap-1">
                <span className="min-w-12 h-7 px-2 text-xs font-medium flex items-center justify-center text-muted-foreground">
                  {bid.amount}
                </span>
                {bid.cote && (
                  <span className="text-[10px] text-muted-foreground/60">
                    ({bid.cote})
                  </span>
                )}
              </div>
            ) : (
              // New bid: editable
              <>
                {editingId === bid.bid_id ? (
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value.replace(/[^0-9]/g, ''))}
                    onBlur={() => {
                      // Don't save on blur if Tab triggered handleSaveAndEditNext
                      if (editingId === bid.bid_id) handleSaveEdit(bid);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Tab") {
                        e.preventDefault();
                        handleSaveAndEditNext(bid);
                      }
                      if (e.key === "Enter") handleSaveEdit(bid);
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                    className="w-16 h-7 text-center text-xs"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center gap-0.5">
                    {/* Bouton - */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDecrement(bid)}
                      disabled={isUpdating || bid.amount <= (bid.cote || 1)}
                      className="h-7 w-7 p-0 hover:bg-muted"
                    >
                      <Minus className="h-2.5 w-2.5" />
                    </Button>
                    
                    {/* Montant cliquable pour édition manuelle */}
                    <button
                      onClick={() => handleStartEdit(bid)}
                      className="min-w-12 h-7 px-2 text-xs font-medium hover:bg-muted rounded-md transition-colors"
                    >
                      {bid.amount}
                    </button>
                    
                    {/* Bouton + */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleIncrement(bid)}
                      disabled={isUpdating}
                      className="h-7 w-7 p-0 hover:bg-muted"
                    >
                      <Plus className="h-2.5 w-2.5" />
                    </Button>
                    
                    {/* Côte */}
                    {bid.cote && (
                      <span className="text-[10px] text-muted-foreground/60 ml-0.5">
                        ({bid.cote})
                      </span>
                    )}
                  </div>
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
