import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Sparkline } from "@/components/Sparkline";
import { Search, Plus, Server, Database, Container, Wifi } from "lucide-react";
import { motion } from "framer-motion";

type HostType = "server" | "database" | "container" | "network";

const typeIcons: Record<HostType, typeof Server> = {
  server: Server,
  database: Database,
  container: Container,
  network: Wifi,
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.02 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

export default function InfrastructurePage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<HostType | "all">("all");
  const queryClient = useQueryClient();

  const { data: hosts = [], isLoading } = useQuery({
    queryKey: ["hosts", typeFilter, search],
    queryFn: () => api.listHosts({ type: typeFilter === "all" ? undefined : typeFilter, search: search || undefined }),
    refetchInterval: 30000,
  });

  const { data: allHosts = [] } = useQuery({
    queryKey: ["hosts-all"],
    queryFn: () => api.listHosts(),
    refetchInterval: 60000,
  });

  const counts = {
    all: allHosts.length,
    server: allHosts.filter((h: any) => h.type === "server").length,
    database: allHosts.filter((h: any) => h.type === "database").length,
    container: allHosts.filter((h: any) => h.type === "container").length,
    network: allHosts.filter((h: any) => h.type === "network").length,
  };

  return (
    <motion.div className="p-6 space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Infrastructure" description="Monitored hosts and devices">
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Add Host
          </button>
        </PageHeader>
      </motion.div>

      <motion.div variants={item} className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search hosts..."
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {(["all", "server", "database", "container", "network"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)} ({counts[t]})
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div variants={item} className="rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[1fr_100px_80px_80px_80px_80px_100px] items-center gap-4 border-b border-border px-5 py-3 text-xs font-medium text-muted-foreground">
          <span>Host</span>
          <span>Status</span>
          <span>CPU</span>
          <span>Memory</span>
          <span>Uptime</span>
          <span>Trend</span>
          <span>Tags</span>
        </div>
        <div className="divide-y divide-border">
          {hosts.map((host: any) => {
            const Icon = typeIcons[host.type as HostType] || Server;
            return (
              <motion.div
                key={host.id}
                variants={item}
                className="grid grid-cols-[1fr_100px_80px_80px_80px_80px_100px] items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-hover cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm">{host.name}</p>
                    <p className="text-xs text-muted-foreground">{host.ip_address}</p>
                  </div>
                </div>
                <StatusBadge variant={host.status}>{host.status}</StatusBadge>
                <span className={`font-mono text-sm ${host.cpu_percent > 80 ? 'text-critical' : host.cpu_percent > 60 ? 'text-warning' : 'text-foreground'}`}>{Math.round(host.cpu_percent)}%</span>
                <span className={`font-mono text-sm ${host.memory_percent > 80 ? 'text-critical' : host.memory_percent > 60 ? 'text-warning' : 'text-foreground'}`}>{Math.round(host.memory_percent)}%</span>
                <span className="font-mono text-sm text-muted-foreground">{host.uptime || "N/A"}</span>
                <Sparkline
                  data={host.spark || []}
                  color={host.status === "critical" ? "hsl(0 84% 60%)" : host.status === "warning" ? "hsl(38 92% 50%)" : "hsl(160 84% 39%)"}
                  width={64}
                  height={20}
                />
                <div className="flex gap-1 overflow-hidden">
                  {(host.tags || []).slice(0, 2).map((tag: string) => (
                    <span key={tag} className="truncate rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{tag}</span>
                  ))}
                </div>
              </motion.div>
            );
          })}
          {isLoading && (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Loading hosts...</div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
