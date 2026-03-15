import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Search, Filter, Clock, AlertTriangle, ArrowDown } from "lucide-react";
import { motion } from "framer-motion";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  service: string;
  message: string;
}

const logs: LogEntry[] = [
  { id: "1", timestamp: "14:55:23.142", level: "error", service: "api-prod-01", message: "Connection refused to db-primary:5432 - pool exhausted" },
  { id: "2", timestamp: "14:55:22.891", level: "warn", service: "worker-03", message: "Job queue depth exceeds threshold: 15,234 pending" },
  { id: "3", timestamp: "14:55:22.445", level: "info", service: "api-prod-02", message: "Request completed: GET /api/users - 200 OK (45ms)" },
  { id: "4", timestamp: "14:55:21.998", level: "error", service: "api-prod-01", message: "Timeout waiting for database connection after 5000ms" },
  { id: "5", timestamp: "14:55:21.776", level: "info", service: "auth-service", message: "Token validated for user_id=usr_8x2k9 scope=api:read" },
  { id: "6", timestamp: "14:55:21.334", level: "debug", service: "cache-redis-01", message: "Cache hit: session:usr_8x2k9 TTL=3600s" },
  { id: "7", timestamp: "14:55:20.891", level: "warn", service: "payment-svc", message: "Stripe API response time elevated: 189ms (threshold: 100ms)" },
  { id: "8", timestamp: "14:55:20.445", level: "info", service: "api-prod-02", message: "Request completed: POST /api/orders - 201 Created (62ms)" },
  { id: "9", timestamp: "14:55:19.998", level: "error", service: "search-svc", message: "Elasticsearch cluster health: RED - 2 shards unassigned" },
  { id: "10", timestamp: "14:55:19.556", level: "info", service: "lb-prod-01", message: "Health check passed for api-prod-02 (28ms)" },
  { id: "11", timestamp: "14:55:19.112", level: "debug", service: "api-prod-01", message: "Rate limit check: usr_3j4k2 - 45/100 requests remaining" },
  { id: "12", timestamp: "14:55:18.667", level: "info", service: "notification-svc", message: "Email queued: password_reset to user@example.com" },
];

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

  const filtered = logs.filter(l => {
    if (levelFilter !== "all" && l.level !== levelFilter) return false;
    if (search && !l.message.toLowerCase().includes(search.toLowerCase()) && !l.service.includes(search)) return false;
    return true;
  });

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
          {filtered.map(log => (
            <motion.div
              key={log.id}
              variants={item}
              className="flex items-start gap-3 px-4 py-2.5 font-mono text-xs hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <span className="shrink-0 text-muted-foreground w-[90px]">{log.timestamp}</span>
              <span className={`shrink-0 w-12 rounded px-1.5 py-0.5 text-center font-medium uppercase ${levelBg[log.level]} ${levelColors[log.level]}`}>
                {log.level}
              </span>
              <span className="shrink-0 w-[120px] truncate text-muted-foreground">{log.service}</span>
              <span className="flex-1 text-foreground break-all">{log.message}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
