import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Bell, User } from "lucide-react";
import { motion } from "framer-motion";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.02 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

export default function AlertsPage() {
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const [showAcked, setShowAcked] = useState(true);
  const queryClient = useQueryClient();

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => api.listAlerts(),
    refetchInterval: 15000,
  });

  const ackMutation = useMutation({
    mutationFn: (id: string) => api.acknowledgeAlert(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const filtered = alerts.filter((a: any) => {
    if (filter !== "all" && a.severity !== filter) return false;
    if (!showAcked && a.acknowledged) return false;
    return true;
  });

  const counts = {
    all: alerts.length,
    critical: alerts.filter((a: any) => a.severity === "critical").length,
    warning: alerts.filter((a: any) => a.severity === "warning").length,
    info: alerts.filter((a: any) => a.severity === "info").length,
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
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
          {filtered.map((alert: any) => (
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
                  <span>{alert.service || "Unknown"}</span>
                  <span>•</span>
                  <span className="font-mono">{alert.host || "N/A"}</span>
                  <span>•</span>
                  <span>{timeAgo(alert.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {alert.acknowledged_by && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />{alert.acknowledged_by}
                  </span>
                )}
                <StatusBadge variant={alert.severity === "info" ? "info" : alert.severity === "critical" ? "critical" : "warning"}>
                  {alert.severity}
                </StatusBadge>
                {!alert.acknowledged && (
                  <button
                    onClick={() => ackMutation.mutate(alert.id)}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                  >
                    Ack
                  </button>
                )}
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">No alerts matching filters</div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
