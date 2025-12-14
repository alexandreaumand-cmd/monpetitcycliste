import { BarChart3, Users, Calendar, ListChecks, LineChart, Trophy, Settings, Home, Shield, Database } from "lucide-react";
import { NavLink, useSearchParams } from "react-router-dom";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import mpcLogo from "@/assets/mpc-logo.png";
import { useLeague } from "@/contexts/LeagueContext";
import { useUserLeagues } from "@/hooks/useUserLeagues";

interface AppSidebarProps {
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  isLeagueAdminOnly?: boolean;
}

const navItems = [
  { label: 'Accueil', href: '/dashboard/home', icon: Home },
  { label: 'Classement', href: '/dashboard/classement', icon: BarChart3 },
  { label: 'Équipes', href: '/dashboard/mon-equipe', icon: Users },
  { label: 'Résultats', href: '/dashboard/resultats', icon: BarChart3 },
  { label: 'Courses', href: '/dashboard/courses', icon: Calendar },
  { label: 'Startlist', href: '/dashboard/startlist', icon: ListChecks },
  { label: 'Statistiques', href: '/dashboard/statistiques', icon: LineChart },
  { label: 'Enchères', href: '/dashboard/encheres', icon: Trophy },
];

export function AppSidebar({ isAdmin, isSuperAdmin = false, isLeagueAdminOnly = false }: AppSidebarProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [searchParams] = useSearchParams();
  const currentLeagueId = searchParams.get('leagueId');
  const { leagueId } = useLeague();
  const { roles, isLoading: rolesLoading } = useUserLeagues();

  // Vérifier si l'utilisateur est admin/owner de la ligue sélectionnée
  const isAdminOfCurrentLeague = !rolesLoading && leagueId && roles[leagueId] && 
    ['owner', 'admin'].includes(roles[leagueId]);

  const buildNavUrl = (path: string) => {
    return currentLeagueId ? `${path}?leagueId=${currentLeagueId}` : path;
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-4">
          <img 
            src={mpcLogo} 
            alt="Logo Mon Petit Cycliste" 
            className={`transition-all ${isCollapsed ? 'h-8 w-8' : 'h-10 w-10'}`}
          />
          {!isCollapsed && (
            <span className="font-bold text-lg">Mon Petit Cycliste</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
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
                            to={buildNavUrl(item.href)}
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

                {/* Admin Ligue - Pour les admins/owners de la ligue */}
                {isAdminOfCurrentLeague && (
                  <SidebarMenuItem>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={buildNavUrl("/dashboard/admin")}
                            className={({ isActive }) =>
                              isActive ? "bg-accent text-accent-foreground" : ""
                            }
                          >
                            <Settings className="h-4 w-4" />
                            {!isCollapsed && <span>Admin Ligue</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right">
                          Admin Ligue
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </SidebarMenuItem>
                )}

                {/* Super Admin - UNIQUEMENT pour les super admins */}
                {isSuperAdmin && (
                  <SidebarMenuItem>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={buildNavUrl("/dashboard/super-admin")}
                            className={({ isActive }) =>
                              isActive ? "bg-accent text-accent-foreground" : ""
                            }
                          >
                            <Shield className="h-4 w-4" />
                            {!isCollapsed && <span>Super Admin</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right">
                          Super Admin
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
    </Sidebar>
  );
}
