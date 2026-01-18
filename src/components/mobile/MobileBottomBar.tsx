import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Users, BarChart3, ListChecks, Medal, Calendar } from "lucide-react";

interface MobileBottomBarProps {
  isAdmin: boolean;
}

export const MobileBottomBar = ({ isAdmin }: MobileBottomBarProps) => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentLeagueId = searchParams.get('leagueId');

  const mainRoutes = [
    { label: t('navigation.standings'), path: "/dashboard/classement", icon: BarChart3 },
    { label: t('navigation.teams'), path: "/dashboard/mon-equipe", icon: Users },
    { label: t('navigation.startlist'), path: "/dashboard/startlist", icon: ListChecks },
    { label: t('navigation.results'), path: "/dashboard/resultats", icon: Medal },
    { label: t('navigation.races'), path: "/dashboard/courses", icon: Calendar },
  ];

  const buildNavUrl = (path: string) => {
    return currentLeagueId ? `${path}?leagueId=${currentLeagueId}` : path;
  };

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-t border-yellow-500/30 safe-bottom"
      role="navigation"
      aria-label={t('navigation.dashboard')}
    >
      <div className="flex items-center justify-around px-2 py-3">
        {mainRoutes.map((route) => {
          const Icon = route.icon;
          const active = isActive(route.path);

          return (
            <button
              key={route.path}
              onClick={() => navigate(buildNavUrl(route.path))}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl touch-target transition-all",
                "active:scale-95",
                active
                  ? "bg-[#FFD500] text-black shadow-lg shadow-yellow-500/40"
                  : "text-gray-400 hover:text-yellow-400"
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
