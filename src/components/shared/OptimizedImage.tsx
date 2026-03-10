import { useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  /** If true, renders without wrapper div (for inline layouts) */
  inline?: boolean;
}

export const OptimizedImage = ({
  src,
  alt = "",
  className,
  fallbackSrc = "/placeholder.svg",
  loading = "lazy",
  inline = false,
  width,
  height,
  ...props
}: OptimizedImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const imgElement = (
    <img
      src={error ? fallbackSrc : src}
      alt={alt}
      loading={loading}
      width={width}
      height={height}
      onLoad={() => setLoaded(true)}
      onError={() => setError(true)}
      className={cn(
        inline
          ? className
          : "w-full h-full object-cover transition-opacity duration-300",
        !inline && (loaded ? "opacity-100" : "opacity-0"),
        inline && !loaded && "animate-pulse",
        className && inline ? className : undefined
      )}
      {...props}
    />
  );

  if (inline) return imgElement;

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {!loaded && !error && (
        <div className="absolute inset-0 bg-muted animate-pulse rounded-md" />
      )}
      {imgElement}
    </div>
  );
};
