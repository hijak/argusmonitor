import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Sparkline } from "@/components/Sparkline";
import { Search, Plus, Server, Database, Container, Wifi, Filter } from "lucide-react";
import { motion } from "framer-motion";

type HostType = "server" | "database" | "container" | "network";

interface Host {
  id: string;
  name: string;
  type: HostType;
  status: "healthy" | "warning" | "critical";
  ip: string;
  cpu: number;
  mem: number;
  uptime: string;
  os: string;
  tags: string[];
  spark: number[];
}

const hosts: Host[] = [
  { id: "1", name: "api-prod-01", type: "server", status: "healthy", ip: "10.0.1.10", cpu: 34, mem: 62, uptime: "45d", os: "Ubuntu 22.04", tags: ["production", "api"], spark: [45,42,38,35,34,36,34] },
  { id: "2", name: "api-prod-02", type: "server", status: "healthy", ip: "10.0.1.11", cpu: 28, mem: 55, uptime: "45d", os: "Ubuntu 22.04", tags: ["production", "api"], spark: [30,32,28,27,29,28,28] },
  { id: "3", name: "db-primary", type: "database", status: "warning", ip: "10.0.2.5", cpu: 78, mem: 85, uptime: "120d", os: "Ubuntu 22.04", tags: ["production", "database"], spark: [60,65,70,72,75,78,78] },
  { id: "4", name: "db-replica-01", type: "database", status: "healthy", ip: "10.0.2.6", cpu: 45, mem: 70, uptime: "120d", os: "Ubuntu 22.04", tags: ["production", "database"], spark: [42,44,45,44,45,45,45] },
  { id: "5", name: "web-prod-01", type: "server", status: "healthy", ip: "10.0.1.20", cpu: 22, mem: 41, uptime: "30d", os: "Alpine 3.18", tags: ["production", "web"], spark: [20,22,21,23,22,22,22] },
  { id: "6", name: "cache-redis-01", type: "database", status: "healthy", ip: "10.0.3.10", cpu: 15, mem: 72, uptime: "90d", os: "Debian 12", tags: ["production", "cache"], spark: [14,15,16,15,14,15,15] },
  { id: "7", name: "worker-03", type: "container", status: "critical", ip: "10.0.4.3", cpu: 95, mem: 92, uptime: "2d", os: "Docker", tags: ["production", "worker"], spark: [70,75,80,85,90,93,95] },
  { id: "8", name: "lb-prod-01", type: "network", status: "healthy", ip: "10.0.0.1", cpu: 8, mem: 22, uptime: "365d", os: "HAProxy 2.8", tags: ["production", "loadbalancer"], spark: [7,8,9,8,7,8,8] },
  { id: "9", name: "k8s-node-01", type: "container", status: "healthy", ip: "10.0.5.1", cpu: 52, mem: 68, uptime: "15d", os: "Flatcar", tags: ["production", "kubernetes"], spark: [48,50,52,51,52,52,52] },
  { id: "10", name: "monitor-01", type: "server", status: "healthy", ip: "10.0.1.100", cpu: 42, mem: 58, uptime: "60d", os: "Ubuntu 22.04", tags: ["internal", "monitoring"], spark: [40,41,43,42,41,42,42] },
];

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

  const filtered = hosts.filter(h => {
    if (typeFilter !== "all" && h.type !== typeFilter) return false;
    if (search && !h.name.toLowerCase().includes(search.toLowerCase()) && !h.ip.includes(search)) return false;
    return true;
  });

  const counts = {
    all: hosts.length,
    server: hosts.filter(h => h.type === "server").length,
    database: hosts.filter(h => h.type === "database").length,
    container: hosts.filter(h => h.type === "container").length,
    network: hosts.filter(h => h.type === "network").length,
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

      {/* Filters */}
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

      {/* Host List */}
      <motion.div variants={item} className="rounded-lg border border-border bg-card">
        {/* Header */}
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
          {filtered.map(host => {
            const Icon = typeIcons[host.type];
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
                    <p className="text-xs text-muted-foreground">{host.ip}</p>
                  </div>
                </div>
                <StatusBadge variant={host.status}>{host.status}</StatusBadge>
                <span className={`font-mono text-sm ${host.cpu > 80 ? 'text-critical' : host.cpu > 60 ? 'text-warning' : 'text-foreground'}`}>{host.cpu}%</span>
                <span className={`font-mono text-sm ${host.mem > 80 ? 'text-critical' : host.mem > 60 ? 'text-warning' : 'text-foreground'}`}>{host.mem}%</span>
                <span className="font-mono text-sm text-muted-foreground">{host.uptime}</span>
                <Sparkline
                  data={host.spark}
                  color={host.status === "critical" ? "hsl(0 84% 60%)" : host.status === "warning" ? "hsl(38 92% 50%)" : "hsl(160 84% 39%)"}
                  width={64}
                  height={20}
                />
                <div className="flex gap-1 overflow-hidden">
                  {host.tags.slice(0, 2).map(tag => (
                    <span key={tag} className="truncate rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{tag}</span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
