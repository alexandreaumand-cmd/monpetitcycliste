interface MultiSegmentProgressProps {
  ridersPerRound: number[];
  maxSlots: number;
}

const ROUND_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-emerald-500',
];

export const MultiSegmentProgress = ({ 
  ridersPerRound, 
  maxSlots 
}: MultiSegmentProgressProps) => {
  const totalFilled = ridersPerRound.reduce((sum, count) => sum + count, 0);
  const slotsRemaining = maxSlots - totalFilled;
  const isComplete = totalFilled === maxSlots;

  // If complete, show yellow bar
  if (isComplete) {
    return (
      <div className="w-full h-1.5 rounded-full bg-yellow-500" />
    );
  }

  return (
    <div className="flex w-full h-1.5 rounded-full overflow-hidden bg-gray-800">
      {ridersPerRound.map((count, roundIndex) => {
        if (count === 0) return null;
        
        const widthPercentage = (count / maxSlots) * 100;
        const colorClass = ROUND_COLORS[roundIndex % ROUND_COLORS.length];
        
        return (
          <div 
            key={roundIndex}
            className={colorClass}
            style={{ width: `${widthPercentage}%` }}
            title={`Tour ${roundIndex + 1}: ${count} coureur${count > 1 ? 's' : ''}`}
          />
        );
      })}
      
      {slotsRemaining > 0 && (
        <div 
          className="bg-gray-800"
          style={{ width: `${(slotsRemaining / maxSlots) * 100}%` }}
        />
      )}
    </div>
  );
};
