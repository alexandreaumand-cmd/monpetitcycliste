import { useLocation, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LogOut, Trophy, Users, Calendar, BarChart3, Shield, Menu, X, ListChecks, LineChart, Lock } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import mpcLogo from "@/assets/mpc-logo.png";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationCenter } from "./NotificationCenter";
import { useManagerSponsor } from "@/hooks/useManagerSponsor";
import { LeagueSwitcher } from "@/components/leagues/LeagueSwitcher";
import { ManagerInfoDropdown } from "./ManagerInfoDropdown";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

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
  const { t } = useTranslation();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentLeagueId = searchParams.get('leagueId');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const { selectedSeason, setSelectedSeason, seasons, isLoading: seasonsLoading, isLeagueSeason, lockedLeagueSeason } = useSeasonContext();
  const { data: seasonSponsor } = useManagerSponsor(manager?.id, selectedSeason?.id);
  
  // Fallback: sponsor de la saison > sponsor global > null
  const displaySponsor = seasonSponsor?.sponsor || manager?.sponsor;
  
  const allDesktopLinks = isAdmin 
    ? [...desktopNavLinks, { label: 'Admin', href: '/dashboard/admin', icon: Shield }]
    : desktopNavLinks;

  const allMobileLinks = isAdmin 
    ? [...mobileNavLinks, { label: 'Admin', href: '/dashboard/admin', icon: Shield }]
    : mobileNavLinks;

  const buildNavUrl = (href: string) => {
    return currentLeagueId ? `${href}?leagueId=${currentLeagueId}` : href;
  };

  const isActive = (href: string) => {
    if (href === '/dashboard/encheres' && location.pathname === '/dashboard') return true;
    return location.pathname.startsWith(href);
  };

  const handleSeasonChange = (seasonId: string) => {
    // Prevent season change when league is locked
    if (isLeagueSeason) {
      console.warn("[Header] Season locked by league; ignoring change");
      return;
    }
    const season = seasons.find(s => s.id === seasonId) || null;
    console.log("[Header] Changement saison:", seasonId, "→", season?.annee);
    setSelectedSeason(season);
  };

  return (
    <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-yellow-500/30">
      {/* Top Bar */}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-12 border-b border-yellow-500/20">
          {/* Left: Logo + Manager Info */}
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="flex items-center gap-3">
              <img 
                src={mpcLogo} 
                alt="Logo Mon Petit Cycliste" 
                className="h-10 w-10 md:h-12 md:w-12"
              />
              <span className="hidden lg:inline font-montserrat font-bold text-white">Mon Petit Cycliste</span>
            </Link>
            {manager && (
              <ManagerInfoDropdown 
                manager={manager}
                displaySponsor={displaySponsor}
                selectedYear={selectedSeason?.annee}
                isAdmin={isAdmin}
                avatarUrl={manager.avatar_url}
              />
            )}
          </div>

          {/* Right: Season + League + Notifications + Logout */}
          <div className="flex items-center gap-2">
            {/* Season Selector or Locked Badge */}
            {!seasonsLoading && seasons.length > 0 && (
              <>
                {isLeagueSeason && lockedLeagueSeason ? (
                  <Badge variant="secondary" className="gap-1 h-8 px-3">
                    <Lock className="h-3 w-3" />
                    <span className="text-xs">Saison {lockedLeagueSeason.annee}</span>
                  </Badge>
                ) : (
                  <>
                    {/* Mobile: Native select */}
                    <select
                      aria-label="Choisir l'année"
                      className="md:hidden w-[90px] h-8 text-xs rounded-md border border-input bg-background text-foreground px-2 focus:outline-none focus:ring-2 focus:ring-ring"
                      value={selectedSeason?.id || ""}
                      onChange={(e) => handleSeasonChange(e.target.value)}
                      disabled={isLeagueSeason}
                    >
                      <option value="" disabled>Année</option>
                      {seasons.map((season) => (
                        <option key={season.id} value={season.id}>
                          {season.annee}
                        </option>
                      ))}
                    </select>

                    {/* Desktop: Radix Select */}
                    <Select
                      value={selectedSeason?.id || ""}
                      onValueChange={handleSeasonChange}
                      disabled={isLeagueSeason}
                    >
                      <SelectTrigger className="hidden md:flex w-[100px] h-8">
                        <SelectValue placeholder="Année" />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-popover">
                        {seasons.map((season) => (
                          <SelectItem key={season.id} value={season.id}>
                            {season.annee}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </>
            )}

            <LeagueSwitcher />
            <NotificationCenter />
            <LanguageSwitcher />
            
            <Button variant="ghost" size="sm" onClick={onSignOut} className="hidden sm:flex gap-2 h-8">
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline">{t('navigation.logout')}</span>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onSignOut}
              className="sm:hidden h-8 w-8 p-0"
              title={t('navigation.logout')}
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
                  to={buildNavUrl(link.href)}
                  aria-current={active ? 'page' : 'false'}
                  className={cn(
                    "px-4 py-2 rounded-full font-poppins font-semibold transition-all flex items-center gap-2",
                    active 
                      ? "bg-[#FFD500] text-black shadow-lg shadow-yellow-500/30" 
                      : "text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10"
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
          <nav className="md:hidden py-4 border-t border-yellow-500/20 bg-black/95">
            <div className="flex flex-col gap-2">
              {allMobileLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    to={buildNavUrl(link.href)}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={active ? 'page' : 'false'}
                    className={cn(
                      "px-4 py-3 rounded-xl font-poppins font-semibold transition-all flex items-center gap-3",
                      active 
                        ? "bg-[#FFD500] text-black shadow-lg" 
                        : "text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10"
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
