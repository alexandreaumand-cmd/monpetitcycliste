import { BarChart3, Users, Calendar, ListChecks, LineChart, Trophy, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { LeagueSwitcher } from "@/components/leagues/LeagueSwitcher";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AppSidebarProps {
  manager: any;
  isAdmin: boolean;
}

const navItems = [
  { label: 'Classement', href: '/dashboard/classement', icon: BarChart3 },
  { label: 'Équipes', href: '/dashboard/mon-equipe', icon: Users },
  { label: 'Résultats', href: '/dashboard/resultats', icon: BarChart3 },
  { label: 'Courses', href: '/dashboard/courses', icon: Calendar },
  { label: 'Startlist', href: '/dashboard/startlist', icon: ListChecks },
  { label: 'Statistiques', href: '/dashboard/statistiques', icon: LineChart },
  { label: 'Enchères', href: '/dashboard/encheres', icon: Trophy },
];

export function AppSidebar({ manager, isAdmin }: AppSidebarProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { seasons, selectedSeason, setSelectedSeason } = useSeasonContext();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-4">
          <img 
            src="/src/assets/logo.png" 
            alt="Logo" 
            className={`transition-all ${isCollapsed ? 'h-8 w-8' : 'h-10 w-10'}`}
          />
          {!isCollapsed && (
            <span className="font-bold text-lg">Fantasy Cycling</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Manager Info & Context */}
        <SidebarGroup>
          <SidebarGroupLabel>Contexte</SidebarGroupLabel>
          <SidebarGroupContent className="space-y-3 px-2">
            {!isCollapsed && manager && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{manager.nom_manager}</p>
                  {isAdmin && (
                    <Badge variant="secondary" className="text-xs">Admin</Badge>
                  )}
                </div>
                {manager.sponsor && (
                  <p className="text-xs text-muted-foreground truncate">{manager.sponsor}</p>
                )}
              </div>
            )}

            {/* Season Selector */}
            {!isCollapsed && (
              <Select value={selectedSeason?.id} onValueChange={(value) => {
                const season = seasons.find(s => s.id === value);
                if (season) setSelectedSeason(season);
              }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Sélectionner une saison" />
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

            {/* League Switcher */}
            {!isCollapsed && (
              <div className="mt-2">
                <LeagueSwitcher />
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <TooltipProvider delayDuration={0}>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.href}
                            className={({ isActive }) =>
                              isActive ? "bg-accent text-accent-foreground" : ""
                            }
                          >
                            <item.icon className="h-4 w-4" />
                            {!isCollapsed && <span>{item.label}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right">
                          {item.label}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </SidebarMenuItem>
                ))}

                {isAdmin && (
                  <SidebarMenuItem>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to="/dashboard/admin"
                            className={({ isActive }) =>
                              isActive ? "bg-accent text-accent-foreground" : ""
                            }
                          >
                            <Settings className="h-4 w-4" />
                            {!isCollapsed && <span>Admin</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right">
                          Admin
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </SidebarMenuItem>
                )}
              </TooltipProvider>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <div className="p-2 text-xs text-muted-foreground text-center">
          {!isCollapsed && selectedSeason && (
            <p>Saison {selectedSeason.annee}</p>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
