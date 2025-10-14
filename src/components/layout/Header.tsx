import { useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Trophy, Users, Calendar, BarChart3, Shield, Menu, X, ListChecks, LineChart } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationCenter } from "./NotificationCenter";
import { useManagerSponsor } from "@/hooks/useManagerSponsor";

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
  const { selectedSeason, setSelectedSeason, seasons, isLoading: seasonsLoading } = useSeasonContext();
  const { data: seasonSponsor } = useManagerSponsor(manager?.id, selectedSeason?.id);
  
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

  return (
    <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo/Title */}
          <Link to="/dashboard" className="flex items-center gap-3">
            <img src={logo} alt="Mon Petit Cycliste" className="h-10 w-10 object-contain" />
            {manager && (
              <div className="flex flex-col">
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {manager.nom} {displaySponsor && `• ${displaySponsor}`}
                  {isAdmin && <span className="ml-1 text-secondary font-semibold">• Admin</span>}
                </p>
              </div>
            )}
          </Link>

          {/* Season Selector - Responsive */}
          {!seasonsLoading && seasons.length > 0 && (
            <Select
              value={selectedSeason?.id || ""}
              onValueChange={(value) => {
                const season = seasons.find(s => s.id === value);
                setSelectedSeason(season || null);
              }}
            >
              <SelectTrigger className="w-[80px] md:w-[100px] h-8 md:h-9 ml-2 md:ml-4 text-xs md:text-sm">
                <SelectValue placeholder="Année" />
              </SelectTrigger>
              <SelectContent>
                {seasons.map((season) => (
                  <SelectItem key={season.id} value={season.id}>
                    {season.annee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
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

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <Button variant="outline" size="sm" onClick={onSignOut} className="hidden sm:flex">
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onSignOut}
              className="sm:hidden"
            >
              <LogOut className="h-4 w-4" />
            </Button>
            
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
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
