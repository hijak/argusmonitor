import { useState, useEffect, useCallback } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Activity, Server, Globe, Zap, Bell, AlertTriangle,
  LayoutDashboard, FileText, BarChart3, Bot, Settings, CalendarDays,
  ChevronLeft, Search, Command, Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useAppMeta } from "@/contexts/AppMetaContext";

const navItems = [
  { label: "Overview", icon: Activity, path: "/" },
  { label: "Infrastructure", icon: Server, path: "/infrastructure" },
  { label: "Services", icon: Globe, path: "/services" },
  { label: "Transactions", icon: Zap, path: "/transactions" },
  { label: "Alerts", icon: Bell, path: "/alerts" },
  { label: "Incidents", icon: AlertTriangle, path: "/incidents" },
  { label: "Dashboards", icon: LayoutDashboard, path: "/dashboards" },
  { label: "Logs", icon: FileText, path: "/logs" },
  { label: "Reports", icon: BarChart3, path: "/reports" },
  { label: "On-call", icon: CalendarDays, path: "/oncall" },
  { label: "Users", icon: Users, path: "/users" },
];

const bottomItems = [
  { label: "AI Assistant", icon: Bot, path: "/ai" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const location = useLocation();
  const { meta } = useAppMeta();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setCmdOpen(v => !v);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const SideLink = ({ item }: { item: typeof navItems[0] }) => (
    <NavLink
      to={item.path}
      className={({ isActive }) => cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
        collapsed && "justify-center px-2",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      )}
      end={item.path === "/"}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "flex shrink-0 flex-col border-r border-border bg-sidebar transition-all duration-150",
        collapsed ? "w-14" : "w-56"
      )}>
        {/* Logo */}
        <div className={cn("flex h-14 items-center border-b border-border px-3", collapsed && "justify-center")}>
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                <Activity className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-bold tracking-tight text-foreground">ArgusMonitor</span>
                {meta?.demo_mode && <span className="block text-[10px] font-medium uppercase tracking-wide text-amber-500">Demo mode</span>}
              </div>
            </div>
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Activity className="h-4 w-4 text-primary-foreground" />
            </div>
          )}
        </div>

        {/* Search trigger */}
        <div className="px-2 pt-3 pb-1">
          <button
            onClick={() => setCmdOpen(true)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-hover",
              collapsed && "justify-center px-2"
            )}
          >
            <Search className="h-3.5 w-3.5" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Search...</span>
                <kbd className="flex items-center gap-0.5 rounded bg-muted px-1 py-0.5 text-[10px] font-mono">
                  <Command className="h-2.5 w-2.5" />K
                </kbd>
              </>
            )}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {navItems.map(item => <SideLink key={item.path} item={item} />)}
        </nav>

        {/* Bottom */}
        <div className="border-t border-border px-2 py-2 space-y-0.5">
          {bottomItems.map(item => <SideLink key={item.path} item={item} />)}
          <button
            onClick={() => setCollapsed(v => !v)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground",
              collapsed && "justify-center px-2"
            )}
          >
            <ChevronLeft className={cn("h-4 w-4 shrink-0 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}
