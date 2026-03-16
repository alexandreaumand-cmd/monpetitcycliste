import faviconLogo from "@/assets/logo-carré-sans-marque.png";

export const LoadingSpinner = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="text-center">
      <img
        src={faviconLogo}
        alt="La Bordure"
        width={120}
        height={120}
        className="mx-auto mb-6 animate-pulse"
        loading="eager"
      />
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  </div>
);
