import mpcLogo from "@/assets/mpc-logo.png";

export const LoadingSpinner = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="text-center">
      <img
        src={mpcLogo}
        alt="Mon Petit Cycliste"
        width={48}
        height={48}
        className="mx-auto mb-4 animate-pulse"
        loading="eager"
      />
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  </div>
);
