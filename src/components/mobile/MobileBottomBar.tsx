import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Users, BarChart3, ListChecks, Medal, Swords, Radio } from "lucide-react";
import { useSeasonContext } from "@/contexts/SeasonContext";

interface MobileBottomBarProps {
  isAdmin: boolean;
}

export const MobileBottomBar = ({ isAdmin }: MobileBottomBarProps) => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentLeagueId = searchParams.get('leagueId');
  const queryClient = useQueryClient();
  const { selectedSeason } = useSeasonContext();

  const prefetchPageData = (path: string) => {
    if (!currentLeagueId) return;
    if (path.includes('classement')) {
      queryClient.prefetchQuery({ queryKey: ["manager-standings-mobile", null, selectedSeason?.id, currentLeagueId], staleTime: 30000 });
    } else if (path.includes('resultats')) {
      queryClient.prefetchQuery({ queryKey: ["mobile-races", currentLeagueId], staleTime: 30000 });
    } else if (path.includes('startlist')) {
      queryClient.prefetchQuery({ queryKey: ["startlists-info"], staleTime: 30000 });
    }
  };

  const mainRoutes = [
    { label: t('navigation.standings'), path: "/dashboard/classement", icon: BarChart3 },
    { label: t('navigation.teams'), path: "/dashboard/mon-equipe", icon: Users },
    { label: t('navigation.startlist'), path: "/dashboard/startlist", icon: ListChecks },
    { label: t('navigation.results'), path: "/dashboard/resultats", icon: Medal },
    { label: t('navigation.live'), path: "/dashboard/live", icon: Radio },
    { label: t('navigation.arena'), path: "/dashboard/arene", icon: Swords },
  ];

  const buildNavUrl = (path: string) => currentLeagueId ? `${path}?leagueId=${currentLeagueId}` : path;
  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-secondary/95 backdrop-blur-sm border-t border-bordure-gold/30 safe-bottom"
      role="navigation"
      aria-label={t('navigation.dashboard')}
    >
      <div className="flex items-center justify-around px-1 py-3">
        {mainRoutes.map((route) => {
          const Icon = route.icon;
          const active = isActive(route.path);

          return (
            <button
              key={route.path}
              onTouchStart={() => prefetchPageData(route.path)}
              onMouseEnter={() => prefetchPageData(route.path)}
              onClick={() => navigate(buildNavUrl(route.path))}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl touch-target transition-all",
                "active:scale-95",
                active
                  ? "bg-primary text-primary-foreground shadow-lg shadow-bordure-gold/40"
                  : "text-white/50 hover:text-bordure-gold"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-montserrat font-semibold leading-none">
                {route.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
