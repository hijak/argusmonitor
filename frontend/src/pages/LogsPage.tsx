import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Search } from "lucide-react";
import { motion } from "framer-motion";

const levelColors: Record<string, string> = {
  error: "text-critical",
  warn: "text-warning",
  info: "text-primary",
  debug: "text-muted-foreground",
};

const levelBg: Record<string, string> = {
  error: "bg-critical/10",
  warn: "bg-warning/10",
  info: "bg-primary/10",
  debug: "bg-muted",
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.02 } } };
const item = { hidden: { opacity: 0, y: 4 }, show: { opacity: 1, y: 0, transition: { duration: 0.1 } } };

export default function LogsPage() {
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: logs = [] } = useQuery({
    queryKey: ["logs", levelFilter, search],
    queryFn: () => api.listLogs({
      level: levelFilter !== "all" ? levelFilter : undefined,
      search: search || undefined,
      limit: 100,
    }),
    refetchInterval: 10000,
  });

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 } as any);
  };

  return (
    <motion.div className="p-6 space-y-4" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Logs Explorer" description="Search and analyze logs across services" />
      </motion.div>

      <motion.div variants={item} className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm font-mono text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {["all", "error", "warn", "info", "debug"].map(level => (
            <button
              key={level}
              onClick={() => setLevelFilter(level)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                levelFilter === level ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {level === "all" ? "All" : level.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-success pulse-live" />
          Live
        </div>
      </motion.div>

      <motion.div variants={item} className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="divide-y divide-border/50">
          {logs.map((log: any) => (
            <motion.div
              key={log.id}
              variants={item}
              className="flex items-start gap-3 px-4 py-2.5 font-mono text-xs hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <span className="shrink-0 text-muted-foreground w-[90px]">{formatTime(log.timestamp)}</span>
              <span className={`shrink-0 w-12 rounded px-1.5 py-0.5 text-center font-medium uppercase ${levelBg[log.level] || "bg-muted"} ${levelColors[log.level] || "text-muted-foreground"}`}>
                {log.level}
              </span>
              <span className="shrink-0 w-[120px] truncate text-muted-foreground">{log.service}</span>
              <span className="flex-1 text-foreground break-all">{log.message}</span>
            </motion.div>
          ))}
          {logs.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No logs found</div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
