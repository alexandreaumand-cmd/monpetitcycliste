import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Users, BarChart3, ListChecks, Medal, Calendar } from "lucide-react";

interface MobileBottomBarProps {
  isAdmin: boolean;
}

export const MobileBottomBar = ({ isAdmin }: MobileBottomBarProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const mainRoutes = [
    { label: "Classement", path: "/dashboard/classement", icon: BarChart3 },
    { label: "Equipes", path: "/dashboard/mon-equipe", icon: Users },
    { label: "Startlist", path: "/dashboard/startlist", icon: ListChecks },
    { label: "Résultats", path: "/dashboard/resultats", icon: Medal },
    { label: "Courses", path: "/dashboard/courses", icon: Calendar },
  ];

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-t safe-bottom"
      role="navigation"
      aria-label="Navigation principale"
    >
      <div className="flex items-center justify-around px-2 py-2">
        {mainRoutes.map((route) => {
          const Icon = route.icon;
          const active = isActive(route.path);

          return (
            <button
              key={route.path}
              onClick={() => navigate(route.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl touch-target transition-all",
                "active:scale-95",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">
                {route.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
