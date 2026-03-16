interface BordureStripesProps {
  className?: string;
  orientation?: "vertical" | "horizontal";
}

const BordureStripes = ({ className = "", orientation = "vertical" }: BordureStripesProps) => {
  const colors = [
    "hsl(346 52% 77%)",  // Rose
    "hsl(38 66% 48%)",   // Or
    "hsl(0 0% 100%)",    // Blanc
    "hsl(147 45% 21%)",  // Vert
  ];

  if (orientation === "horizontal") {
    return (
      <div className={`flex gap-0.5 ${className}`}>
        {colors.map((color, i) => (
          <span
            key={i}
            className="block h-1 flex-1 rounded-full"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`bordure-stripes ${className}`}>
      {colors.map((color, i) => (
        <span
          key={i}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
};

export default BordureStripes;
