import { useState, useEffect } from "react";
import splashLogo from "@/assets/logo-carre-sans-marque.png";
import { getRandomQuote, type CyclingQuote } from "@/lib/cycling-quotes";

export const LoadingSpinner = () => {
  const [quote, setQuote] = useState<CyclingQuote>(getRandomQuote);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setQuote(getRandomQuote());
        setFade(true);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(37,38%,93%)]">
      <div className="text-center max-w-sm px-4">
        <img
          src={splashLogo}
          alt="La Bordure"
          width={140}
          height={140}
          className="mx-auto mb-8 animate-pulse"
          loading="eager"
        />
        <div className="w-10 h-10 border-4 border-bordure-gold border-t-transparent rounded-full animate-spin mx-auto mb-8" />
        <p
          className={`text-sm italic text-muted-foreground transition-opacity duration-400 ${fade ? "opacity-100" : "opacity-0"}`}
        >
          « {quote.text} »
          <span className="block mt-1 text-xs not-italic font-medium text-bordure-gold">
            — {quote.author}
          </span>
        </p>
      </div>
    </div>
  );
};
