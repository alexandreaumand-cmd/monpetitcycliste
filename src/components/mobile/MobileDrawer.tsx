import { useNavigate, useLocation } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Users,
  Calendar,
  BarChart3,
  Shield,
  ListChecks,
  LogOut,
  User,
} from "lucide-react";
import { useManagerSponsor } from "@/hooks/useManagerSponsor";
import { useSeasonContext } from "@/contexts/SeasonContext";

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manager: any;
  isAdmin: boolean;
  onSignOut: () => void;
  leagueSelector?: React.ReactNode;
  seasonSelector?: React.ReactNode;
}

export const MobileDrawer = ({
  open,
  onOpenChange,
  manager,
  isAdmin,
  onSignOut,
  leagueSelector,
  seasonSelector,
}: MobileDrawerProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedSeason } = useSeasonContext();
  const { data: seasonSponsor } = useManagerSponsor(manager?.id, selectedSeason?.id);
  
  const displaySponsor = seasonSponsor?.sponsor || manager?.sponsor;

  const sections = [
    {
      title: "Principal",
      items: [
        { label: "Classement", path: "/dashboard/classement", icon: BarChart3 },
        { label: "Mon Équipe", path: "/dashboard/mon-equipe", icon: Users },
        { label: "Startlist", path: "/dashboard/startlist", icon: ListChecks },
      ],
    },
    {
      title: "Courses",
      items: [
        { label: "Courses", path: "/dashboard/courses", icon: Calendar },
        { label: "Résultats", path: "/dashboard/resultats", icon: BarChart3 },
      ],
    },
    {
      title: "Gestion",
      items: [
        { label: "Enchères", path: "/dashboard/encheres", icon: Trophy },
      ],
    },
  ];

  if (isAdmin) {
    sections.push({
      title: "Administration",
      items: [{ label: "Admin", path: "/dashboard/admin", icon: Shield }],
    });
  }

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={true}>
      <SheetContent side="left" className="w-[280px] safe-bottom flex flex-col bg-background">
        <SheetHeader className="text-left pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base truncate">
                {manager?.nom || "Manager"}
              </SheetTitle>
              {displaySponsor && (
                <p className="text-xs text-muted-foreground truncate">
                  {displaySponsor}
                </p>
              )}
              {isAdmin && (
                <p className="text-xs text-secondary font-semibold">
                  Administrateur
                </p>
              )}
            </div>
          </div>
        </SheetHeader>

        {leagueSelector}

        {seasonSelector}

        <nav className="flex-1 overflow-y-auto py-4 space-y-6">
          {sections.map((section, idx) => (
            <div key={idx}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);

                  return (
                    <Button
                      key={item.path}
                      variant={active ? "default" : "ghost"}
                      className={cn(
                        "w-full justify-start touch-target",
                        active && "shadow-sm"
                      )}
                      onClick={() => handleNavigate(item.path)}
                    >
                      <Icon className="mr-3 h-4 w-4" />
                      {item.label}
                    </Button>
                  );
                })}
              </div>
              {idx < sections.length - 1 && <Separator className="mt-4" />}
            </div>
          ))}
        </nav>

        <div className="pt-4 border-t">
          <Button
            variant="outline"
            className="w-full justify-start touch-target"
            onClick={() => {
              onSignOut();
              onOpenChange(false);
            }}
          >
            <LogOut className="mr-3 h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
