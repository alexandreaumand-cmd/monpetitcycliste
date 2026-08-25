import splashLogo from "@/assets/logo-carre-sans-marque.png";

export const LoadingSpinner = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(37,38%,93%)]">
      <div className="text-center max-w-sm px-4">
        <img
          src={splashLogo}
          alt="La Bordure"
          width={140}
          height={140}
          className="mx-auto mb-8"
          loading="eager"
        />
        <div className="w-10 h-10 border-4 border-bordure-gold border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  );
};
