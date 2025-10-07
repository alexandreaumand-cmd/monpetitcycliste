import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Minus, X } from "lucide-react";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();
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

  const handleQuickAdjust = (bid: MyBid, delta: number) => {
    const newAmount = bid.amount + delta;
    const minAmount = bid.cote || 1;
    if (newAmount >= minAmount) {
      onUpdateAmount(bid.bid_id, bid.coureur_id, newAmount);
    }
  };

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
    <div className={`space-y-2 ${isMobile ? 'p-3' : 'p-4'}`}>
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        Mes enchères ({bids.length})
      </h3>

      {bids.map((bid) => (
        <Card key={bid.bid_id} className="p-3">
          <div className="flex items-center gap-2">
            {/* Team badge */}
            <Badge variant="outline" className="shrink-0 font-mono text-xs">
              {bid.rider_team}
            </Badge>

            {/* Rider info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate text-sm">{bid.rider_nom}</p>
              {bid.cote && (
                <p className="text-xs text-muted-foreground">
                  Min: {bid.cote}{currency}
                </p>
              )}
            </div>

            {/* Amount controls */}
            <div className="flex items-center gap-1 shrink-0">
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
                    className="w-20 h-8 text-center text-sm"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSaveEdit(bid)}
                    className="h-8 w-8 p-0"
                  >
                    ✓
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleQuickAdjust(bid, -step)}
                    disabled={isUpdating || bid.amount <= (bid.cote || 1)}
                    className="h-8 w-8 p-0"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>

                  <button
                    onClick={() => handleStartEdit(bid)}
                    className="min-w-16 h-8 px-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
                  >
                    {bid.amount}{currency}
                  </button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleQuickAdjust(bid, step)}
                    disabled={isUpdating}
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </>
              )}

              {/* Remove button */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRemove(bid.bid_id)}
                disabled={isUpdating}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
