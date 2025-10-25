import { useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Trophy, Users, Calendar, BarChart3, Shield, Menu, X, ListChecks, LineChart } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { useLeagueSeason } from "@/hooks/useLeagueSeason";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationCenter } from "./NotificationCenter";
import { useManagerSponsor } from "@/hooks/useManagerSponsor";
import { LeagueSwitcher } from "@/components/leagues/LeagueSwitcher";
import { ManagerInfoDropdown } from "./ManagerInfoDropdown";

interface HeaderProps {
  manager: any;
  isAdmin: boolean;
  onSignOut: () => void;
}

// Desktop navigation order
const desktopNavLinks = [
  { label: 'Classement', href: '/dashboard/classement', icon: BarChart3 },
  { label: 'Équipes', href: '/dashboard/mon-equipe', icon: Users },
  { label: 'Résultats', href: '/dashboard/resultats', icon: BarChart3 },
  { label: 'Courses', href: '/dashboard/courses', icon: Calendar },
  { label: 'Startlist', href: '/dashboard/startlist', icon: ListChecks },
  { label: 'Statistiques', href: '/dashboard/statistiques', icon: LineChart },
  { label: 'Enchères', href: '/dashboard/encheres', icon: Trophy },
];

// Mobile navigation order (unchanged)
const mobileNavLinks = [
  { label: 'Enchères', href: '/dashboard/encheres', icon: Trophy },
  { label: 'Équipes', href: '/dashboard/mon-equipe', icon: Users },
  { label: 'Courses', href: '/dashboard/courses', icon: Calendar },
  { label: 'Résultats', href: '/dashboard/resultats', icon: BarChart3 },
  { label: 'Classement', href: '/dashboard/classement', icon: BarChart3 },
  { label: 'Startlist', href: '/dashboard/startlist', icon: ListChecks },
  { label: 'Statistiques', href: '/dashboard/statistiques', icon: LineChart },
];

export const Header = ({ manager, isAdmin, onSignOut }: HeaderProps) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const { season, seasons, isLoading: seasonsLoading } = useLeagueSeason();
  const { data: seasonSponsor } = useManagerSponsor(manager?.id, season?.id);
  
  // Fallback: sponsor de la saison > sponsor global > null
  const displaySponsor = seasonSponsor?.sponsor || manager?.sponsor;
  
  const allDesktopLinks = isAdmin 
    ? [...desktopNavLinks, { label: 'Admin', href: '/dashboard/admin', icon: Shield }]
    : desktopNavLinks;

  const allMobileLinks = isAdmin 
    ? [...mobileNavLinks, { label: 'Admin', href: '/dashboard/admin', icon: Shield }]
    : mobileNavLinks;

  const isActive = (href: string) => {
    if (href === '/dashboard/encheres' && location.pathname === '/dashboard') return true;
    return location.pathname.startsWith(href);
  };

  // Season selector is now read-only (derived from league)
  const handleSeasonChange = (seasonId: string) => {
    console.log("[Header] Season selector disabled - season is derived from league");
  };

  return (
    <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-sm border-b">
      {/* Top Bar */}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-12 border-b border-border/50">
          {/* Left: Logo + Manager Info */}
          <div className="flex items-center gap-2">
            <Link to="/dashboard" className="flex items-center gap-2">
              <img src={logo} alt="Mon Petit Cycliste" className="h-8 w-8 object-contain" />
              <span className="hidden lg:inline text-sm font-semibold text-foreground">Mon Petit Cycliste</span>
            </Link>
            {manager && (
              <ManagerInfoDropdown 
                manager={manager}
                displaySponsor={displaySponsor}
                selectedYear={season?.annee}
                isAdmin={isAdmin}
              />
            )}
          </div>

          {/* Right: Season + League + Notifications + Logout */}
          <div className="flex items-center gap-2">
            {/* Season badge (read-only, derived from league) */}
            {season && (
              <div className="h-8 px-3 flex items-center text-xs font-medium text-muted-foreground border border-border rounded-md bg-muted/50">
                {season.annee}
              </div>
            )}

            <LeagueSwitcher />
            <NotificationCenter />
            
            <Button variant="ghost" size="sm" onClick={onSignOut} className="hidden sm:flex gap-2 h-8">
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline">Déconnexion</span>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onSignOut}
              className="sm:hidden h-8 w-8 p-0"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="hidden md:flex items-center justify-center h-12">
          <nav className="flex items-center gap-1">
            {allDesktopLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  aria-current={active ? 'page' : 'false'}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2",
                    active 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center justify-center h-10 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="gap-2"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            <span className="text-sm">Menu</span>
          </Button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t">
            <div className="flex flex-col gap-2">
              {allMobileLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={active ? 'page' : 'false'}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3",
                      active 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};
