import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Server, Globe, Zap, Activity, Bell, LayoutDashboard,
  FileText, Bot, Settings, BarChart3, User, Shield, Plug, Palette,
  Monitor,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const pageCommands = [
  { label: "Overview", icon: Activity, url: "/" },
  { label: "Infrastructure", icon: Server, url: "/infrastructure" },
  { label: "Services", icon: Globe, url: "/services" },
  { label: "Transactions", icon: Zap, url: "/transactions" },
  { label: "Alerts", icon: Bell, url: "/alerts" },
  { label: "Dashboards", icon: LayoutDashboard, url: "/dashboards" },
  { label: "Logs", icon: FileText, url: "/logs" },
  { label: "Reports", icon: BarChart3, url: "/reports" },
  { label: "AI Assistant", icon: Bot, url: "/ai" },
  { label: "Settings", icon: Settings, url: "/settings" },
];

const settingsItems = [
  { label: "Profile", description: "Account details and password", icon: User, url: "/settings", section: "profile" },
  { label: "Notifications", description: "Alert channels and routing", icon: Bell, url: "/settings", section: "notifications" },
  { label: "Security", description: "API keys and access control", icon: Shield, url: "/settings", section: "security" },
  { label: "Integrations", description: "Slack, PagerDuty, webhooks", icon: Plug, url: "/settings", section: "integrations" },
  { label: "Appearance", description: "Theme, timezone, date format", icon: Palette, url: "/settings", section: "appearance" },
  { label: "Agents", description: "Monitoring agents and endpoints", icon: Monitor, url: "/settings", section: "agents" },
];

const typeIcons: Record<string, typeof Server> = {
  host: Server,
  service: Globe,
  dashboard: LayoutDashboard,
  transaction: Zap,
};

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  url: string;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.globalSearch(q);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length >= 1) {
      debounceRef.current = setTimeout(() => doSearch(query), 200);
    } else {
      setResults([]);
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const filteredPages = query
    ? pageCommands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : pageCommands;

  const filteredSettings = query
    ? settingsItems.filter(s =>
        s.label.toLowerCase().includes(query.toLowerCase()) ||
        s.description.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const allItems = [
    ...results.map(r => ({ kind: "result" as const, ...r })),
    ...filteredSettings.map(s => ({ kind: "setting" as const, ...s })),
    ...filteredPages.map(p => ({ kind: "page" as const, ...p })),
  ];

  useEffect(() => { setActiveIdx(0); }, [query, results.length]);

  const handleSelect = (item: typeof allItems[number]) => {
    if (item.kind === "setting") {
      navigate(item.url);
      onClose();
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("argus:settings-navigate", { detail: item.section }));
      }, 50);
    } else {
      navigate(item.url);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && allItems[activeIdx]) {
      e.preventDefault();
      handleSelect(allItems[activeIdx]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const statusDot = (status?: string) => {
    if (!status) return null;
    const color = status === "healthy" || status === "up" ? "bg-success"
      : status === "warning" ? "bg-warning"
      : status === "critical" || status === "down" ? "bg-critical"
      : "bg-muted-foreground";
    return <span className={`h-2 w-2 rounded-full ${color} shrink-0`} />;
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed left-1/2 top-[18%] z-50 w-full max-w-lg -translate-x-1/2"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  ref={inputRef}
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search hosts, services, settings..."
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                {loading && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                )}
                <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">ESC</kbd>
              </div>
              <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
                {/* Backend search results */}
                {results.length > 0 && (
                  <div className="mb-1">
                    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Results</p>
                    {results.map((r, i) => {
                      const idx = i;
                      const Icon = typeIcons[r.type] || Server;
                      return (
                        <button
                          key={`r-${r.id}`}
                          data-idx={idx}
                          onClick={() => handleSelect(allItems[idx])}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                            activeIdx === idx ? "bg-primary/10 text-primary" : "text-foreground hover:bg-surface-hover"
                          }`}
                        >
                          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 text-left min-w-0">
                            <span className="font-medium">{r.title}</span>
                            {r.subtitle && <span className="ml-2 text-xs text-muted-foreground">{r.subtitle}</span>}
                          </div>
                          {statusDot(r.status)}
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground capitalize">{r.type}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Settings matches */}
                {filteredSettings.length > 0 && (
                  <div className="mb-1">
                    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Settings</p>
                    {filteredSettings.map((s, i) => {
                      const idx = results.length + i;
                      return (
                        <button
                          key={`s-${s.label}`}
                          data-idx={idx}
                          onClick={() => handleSelect(allItems[idx])}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                            activeIdx === idx ? "bg-primary/10 text-primary" : "text-foreground hover:bg-surface-hover"
                          }`}
                        >
                          <s.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 text-left min-w-0">
                            <span className="font-medium">{s.label}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{s.description}</span>
                          </div>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Setting</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Page navigation */}
                {filteredPages.length > 0 && (
                  <div>
                    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {query ? "Pages" : "Quick Navigation"}
                    </p>
                    {filteredPages.map((p, i) => {
                      const idx = results.length + filteredSettings.length + i;
                      return (
                        <button
                          key={`p-${p.url}`}
                          data-idx={idx}
                          onClick={() => handleSelect(allItems[idx])}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                            activeIdx === idx ? "bg-primary/10 text-primary" : "text-foreground hover:bg-surface-hover"
                          }`}
                        >
                          <p.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="flex-1 text-left">{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {query && !loading && results.length === 0 && filteredPages.length === 0 && filteredSettings.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results for "{query}"</p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
