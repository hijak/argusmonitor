import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Zap, Server, Activity, Bell, LayoutDashboard, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const commands = [
  { label: "Go to Overview", icon: Activity, action: "/" },
  { label: "Go to Infrastructure", icon: Server, action: "/infrastructure" },
  { label: "Go to Transactions", icon: Zap, action: "/transactions" },
  { label: "Go to Alerts", icon: Bell, action: "/alerts" },
  { label: "Go to Dashboards", icon: LayoutDashboard, action: "/dashboards" },
  { label: "Go to Logs", icon: FileText, action: "/logs" },
  { label: "Create Transaction Monitor", icon: Zap, action: "/transactions/new" },
  { label: "Ask AI Assistant", icon: Zap, action: "/ai" },
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const filtered = commands.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (action: string) => {
    navigate(action);
    onClose();
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
            className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type a command or search..."
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">ESC</kbd>
              </div>
              <div className="max-h-72 overflow-y-auto p-2">
                {filtered.map((cmd) => (
                  <button
                    key={cmd.label}
                    onClick={() => handleSelect(cmd.action)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-surface-hover"
                  >
                    <cmd.icon className="h-4 w-4 text-muted-foreground" />
                    {cmd.label}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results found</p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
