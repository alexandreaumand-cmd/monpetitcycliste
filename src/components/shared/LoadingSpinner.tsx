import { useState, useEffect } from "react";
import faviconLogo from "@/assets/logo-carre-rose.png";
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
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="text-center max-w-sm px-4">
        <img
          src={faviconLogo}
          alt="La Bordure"
          width={120}
          height={120}
          className="mx-auto mb-6 animate-pulse"
          loading="eager"
        />
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6" />
        <p
          className={`text-sm italic text-muted-foreground transition-opacity duration-400 ${fade ? "opacity-100" : "opacity-0"}`}
        >
          « {quote.text} »
          <span className="block mt-1 text-xs not-italic font-medium">
            — {quote.author}
          </span>
        </p>
      </div>
    </div>
  );
};
