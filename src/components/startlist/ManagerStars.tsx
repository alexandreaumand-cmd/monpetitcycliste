import { Star, StarHalf } from "lucide-react";

interface ManagerStarsProps {
  avgStars: number | null;
  votes?: number;
  showVotes?: boolean;
}

export function ManagerStars({ avgStars, votes = 0, showVotes = false }: ManagerStarsProps) {
  if (avgStars === null || avgStars === 0) {
    return (
      <div className="flex items-center gap-1" aria-label="Non noté">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} className="h-4 w-4 text-muted-foreground/30" />
        ))}
        <span className="text-xs text-muted-foreground ml-1">Non noté</span>
      </div>
    );
  }

  const full = Math.floor(avgStars);
  const hasHalf = avgStars - full >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  return (
    <div className="flex items-center gap-1" aria-label={`Note ${avgStars.toFixed(1)} sur 5`}>
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`full-${i}`} className="h-4 w-4 fill-yellow-400 text-bordure-gold" />
      ))}
      {hasHalf && <StarHalf className="h-4 w-4 fill-yellow-400 text-bordure-gold" />}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`empty-${i}`} className="h-4 w-4 text-muted-foreground/30" />
      ))}
      {showVotes && votes > 0 && (
        <span className="text-xs text-muted-foreground ml-1">({votes})</span>
      )}
    </div>
  );
}
