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
  Calendar,
  Shield,
  LogOut,
  User,
  Radio,
  LineChart,
  Settings,
} from "lucide-react";
import { useManagerSponsor } from "@/hooks/useManagerSponsor";
import { useSeasonContext } from "@/contexts/SeasonContext";

interface MobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manager: any;
  isAdmin: boolean;
  onSignOut: () => void;
}

/**
 * Bottom sheet opened from the "Plus" button in the mobile bottom bar.
 * Contains all secondary destinations + profile/account/admin so that the
 * bottom bar stays the single source of truth for navigation.
 */
export const MobileMoreSheet = ({
  open,
  onOpenChange,
  manager,
  isAdmin,
  onSignOut,
}: MobileMoreSheetProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentLeagueId = searchParams.get("leagueId");
  const { selectedSeason } = useSeasonContext();
  const { data: seasonSponsor } = useManagerSponsor(manager?.id, selectedSeason?.id);

  const displaySponsor = seasonSponsor?.sponsor || manager?.sponsor;

  const sections: Array<{
    title: string;
    items: Array<{ label: string; path: string; icon: any }>;
  }> = [
    {
      title: "Compétition",
      items: [
        { label: "Enchères", path: "/dashboard/encheres", icon: Trophy },
        { label: "Courses", path: "/dashboard/courses", icon: Calendar },
        { label: "Live", path: "/dashboard/live", icon: Radio },
      ],
    },
    {
      title: "Analyse",
      items: [
        { label: "Statistiques", path: "/dashboard/statistiques", icon: LineChart },
      ],
    },
    {
      title: "Profil",
      items: [
        { label: "Mon compte", path: "/dashboard/compte", icon: Settings },
      ],
    },
  ];

  if (isAdmin) {
    sections.push({
      title: "Administration",
      items: [{ label: "Admin", path: "/dashboard/admin", icon: Shield }],
    });
  }

  const isActive = (path: string) => location.pathname.startsWith(path);

  const handleNavigate = (path: string) => {
    const url = currentLeagueId ? `${path}?leagueId=${currentLeagueId}` : path;
    navigate(url);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={true}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[85vh] safe-bottom flex flex-col bg-background p-0"
      >
        <SheetHeader className="text-left px-4 pt-4 pb-2">
          <div
            className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
            onClick={() => handleNavigate("/dashboard/compte")}
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

        <nav className="flex-1 overflow-y-auto px-4 pb-2 pt-2 space-y-3">
          {sections.map((section, idx) => (
            <div key={section.title}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1 mb-1">
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
              {idx < sections.length - 1 && <Separator className="mt-3" />}
            </div>
          ))}
        </nav>

        <div className="px-4 py-3 border-t safe-bottom">
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
