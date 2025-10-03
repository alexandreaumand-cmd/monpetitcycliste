import { useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Trophy, Users, Calendar, BarChart3, Shield, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

interface HeaderProps {
  manager: any;
  isAdmin: boolean;
  onSignOut: () => void;
}

const navLinks = [
  { label: 'Enchères', href: '/dashboard/encheres', icon: Trophy },
  { label: 'Mon Équipe', href: '/dashboard/mon-equipe', icon: Users },
  { label: 'Courses', href: '/dashboard/courses', icon: Calendar },
  { label: 'Classement', href: '/dashboard/classement', icon: BarChart3 },
];

export const Header = ({ manager, isAdmin, onSignOut }: HeaderProps) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const allLinks = isAdmin 
    ? [...navLinks, { label: 'Admin', href: '/dashboard/admin', icon: Shield }]
    : navLinks;

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
                  {manager.nom} {manager.sponsor && `• ${manager.sponsor}`}
                  {isAdmin && <span className="ml-1 text-secondary font-semibold">• Admin</span>}
                </p>
              </div>
            )}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {allLinks.map((link) => {
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
              {allLinks.map((link) => {
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
