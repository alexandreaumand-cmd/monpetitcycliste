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
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AppSidebarProps {
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

export function AppSidebar({ isAdmin }: AppSidebarProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

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
    </Sidebar>
  );
}
