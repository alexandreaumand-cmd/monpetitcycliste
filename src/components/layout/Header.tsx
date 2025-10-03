import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Enchères", path: "/dashboard" },
  { title: "Mon Équipe", path: "/dashboard/mon-equipe" },
  { title: "Courses", path: "/dashboard/courses" },
  { title: "Classement", path: "/dashboard/classement" },
];

const adminNavItem = { title: "Admin", path: "/dashboard/admin" };

export function Header() {
  const location = useLocation();
  const { isAdmin } = useUserRole();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  const NavLink = ({ item, mobile = false }: { item: typeof navItems[0]; mobile?: boolean }) => {
    const active = isActive(item.path);
    
    return (
      <Link
        to={item.path}
        onClick={() => mobile && setMobileMenuOpen(false)}
        className={cn(
          "px-3 py-2 rounded-md text-sm font-medium transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active && "bg-accent text-primary font-semibold"
        )}
        aria-current={active ? "page" : undefined}
      >
        {item.title}
      </Link>
    );
  };

  const allNavItems = isAdmin ? [...navItems, adminNavItem] : navItems;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link 
          to="/dashboard" 
          className="text-xl font-bold text-primary hover:opacity-80 transition-opacity"
        >
          Fantasy Cycling
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1" role="navigation">
          {allNavItems.map((item) => (
            <NavLink key={item.path} item={item} />
          ))}
        </nav>

        {/* Mobile Menu */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" aria-label="Toggle menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64">
            <div className="flex flex-col gap-4 mt-8">
              <div className="text-lg font-semibold mb-2">Navigation</div>
              {allNavItems.map((item) => (
                <NavLink key={item.path} item={item} mobile />
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
