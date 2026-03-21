import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
  Swords,
  Radio,
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
}

export const MobileDrawer = ({
  open,
  onOpenChange,
  manager,
  isAdmin,
  onSignOut,
  leagueSelector,
}: MobileDrawerProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentLeagueId = searchParams.get('leagueId');
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
    {
      title: "Social",
      items: [
        { label: "Live", path: "/dashboard/live", icon: Radio },
        { label: "Arène", path: "/dashboard/arene", icon: Swords },
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
    const url = currentLeagueId ? `${path}?leagueId=${currentLeagueId}` : path;
    navigate(url);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={true}>
      <SheetContent side="left" className="w-[280px] safe-bottom flex flex-col bg-background">
        <SheetHeader className="text-left pb-4">
          <div 
            className="flex items-center gap-3 mb-2 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
            onClick={() => handleNavigate('/dashboard/compte')}
          >
            <Avatar className="w-12 h-12">
              {manager?.avatar_url ? (
                <AvatarImage src={manager.avatar_url} alt={manager.nom} />
              ) : null}
              <AvatarFallback className="bg-primary/10">
                <User className="h-6 w-6 text-primary" />
              </AvatarFallback>
            </Avatar>
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

        <nav className="flex-1 overflow-y-auto py-4 space-y-2">
          {sections.map((section, idx) => (
            <div key={idx}>
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
              {idx < sections.length - 1 && <Separator className="my-2" />}
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
