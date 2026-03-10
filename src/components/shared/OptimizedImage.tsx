import { useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
}

export const OptimizedImage = ({
  src,
  alt = "",
  className,
  fallbackSrc = "/placeholder.svg",
  loading = "lazy",
  ...props
}: OptimizedImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {!loaded && !error && (
        <div className="absolute inset-0 bg-muted animate-pulse rounded-md" />
      )}
      <img
        src={error ? fallbackSrc : src}
        alt={alt}
        loading={loading}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0"
        )}
        {...props}
      />
    </div>
  );
};
