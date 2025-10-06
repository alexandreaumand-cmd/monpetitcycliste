interface FormIndicatorProps {
  results: number[];
}

export const FormIndicator = ({ results }: FormIndicatorProps) => {
  const getColorForPosition = (position: number | null) => {
    if (!position) return "bg-gray-300";
    if (position === 1) return "bg-green-800";
    if (position <= 3) return "bg-green-600";
    if (position <= 5) return "bg-green-400";
    if (position <= 10) return "bg-yellow-300";
    if (position <= 15) return "bg-orange-300";
    return "bg-red-500";
  };

  const paddedResults = [...results];
  while (paddedResults.length < 5) {
    paddedResults.push(null as any);
  }
  const displayResults = paddedResults.slice(0, 5);

  return (
    <div 
      className="flex gap-0.5 items-center" 
      title={results.length > 0 ? `Derniers résultats: ${results.join(', ')}` : 'Aucun résultat récent'}
    >
      {displayResults.map((position, idx) => (
        <div
          key={idx}
          className={`w-2 h-2 rounded-full ${getColorForPosition(position)}`}
        />
      ))}
    </div>
  );
};
