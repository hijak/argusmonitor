import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Bell, CheckCircle, Clock, Filter, User } from "lucide-react";
import { motion } from "framer-motion";

interface Alert {
  id: string;
  message: string;
  severity: "critical" | "warning" | "info";
  service: string;
  host: string;
  time: string;
  acknowledged: boolean;
  assignee?: string;
}

const alerts: Alert[] = [
  { id: "1", message: "CPU usage > 90% for 5 minutes", severity: "critical", service: "Worker Pool", host: "worker-03", time: "2 min ago", acknowledged: false },
  { id: "2", message: "Database replication lag exceeds 5s", severity: "warning", service: "Database", host: "db-primary", time: "15 min ago", acknowledged: false },
  { id: "3", message: "SSL certificate expires in 7 days", severity: "warning", service: "API Gateway", host: "lb-prod-01", time: "1 hour ago", acknowledged: true, assignee: "Alice" },
  { id: "4", message: "Transaction 'Checkout' success rate below 98%", severity: "critical", service: "E-Commerce", host: "api-prod-01", time: "3 hours ago", acknowledged: true, assignee: "Bob" },
  { id: "5", message: "Disk usage > 80%", severity: "warning", service: "Monitoring", host: "monitor-01", time: "5 hours ago", acknowledged: false },
  { id: "6", message: "Memory usage > 85%", severity: "warning", service: "Database", host: "db-primary", time: "6 hours ago", acknowledged: true, assignee: "Alice" },
  { id: "7", message: "Response time > 2s on /api/users", severity: "info", service: "API", host: "api-prod-02", time: "8 hours ago", acknowledged: true, assignee: "Charlie" },
  { id: "8", message: "Container restart detected", severity: "critical", service: "Worker Pool", host: "worker-03", time: "12 hours ago", acknowledged: true, assignee: "Bob" },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.02 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

export default function AlertsPage() {
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const [showAcked, setShowAcked] = useState(true);

  const filtered = alerts.filter(a => {
    if (filter !== "all" && a.severity !== filter) return false;
    if (!showAcked && a.acknowledged) return false;
    return true;
  });

  const counts = {
    all: alerts.length,
    critical: alerts.filter(a => a.severity === "critical").length,
    warning: alerts.filter(a => a.severity === "warning").length,
    info: alerts.filter(a => a.severity === "info").length,
  };

  return (
    <motion.div className="p-6 space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Alerts" description="Active and recent alerts across all services">
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Bell className="h-4 w-4" />
            Create Alert Rule
          </button>
        </PageHeader>
      </motion.div>

      <motion.div variants={item} className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {(["all", "critical", "warning", "info"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAcked(v => !v)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            showAcked ? "border-border text-muted-foreground" : "border-primary/30 text-primary bg-primary/5"
          }`}
        >
          {showAcked ? "Hide Acknowledged" : "Show Acknowledged"}
        </button>
      </motion.div>

      <motion.div variants={item} className="rounded-lg border border-border bg-card">
        <div className="divide-y divide-border">
          {filtered.map(alert => (
            <motion.div
              key={alert.id}
              variants={item}
              className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-hover ${alert.acknowledged ? "opacity-60" : ""}`}
            >
              <div className={`h-2 w-2 rounded-full shrink-0 ${
                alert.severity === "critical" ? "bg-critical pulse-live" :
                alert.severity === "warning" ? "bg-warning" : "bg-primary"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{alert.message}</p>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{alert.service}</span>
                  <span>•</span>
                  <span className="font-mono">{alert.host}</span>
                  <span>•</span>
                  <span>{alert.time}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {alert.assignee && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />{alert.assignee}
                  </span>
                )}
                <StatusBadge variant={alert.severity === "info" ? "info" : alert.severity === "critical" ? "critical" : "warning"}>
                  {alert.severity}
                </StatusBadge>
                {!alert.acknowledged && (
                  <button className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">
                    Ack
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
