import { useState, useEffect, useCallback, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  Server,
  Globe,
  Zap,
  Bell,
  AlertTriangle,
  LayoutDashboard,
  FileText,
  BarChart3,
  Bot,
  Settings,
  CalendarDays,
  ChevronLeft,
  Search,
  Command,
  Users,
  Building2,
  Container,
  Boxes,
  Menu,
  MonitorSmartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useAppMeta } from "@/contexts/AppMetaContext";

const navItems = [
  { label: "Overview", icon: Bell, path: "/" },
  { label: "Dashboard", icon: Activity, path: "/dashboard" },
  { label: "Infrastructure", icon: Server, path: "/infrastructure" },
  { label: "Services", icon: Globe, path: "/services" },
  { label: "Transactions", icon: Zap, path: "/transactions" },
  { label: "Kubernetes", icon: Container, path: "/kubernetes" },
  { label: "Docker Swarm", icon: Boxes, path: "/swarm" },
  { label: "Proxmox", icon: MonitorSmartphone, path: "/proxmox" },
  { label: "Alerts", icon: Bell, path: "/alerts" },
  { label: "Incidents", icon: AlertTriangle, path: "/incidents" },
  { label: "Dashboards", icon: LayoutDashboard, path: "/dashboards" },
  { label: "Logs", icon: FileText, path: "/logs" },
  { label: "Reports", icon: BarChart3, path: "/reports" },
  { label: "On-call", icon: CalendarDays, path: "/oncall" },
  { label: "Users", icon: Users, path: "/users" },
  { label: "Enterprise", icon: Building2, path: "/enterprise", capability: "org.advanced_rbac" },
] as const;

const bottomItems = [
  { label: "AI Assistant", icon: Bot, path: "/ai" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

const MOBILE_BREAKPOINT = 768;
const COLLAPSED_WIDTH = 56;
const DEFAULT_SIDEBAR_WIDTH = 224;
const MIN_SIDEBAR_WIDTH = 208;
const MAX_SIDEBAR_WIDTH = 384;

interface AppLayoutProps {
  children: React.ReactNode;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false,
  );
  const [desktopCollapsed, setDesktopCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("argus.sidebarCollapsed") === "1";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_SIDEBAR_WIDTH;
    const saved = Number(window.localStorage.getItem("argus.sidebarWidth"));
    return Number.isFinite(saved) ? clamp(saved, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH) : DEFAULT_SIDEBAR_WIDTH;
  });
  const [cmdOpen, setCmdOpen] = useState(false);
  const location = useLocation();
  const { meta } = useAppMeta();

  const collapsed = isMobile ? !mobileOpen : desktopCollapsed;
  const visibleNavItems = useMemo(
    () => navItems.filter((item) => !item.capability || meta?.capabilities?.[item.capability]),
    [meta],
  );

  const currentSection = useMemo(() => {
    const allItems = [...visibleNavItems, ...bottomItems];
    return allItems.find((item) => item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path));
  }, [location.pathname, visibleNavItems]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setCmdOpen((v) => !v);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const sync = (event?: MediaQueryList | MediaQueryListEvent) => {
      const mobile = "matches" in (event || media) ? (event || media).matches : media.matches;
      setIsMobile(mobile);
      if (mobile) {
        setMobileOpen(false);
      }
    };

    sync(media);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      window.localStorage.setItem("argus.sidebarCollapsed", desktopCollapsed ? "1" : "0");
      window.localStorage.setItem("argus.sidebarWidth", String(sidebarWidth));
    }
  }, [desktopCollapsed, isMobile, sidebarWidth]);

  useEffect(() => {
    if (isMobile) {
      setMobileOpen(false);
    }
  }, [isMobile, location.pathname]);

  const startResize = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (isMobile || desktopCollapsed) return;

    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;

    const onMove = (moveEvent: MouseEvent) => {
      const next = clamp(startWidth + (moveEvent.clientX - startX), MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);
      setSidebarWidth(next);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [desktopCollapsed, isMobile, sidebarWidth]);

  const SideLink = ({ item }: { item: typeof navItems[0] }) => (
    <NavLink
      to={item.path}
      onClick={() => {
        if (isMobile) setMobileOpen(false);
      }}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
          collapsed && "justify-center px-2",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
        )
      }
      end={item.path === "/"}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {isMobile && mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "relative z-40 flex shrink-0 flex-col border-r border-border bg-sidebar transition-[transform,width] duration-150 ease-out",
          isMobile
            ? "fixed inset-y-0 left-0 w-72 shadow-2xl"
            : "hidden md:flex",
          isMobile && (mobileOpen ? "translate-x-0" : "-translate-x-full"),
        )}
        style={isMobile ? undefined : { width: `${collapsed ? COLLAPSED_WIDTH : sidebarWidth}px` }}
      >
        <div className={cn("flex h-14 items-center border-b border-border px-3", collapsed && "justify-center")}>
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                <Activity className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-bold tracking-tight text-foreground">Vordr</span>
                <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{meta?.edition?.label || "Self-Hosted"}</span>
                {meta?.demo_mode && (
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-amber-500">Demo mode</span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Activity className="h-4 w-4 text-primary-foreground" />
            </div>
          )}
        </div>

        <div className="px-2 pb-1 pt-3">
          <button
            onClick={() => setCmdOpen(true)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-hover",
              collapsed && "justify-center px-2",
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

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {visibleNavItems.map((item) => (
            <SideLink key={item.path} item={item} />
          ))}
        </nav>

        <div className="space-y-0.5 border-t border-border px-2 py-2">
          {bottomItems.map((item) => (
            <SideLink key={item.path} item={item} />
          ))}
          <button
            onClick={() => (isMobile ? setMobileOpen(false) : setDesktopCollapsed((v) => !v))}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground",
              collapsed && "justify-center px-2",
            )}
          >
            <ChevronLeft className={cn("h-4 w-4 shrink-0 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && <span>{isMobile ? "Close menu" : "Collapse"}</span>}
          </button>
        </div>

        {!isMobile && !desktopCollapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            onMouseDown={startResize}
            className="absolute inset-y-0 -right-1 hidden w-2 cursor-col-resize md:block"
          >
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors hover:bg-border" />
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-y-auto">
        {isMobile && (
          <div className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
              >
                <Menu className="h-4 w-4" />
                Menu
              </button>
              <div className="min-w-0 text-right">
                <div className="truncate text-sm font-semibold text-foreground">{currentSection?.label ?? "Vordr"}</div>
                <div className="text-[11px] text-muted-foreground">Sidebar collapsed on mobile by default</div>
              </div>
            </div>
          </div>
        )}
        {children}
      </main>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}
