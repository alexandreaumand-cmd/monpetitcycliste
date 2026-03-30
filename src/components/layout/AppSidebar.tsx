import { BarChart3, Users, Calendar, ListChecks, LineChart, Trophy, Settings, Home, Shield, Database, Swords, Radio } from "lucide-react";
import { NavLink, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import faviconLogo from "@/assets/logo-carre-sans-marque.png";
import logoBordure from "@/assets/logo-bordure.png";
import { useLeague } from "@/contexts/LeagueContext";
import { useUserLeagues } from "@/hooks/useUserLeagues";

interface AppSidebarProps {
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  isLeagueAdminOnly?: boolean;
}

const navItemsConfig = [
  { key: 'home', href: '/dashboard/home', icon: Home },
  { key: 'standings', href: '/dashboard/classement', icon: BarChart3 },
  { key: 'teams', href: '/dashboard/mon-equipe', icon: Users },
  { key: 'results', href: '/dashboard/resultats', icon: BarChart3 },
  { key: 'races', href: '/dashboard/courses', icon: Calendar },
  { key: 'startlist', href: '/dashboard/startlist', icon: ListChecks },
  { key: 'statistics', href: '/dashboard/statistiques', icon: LineChart },
  { key: 'auctions', href: '/dashboard/encheres', icon: Trophy },
  { key: 'live', href: '/dashboard/live', icon: Radio },
  { key: 'arena', href: '/dashboard/arene', icon: Swords },
];

export function AppSidebar({ isAdmin, isSuperAdmin = false, isLeagueAdminOnly = false }: AppSidebarProps) {
  const { t } = useTranslation();
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

  const navItems = navItemsConfig.map(item => ({
    ...item,
    label: t(`navigation.${item.key}`)
  }));

  return (
    <Sidebar collapsible="icon" className="bg-secondary border-r-0">
      <SidebarHeader className="bg-background">
        <div className="flex items-center justify-center px-2 py-4">
          {isCollapsed ? (
            <img 
              src={faviconLogo} 
              alt="La Bordure"
              loading="eager"
              width={32}
              height={32}
              className="h-8 w-8 transition-all"
            />
          ) : (
            <img 
              src={logoBordure} 
              alt="La Bordure Fantasy Cycling"
              loading="eager"
              className="h-20 w-auto max-w-[220px] transition-all"
            />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-secondary">
        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/60">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <TooltipProvider delayDuration={0}>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild className="text-white/80 hover:bg-white/10 hover:text-white">
                          <NavLink
                            to={buildNavUrl(item.href)}
                            className={({ isActive }) =>
                              isActive
                                ? "!text-bordure-gold !bg-bordure-gold/10 border-l-[3px] border-bordure-gold font-semibold"
                                : ""
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
                        <SidebarMenuButton asChild className="text-white/80 hover:bg-white/10 hover:text-white">
                          <NavLink
                            to={buildNavUrl("/dashboard/admin")}
                            className={({ isActive }) =>
                              isActive
                                ? "!text-bordure-gold !bg-bordure-gold/10 border-l-[3px] border-bordure-gold font-semibold"
                                : ""
                            }
                          >
                            <Settings className="h-4 w-4" />
                            {!isCollapsed && <span>{t('navigation.adminLeague')}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right">
                          {t('navigation.adminLeague')}
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
                        <SidebarMenuButton asChild className="text-white/80 hover:bg-white/10 hover:text-white">
                          <NavLink
                            to={buildNavUrl("/dashboard/super-admin")}
                            className={({ isActive }) =>
                              isActive
                                ? "!text-bordure-gold !bg-bordure-gold/10 border-l-[3px] border-bordure-gold font-semibold"
                                : ""
                            }
                          >
                            <Shield className="h-4 w-4" />
                            {!isCollapsed && <span>{t('navigation.superAdmin')}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right">
                          {t('navigation.superAdmin')}
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
