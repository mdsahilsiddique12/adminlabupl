import { KeyRound, LayoutDashboard, Users, Smartphone, FileText, Layers, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Licenses", url: "/licenses", icon: KeyRound },
  { title: "Plans", url: "/plans", icon: Layers },
  { title: "Users", url: "/users", icon: Users },
  { title: "Devices", url: "/devices", icon: Smartphone },
  { title: "Audit Logs", url: "/logs", icon: FileText },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { logout, isLoggingOut } = useAuth();

  return (
    <Sidebar variant="inset">
      <SidebarContent>
        <div className="p-6">
          <div className="flex items-center gap-3 font-display text-xl font-bold text-primary">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
              <KeyRound className="w-4 h-4" />
            </div>
            LicenseOps
          </div>
        </div>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    tooltip={item.title}
                    className="transition-all duration-200"
                  >
                    <Link href={item.url} className="flex items-center gap-3">
                      <item.icon className="w-4 h-4" />
                      <span className="font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
             <SidebarMenuButton onClick={() => logout()} disabled={isLoggingOut} className="text-destructive hover:text-destructive hover:bg-destructive/10">
               <LogOut className="w-4 h-4" />
               <span className="font-medium">Logout</span>
             </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
