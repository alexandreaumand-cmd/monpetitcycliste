interface FormIndicatorProps {
  results: number[];
}

export const FormIndicator = ({ results }: FormIndicatorProps) => {
  const getColorForPoints = (points: number | null) => {
    if (!points || points === 0) return "bg-gray-400";
    if (points > 0 && points <= 200) return "bg-orange-300";
    if (points > 200 && points <= 400) return "bg-yellow-300";
    if (points > 400 && points <= 600) return "bg-green-400";
    return "bg-green-800"; // > 600
  };

  const paddedResults = [...results];
  while (paddedResults.length < 5) {
    paddedResults.push(0);
  }
  const displayResults = paddedResults.slice(0, 5);

  return (
    <div 
      className="flex gap-0.5 items-center" 
      title={results.some(r => r > 0) 
        ? `Points des 5 dernières semaines: ${displayResults.map(p => p || 0).join(', ')}` 
        : 'Aucun point récent'}
    >
      {displayResults.map((points, idx) => (
        <div
          key={idx}
          className={`w-2 h-2 rounded-full ${getColorForPoints(points)}`}
        />
      ))}
    </div>
  );
};
