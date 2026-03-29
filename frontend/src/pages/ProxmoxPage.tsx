import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Boxes,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  HardDrive,
  Loader2,
  MonitorSmartphone,
  Network,
  Plus,
  RefreshCw,
  Search,
  Server,
  Shield,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { PCheckbox1 } from "@/components/patterns/p-checkbox-1";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "overview", label: "Overview", icon: Boxes },
  { key: "nodes", label: "Nodes", icon: Server },
  { key: "vms", label: "VMs", icon: MonitorSmartphone },
  { key: "containers", label: "LXCs", icon: Database },
  { key: "storage", label: "Storage", icon: HardDrive },
  { key: "tasks", label: "Tasks", icon: Clock },
] as const;

type TabKey = (typeof tabs)[number]["key"];

type ProxmoxClusterForm = {
  name: string;
  base_url: string;
  token_id: string;
  token_secret: string;
  username: string;
  password: string;
  verify_tls: boolean;
};

const emptyForm: ProxmoxClusterForm = {
  name: "",
  base_url: "",
  token_id: "",
  token_secret: "",
  username: "",
  password: "",
  verify_tls: true,
};

function fmtBytes(value?: number) {
  const num = Number(value || 0);
  if (!num) return "-";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let idx = 0;
  let n = num;
  while (n >= 1024 && idx < units.length - 1) {
    n /= 1024;
    idx += 1;
  }
  return `${n.toFixed(n >= 10 ? 0 : 1)} ${units[idx]}`;
}

function fmtAge(date?: string) {
  if (!date) return "-";
  const then = new Date(date).getTime();
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function fmtDuration(seconds?: number) {
  const s = Math.max(0, Number(seconds || 0));
  if (!s) return "-";
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins || 1}m`;
}

function fmtPercent(value?: number) {
  return `${Math.round(Number(value || 0))}%`;
}

function statusVariant(status?: string): "healthy" | "warning" | "critical" | "unknown" | "info" {
  const value = String(status || "unknown").toLowerCase();
  if (["running", "online", "healthy", "ok", "success"].includes(value)) return "healthy";
  if (["warning", "degraded", "pending", "queued", "starting"].includes(value)) return "warning";
  if (["stopped", "offline", "failed", "error", "critical"].some((part) => value.includes(part))) return "critical";
  if (["unavailable", "unknown"].includes(value)) return "unknown";
  return "info";
}

function formatStateLabel(key: string) {
  return key.replace(/_/g, " ");
}

function utilizationPct(used?: number, total?: number) {
  const t = Number(total || 0);
  if (!t) return 0;
  return Math.max(0, Math.min(100, (Number(used || 0) / t) * 100));
}

function SummaryCard({
  label,
  value,
  sublabel,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  tone?: "default" | "healthy" | "warning" | "critical";
  icon: any;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
          {sublabel && <div className="mt-1 text-xs text-muted-foreground">{sublabel}</div>}
        </div>
        <div
          className={cn(
            "rounded-lg p-2",
            tone === "healthy" && "bg-success/10 text-success",
            tone === "warning" && "bg-warning/10 text-warning",
            tone === "critical" && "bg-critical/10 text-critical",
            tone === "default" && "bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ value, tone = "default" }: { value: number; tone?: "default" | "warning" | "critical" | "healthy" }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          tone === "healthy" && "bg-success",
          tone === "warning" && "bg-warning",
          tone === "critical" && "bg-critical",
          tone === "default" && "bg-primary"
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function StatePill({ label, value, variant }: { label: string; value: number; variant: "healthy" | "warning" | "critical" | "unknown" | "info" }) {
  return (
    <div className="rounded-lg border border-border bg-surface/60 px-3 py-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="capitalize text-muted-foreground">{label}</span>
        <StatusBadge variant={variant}>{value}</StatusBadge>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[112px_1fr] gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("break-all text-foreground", mono && "font-mono text-xs")}>{value || "-"}</span>
    </div>
  );
}

export default function ProxmoxPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTabFromUrl = (searchParams.get("tab") as TabKey | null) || "overview";
  const initialClusterFromUrl = searchParams.get("cluster");
  const [selectedCluster, setSelectedCluster] = useState<string | null>(initialClusterFromUrl);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTabFromUrl);
  const [selectedResource, setSelectedResource] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [showAddCluster, setShowAddCluster] = useState(false);
  const [form, setForm] = useState<ProxmoxClusterForm>(emptyForm);

  const { data: clusters = [] } = useQuery({
    queryKey: ["proxmox-clusters"],
    queryFn: api.listProxmoxClusters,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!selectedCluster && clusters.length) setSelectedCluster(clusters[0].id);
  }, [clusters, selectedCluster]);

  useEffect(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", activeTab);
      if (selectedCluster) next.set("cluster", selectedCluster);
      else next.delete("cluster");
      return next;
    }, { replace: true });
  }, [activeTab, selectedCluster, setSearchParams]);

  useEffect(() => {
    setSelectedResource(null);
    setSearch("");
  }, [selectedCluster, activeTab]);

  const selectedClusterData = clusters.find((c: any) => c.id === selectedCluster) ?? null;

  const { data: stats } = useQuery({
    queryKey: ["proxmox-stats", selectedCluster],
    queryFn: () => api.getProxmoxClusterStats(selectedCluster!),
    enabled: !!selectedCluster,
    refetchInterval: 30000,
  });

  const { data: nodes = [] } = useQuery({
    queryKey: ["proxmox-nodes", selectedCluster],
    queryFn: () => api.listProxmoxNodes(selectedCluster!),
    enabled: !!selectedCluster,
    refetchInterval: 30000,
  });

  const { data: vms = [] } = useQuery({
    queryKey: ["proxmox-vms", selectedCluster, search],
    queryFn: () => api.listProxmoxVMs(selectedCluster!, search || undefined),
    enabled: !!selectedCluster,
    refetchInterval: 30000,
  });

  const { data: containers = [] } = useQuery({
    queryKey: ["proxmox-containers", selectedCluster, search],
    queryFn: () => api.listProxmoxContainers(selectedCluster!, search || undefined),
    enabled: !!selectedCluster,
    refetchInterval: 30000,
  });

  const { data: storage = [] } = useQuery({
    queryKey: ["proxmox-storage", selectedCluster],
    queryFn: () => api.listProxmoxStorage(selectedCluster!),
    enabled: !!selectedCluster,
    refetchInterval: 30000,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["proxmox-tasks", selectedCluster],
    queryFn: () => api.listProxmoxTasks(selectedCluster!, 100),
    enabled: !!selectedCluster,
    refetchInterval: 30000,
  });

  const selectedVmDetailsQuery = useQuery({
    queryKey: ["proxmox-vm", selectedCluster, selectedResource?.vmid],
    queryFn: () => api.getProxmoxVM(selectedCluster!, Number(selectedResource?.vmid)),
    enabled: !!selectedCluster && activeTab === "vms" && !!selectedResource?.vmid,
  });

  const invalidateProxmoxQueries = () =>
    queryClient.invalidateQueries({
      predicate: (query) => String(query.queryKey?.[0] || "").startsWith("proxmox"),
    });

  const createMutation = useMutation({
    mutationFn: api.createProxmoxCluster,
    onSuccess: (createdCluster) => {
      invalidateProxmoxQueries();
      setSelectedCluster(createdCluster.id);
      setActiveTab("overview");
      setSelectedResource(null);
      setShowAddCluster(false);
      setForm(emptyForm);
    },
  });

  const discoverMutation = useMutation({
    mutationFn: api.discoverProxmoxCluster,
    onSuccess: () => invalidateProxmoxQueries(),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteProxmoxCluster,
    onSuccess: () => {
      invalidateProxmoxQueries();
      setSelectedCluster(null);
      setSelectedResource(null);
    },
  });

  const rawItems = useMemo(() => {
    switch (activeTab) {
      case "nodes":
        return nodes;
      case "vms":
        return vms;
      case "containers":
        return containers;
      case "storage":
        return storage;
      case "tasks":
        return tasks;
      default:
        return [];
    }
  }, [activeTab, nodes, vms, containers, storage, tasks]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rawItems;
    return rawItems.filter((item: any) => {
      const hay = [
        item.node,
        item.name,
        item.status,
        item.storage,
        item.task_type,
        item.user,
        item.description,
        item.resource_id,
        item.guest_hostname,
        item.guest_primary_ip,
        item.guest_os,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rawItems, search]);

  const selectedDetails = activeTab === "vms" ? selectedVmDetailsQuery.data ?? selectedResource : selectedResource;

  const runningVms = vms.filter((vm: any) => String(vm.status).toLowerCase() === "running");
  const guestAgentRunning = runningVms.filter((vm: any) => vm.guest_agent_status === "running");
  const onlineNodes = nodes.filter((node: any) => String(node.status).toLowerCase() === "online");
  const warningTasks = tasks.filter((task: any) => String(task.status || "").toLowerCase().includes("error"));
  const totalStorageBytes = storage.reduce((sum: number, row: any) => sum + Number(row.total_bytes || 0), 0);
  const usedStorageBytes = storage.reduce((sum: number, row: any) => sum + Number(row.used_bytes || 0), 0);
  const topVmsByMemory = [...vms]
    .sort((a: any, b: any) => Number(b.memory_used_bytes || 0) - Number(a.memory_used_bytes || 0))
    .slice(0, 5);

  const tabCounts: Record<TabKey, number | null> = {
    overview: null,
    nodes: nodes.length,
    vms: vms.length,
    containers: containers.length,
    storage: storage.length,
    tasks: tasks.length,
  };

  const overviewStateGroups = [
    {
      title: "Node state",
      items: Object.entries(stats?.nodes_by_status || {}),
    },
    {
      title: "VM state",
      items: Object.entries(stats?.vms_by_status || {}),
    },
    {
      title: "LXC state",
      items: Object.entries(stats?.containers_by_status || {}),
    },
  ];

  const renderRows = (items: any[]) => {
    if (activeTab === "nodes") {
      return items.map((node: any) => {
        const memPct = utilizationPct(node.memory_used_bytes, node.memory_total_bytes);
        return (
          <tr
            key={node.id}
            className="cursor-pointer border-b border-border/60 transition-colors hover:bg-surface/60"
            onClick={() => setSelectedResource(node)}
          >
            <td className="px-4 py-3 align-top">
              <div className="font-mono text-xs text-foreground">{node.node}</div>
              <div className="mt-1 text-xs text-muted-foreground">{node.ip_address || "No IP reported"}</div>
            </td>
            <td className="px-4 py-3 align-top">
              <StatusBadge variant={statusVariant(node.status)}>{node.status || "unknown"}</StatusBadge>
            </td>
            <td className="px-4 py-3 align-top font-mono text-xs">{fmtPercent(node.cpu_percent)}</td>
            <td className="px-4 py-3 align-top min-w-[180px]">
              <div className="mb-1 flex items-center justify-between gap-3 font-mono text-xs">
                <span>{fmtBytes(node.memory_used_bytes)}</span>
                <span className="text-muted-foreground">{fmtBytes(node.memory_total_bytes)}</span>
              </div>
              <ProgressBar value={memPct} tone={memPct > 90 ? "critical" : memPct > 75 ? "warning" : "healthy"} />
            </td>
            <td className="px-4 py-3 align-top font-mono text-xs">{node.max_cpu || 0}</td>
            <td className="px-4 py-3 align-top font-mono text-xs">{fmtDuration(node.uptime_seconds)}</td>
          </tr>
        );
      });
    }

    if (activeTab === "vms") {
      return items.map((vm: any) => {
        const memPct = utilizationPct(vm.memory_used_bytes, vm.memory_total_bytes);
        return (
          <tr
            key={vm.id}
            className="cursor-pointer border-b border-border/60 transition-colors hover:bg-surface/60"
            onClick={() => setSelectedResource(vm)}
          >
            <td className="px-4 py-3 align-top">
              <div className="font-mono text-xs text-foreground">{vm.vmid}</div>
              <div className="mt-1 text-sm font-medium">{vm.name}</div>
            </td>
            <td className="px-4 py-3 align-top">
              <div className="text-sm text-foreground">{vm.guest_hostname || "-"}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">{vm.guest_os || "No guest data"}</div>
            </td>
            <td className="px-4 py-3 align-top text-sm">{vm.node || "-"}</td>
            <td className="px-4 py-3 align-top">
              <StatusBadge variant={statusVariant(vm.status)}>{vm.status || "unknown"}</StatusBadge>
            </td>
            <td className="px-4 py-3 align-top">
              <StatusBadge variant={statusVariant(vm.guest_agent_status)}>{vm.guest_agent_status || "unknown"}</StatusBadge>
            </td>
            <td className="px-4 py-3 align-top font-mono text-xs">{vm.guest_primary_ip || "-"}</td>
            <td className="px-4 py-3 align-top min-w-[180px]">
              <div className="mb-1 flex items-center justify-between gap-3 font-mono text-xs">
                <span>{fmtBytes(vm.memory_used_bytes)}</span>
                <span className="text-muted-foreground">{fmtBytes(vm.memory_total_bytes)}</span>
              </div>
              <ProgressBar value={memPct} tone={memPct > 90 ? "critical" : memPct > 75 ? "warning" : "healthy"} />
            </td>
          </tr>
        );
      });
    }

    if (activeTab === "containers") {
      return items.map((ct: any) => {
        const memPct = utilizationPct(ct.memory_used_bytes, ct.memory_total_bytes);
        return (
          <tr
            key={ct.id}
            className="cursor-pointer border-b border-border/60 transition-colors hover:bg-surface/60"
            onClick={() => setSelectedResource(ct)}
          >
            <td className="px-4 py-3 align-top">
              <div className="font-mono text-xs text-foreground">{ct.vmid}</div>
              <div className="mt-1 text-sm font-medium">{ct.name}</div>
            </td>
            <td className="px-4 py-3 align-top text-sm">{ct.node || "-"}</td>
            <td className="px-4 py-3 align-top">
              <StatusBadge variant={statusVariant(ct.status)}>{ct.status || "unknown"}</StatusBadge>
            </td>
            <td className="px-4 py-3 align-top font-mono text-xs">{fmtPercent(ct.cpu_percent)}</td>
            <td className="px-4 py-3 align-top min-w-[180px]">
              <div className="mb-1 flex items-center justify-between gap-3 font-mono text-xs">
                <span>{fmtBytes(ct.memory_used_bytes)}</span>
                <span className="text-muted-foreground">{fmtBytes(ct.memory_total_bytes)}</span>
              </div>
              <ProgressBar value={memPct} tone={memPct > 90 ? "critical" : memPct > 75 ? "warning" : "healthy"} />
            </td>
            <td className="px-4 py-3 align-top font-mono text-xs">{fmtDuration(ct.uptime_seconds)}</td>
          </tr>
        );
      });
    }

    if (activeTab === "storage") {
      return items.map((row: any) => {
        const usagePct = utilizationPct(row.used_bytes, row.total_bytes);
        return (
          <tr
            key={row.id}
            className="cursor-pointer border-b border-border/60 transition-colors hover:bg-surface/60"
            onClick={() => setSelectedResource(row)}
          >
            <td className="px-4 py-3 align-top">
              <div className="font-mono text-xs text-foreground">{row.storage}</div>
              <div className="mt-1 text-xs text-muted-foreground">{row.node || "cluster-wide"}</div>
            </td>
            <td className="px-4 py-3 align-top text-sm">{row.storage_type || "-"}</td>
            <td className="px-4 py-3 align-top">
              <StatusBadge variant={statusVariant(row.status)}>{row.status || "unknown"}</StatusBadge>
            </td>
            <td className="px-4 py-3 align-top text-sm">{row.shared ? "Shared" : "Local"}</td>
            <td className="px-4 py-3 align-top min-w-[200px]">
              <div className="mb-1 flex items-center justify-between gap-3 font-mono text-xs">
                <span>{fmtBytes(row.used_bytes)}</span>
                <span className="text-muted-foreground">{fmtBytes(row.total_bytes)}</span>
              </div>
              <ProgressBar value={usagePct} tone={usagePct > 90 ? "critical" : usagePct > 75 ? "warning" : "healthy"} />
            </td>
            <td className="px-4 py-3 align-top text-xs text-muted-foreground">{row.content || "-"}</td>
          </tr>
        );
      });
    }

    if (activeTab === "tasks") {
      return items.map((task: any) => (
        <tr
          key={task.id}
          className="cursor-pointer border-b border-border/60 transition-colors hover:bg-surface/60"
          onClick={() => setSelectedResource(task)}
        >
          <td className="px-4 py-3 align-top">
            <div className="font-mono text-xs text-foreground">{task.task_type || "task"}</div>
            <div className="mt-1 text-xs text-muted-foreground">{task.resource_id || task.upid?.slice(0, 48) || "-"}</div>
          </td>
          <td className="px-4 py-3 align-top text-sm">{task.node || "-"}</td>
          <td className="px-4 py-3 align-top">
            <StatusBadge variant={statusVariant(task.status)}>{task.status || "unknown"}</StatusBadge>
          </td>
          <td className="px-4 py-3 align-top text-sm">{task.user || "-"}</td>
          <td className="px-4 py-3 align-top font-mono text-xs">{fmtAge(task.start_time || task.last_seen)}</td>
          <td className="px-4 py-3 align-top font-mono text-xs">{task.duration_seconds ? fmtDuration(task.duration_seconds) : "-"}</td>
        </tr>
      ));
    }

    return null;
  };

  const heads = {
    nodes: ["Node", "Status", "CPU", "Memory", "Cores", "Uptime"],
    vms: ["VM", "Guest", "Node", "Status", "Agent", "Primary IP", "Memory"],
    containers: ["LXC", "Node", "Status", "CPU", "Memory", "Uptime"],
    storage: ["Storage", "Type", "Status", "Mode", "Usage", "Content"],
    tasks: ["Task", "Node", "Status", "User", "Age", "Duration"],
  } as const;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Proxmox"
        description="Cluster summary, guest-aware VM inventory, storage pressure, and recent tasks in one operator view."
      >
        <button
          onClick={() => setShowAddCluster(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-background/60 px-3 py-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Selected cluster</div>
            <div className="mt-1 text-sm font-medium text-foreground">{selectedClusterData?.name || selectedClusterData?.cluster_name || selectedCluster || "No cluster selected"}</div>
          </div>
          <div className="rounded-lg border border-border bg-background/60 px-3 py-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Cluster count</div>
            <div className="mt-1 text-sm font-medium text-foreground">{clusters.length}</div>
          </div>
          <div className="rounded-lg border border-border bg-background/60 px-3 py-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Current view</div>
            <div className="mt-1 text-sm font-medium capitalize text-foreground">{activeTab}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-start gap-2 lg:justify-end">
          <Link to={`/?`} className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">Dashboard</Link>
          <Link to={`/proxmox?tab=overview${selectedCluster ? `&cluster=${selectedCluster}` : ''}`} className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">Overview</Link>
          <Link to={`/proxmox?tab=guests${selectedCluster ? `&cluster=${selectedCluster}` : ''}`} className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">Guests</Link>
          <Link to={`/proxmox?tab=nodes${selectedCluster ? `&cluster=${selectedCluster}` : ''}`} className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">Nodes</Link>
          <Link to={`/proxmox?tab=tasks${selectedCluster ? `&cluster=${selectedCluster}` : ''}`} className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">Tasks</Link>
          <Link to="/kubernetes?tab=overview" className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">Kubernetes</Link>
          <Link to="/swarm?tab=overview" className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">Swarm</Link>
        </div>
      </div>
          Add Proxmox
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.45fr)_420px] xl:grid-cols-[minmax(0,1.25fr)_380px]">
        <div className="space-y-4">
          {selectedClusterData && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">{selectedClusterData.name}</h2>
                    <StatusBadge variant={statusVariant(selectedClusterData.status)}>{selectedClusterData.status}</StatusBadge>
                    {selectedClusterData.version && <StatusBadge variant="info">{selectedClusterData.version}</StatusBadge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedClusterData.cluster_name || selectedClusterData.name} · last seen {fmtAge(selectedClusterData.last_seen)}
                  </p>
                  {selectedClusterData.cluster_name &&
                    selectedClusterData.cluster_name !== selectedClusterData.name &&
                    selectedClusterData.node_count > 1 && (
                      <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
                        This endpoint is a{" "}
                        <span className="font-medium text-foreground">member of cluster {selectedClusterData.cluster_name}</span>. Vordr is
                        showing the whole cluster view across{" "}
                        <span className="font-medium text-foreground">{selectedClusterData.node_count} nodes</span>, not just the single node
                        you connected to.
                      </div>
                    )}
                  {selectedClusterData.error_message && (
                    <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                      {selectedClusterData.error_message}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => discoverMutation.mutate(selectedClusterData.id)}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-surface"
                  >
                    <RefreshCw className={cn("h-4 w-4", discoverMutation.isPending && "animate-spin")} />
                    Refresh
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(selectedClusterData.id)}
                    className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-surface hover:text-critical"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                <SummaryCard
                  label="Nodes online"
                  value={`${onlineNodes.length}/${nodes.length}`}
                  sublabel={nodes.length ? `${nodes.length - onlineNodes.length} not online` : "No nodes discovered"}
                  icon={Server}
                  tone={onlineNodes.length === nodes.length && nodes.length > 0 ? "healthy" : nodes.length ? "warning" : "default"}
                />
                <SummaryCard
                  label="Running VMs"
                  value={runningVms.length}
                  sublabel={`${vms.length} total VMs`}
                  icon={MonitorSmartphone}
                  tone="default"
                />
                <SummaryCard
                  label="Guest agent coverage"
                  value={runningVms.length ? `${guestAgentRunning.length}/${runningVms.length}` : "-"}
                  sublabel="running VMs with QEMU guest agent data"
                  icon={Shield}
                  tone={
                    runningVms.length && guestAgentRunning.length === runningVms.length
                      ? "healthy"
                      : guestAgentRunning.length
                      ? "warning"
                      : "critical"
                  }
                />
                <SummaryCard
                  label="Storage used"
                  value={fmtBytes(usedStorageBytes)}
                  sublabel={
                    totalStorageBytes
                      ? `${Math.round((usedStorageBytes / totalStorageBytes) * 100)}% of ${fmtBytes(totalStorageBytes)}`
                      : "No storage discovered"
                  }
                  icon={HardDrive}
                  tone={
                    totalStorageBytes && usedStorageBytes / totalStorageBytes > 0.9
                      ? "critical"
                      : totalStorageBytes && usedStorageBytes / totalStorageBytes > 0.75
                      ? "warning"
                      : "healthy"
                  }
                />
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card">
            <div className="sticky top-0 z-20 border-b border-border bg-card px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const selected = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                        selected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                      {tabCounts[tab.key] !== null && (
                        <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", selected ? "bg-primary/10" : "bg-muted")}>
                          {tabCounts[tab.key]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {activeTab !== "overview" && (
                <div className="mt-3 relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={`Search ${activeTab} by name, node, status${activeTab === "vms" ? ", hostname or IP" : ""}...`}
                    className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm outline-none transition focus:border-primary/50"
                  />
                </div>
              )}
            </div>

            <div className="max-h-[820px] overflow-auto">
              {activeTab === "overview" && (
                <div className="space-y-4 p-4">
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {overviewStateGroups.map((group) => (
                      <div key={group.title} className="rounded-xl border border-border p-4">
                        <h3 className="mb-3 text-sm font-semibold">{group.title}</h3>
                        {group.items.length ? (
                          <div className="space-y-2">
                            {group.items.map(([key, value]) => (
                              <StatePill key={key} label={formatStateLabel(key)} value={Number(value)} variant={statusVariant(key)} />
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No data yet.</p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div className="rounded-xl border border-border p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold">Guest agent snapshot</h3>
                      </div>
                      {runningVms.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No running VMs right now.</p>
                      ) : (
                        <div className="space-y-2">
                          {runningVms.map((vm: any) => (
                            <button
                              key={vm.id}
                              onClick={() => {
                                setActiveTab("vms");
                                setSelectedResource(vm);
                              }}
                              className="flex w-full cursor-pointer items-start justify-between rounded-lg border border-border bg-surface/60 px-3 py-3 text-left transition hover:bg-surface"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{vm.name}</span>
                                  <span className="font-mono text-[11px] text-muted-foreground">#{vm.vmid}</span>
                                </div>
                                <div className="mt-1 truncate text-xs text-muted-foreground">
                                  {vm.guest_hostname || vm.node || "Unknown host"}
                                  {vm.guest_primary_ip ? ` · ${vm.guest_primary_ip}` : ""}
                                  {vm.guest_os ? ` · ${vm.guest_os}` : ""}
                                </div>
                              </div>
                              <StatusBadge variant={statusVariant(vm.guest_agent_status)}>{vm.guest_agent_status || "unknown"}</StatusBadge>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-border p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <h3 className="text-sm font-semibold">Recent failed tasks</h3>
                      </div>
                      {(stats?.recent_failed_tasks || []).length ? (
                        <div className="space-y-2">
                          {(stats?.recent_failed_tasks || []).map((task: any) => (
                            <button
                              key={task.id}
                              onClick={() => {
                                setActiveTab("tasks");
                                setSelectedResource(task);
                              }}
                              className="flex w-full cursor-pointer items-start justify-between rounded-lg border border-border bg-surface/60 px-3 py-3 text-left transition hover:bg-surface"
                            >
                              <div>
                                <div className="font-mono text-xs text-foreground">{task.task_type || task.upid?.slice(0, 28) || "task"}</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {task.node || "unknown node"} · {fmtAge(task.start_time || task.last_seen)}
                                </div>
                              </div>
                              <StatusBadge variant={statusVariant(task.status)}>{task.status || "unknown"}</StatusBadge>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No obvious failed tasks.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Top VM memory users</h3>
                    </div>
                    {topVmsByMemory.length ? (
                      <div className="space-y-3">
                        {topVmsByMemory.map((vm: any) => {
                          const pct = utilizationPct(vm.memory_used_bytes, vm.memory_total_bytes);
                          return (
                            <button
                              key={vm.id}
                              onClick={() => {
                                setActiveTab("vms");
                                setSelectedResource(vm);
                              }}
                              className="block w-full cursor-pointer rounded-lg border border-border bg-surface/50 px-3 py-3 text-left transition hover:bg-surface"
                            >
                              <div className="mb-1 flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-medium">{vm.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {vm.node} · {vm.guest_primary_ip || "No primary IP"}
                                  </div>
                                </div>
                                <div className="font-mono text-xs text-muted-foreground">
                                  {fmtBytes(vm.memory_used_bytes)} / {fmtBytes(vm.memory_total_bytes)}
                                </div>
                              </div>
                              <ProgressBar value={pct} tone={pct > 90 ? "critical" : pct > 75 ? "warning" : "healthy"} />
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No VM data yet.</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab !== "overview" && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      {heads[activeTab as keyof typeof heads].map((head) => (
                        <th key={head} className="px-4 py-3 font-medium">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>{renderRows(filteredItems)}</tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold">Clusters</h3>
              <span className="text-xs text-muted-foreground">{clusters.length}</span>
            </div>

            {clusters.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                No Proxmox clusters yet.
              </div>
            ) : (
              <div className="space-y-2">
                {clusters.map((cluster: any) => {
                  const selected = selectedCluster === cluster.id;
                  return (
                    <button
                      key={cluster.id}
                      onClick={() => setSelectedCluster(cluster.id)}
                      className={cn(
                        "w-full cursor-pointer rounded-xl border p-3 text-left transition",
                        selected
                          ? "border-primary/50 bg-primary/5 shadow-sm"
                          : "border-border bg-surface/40 hover:border-primary/30 hover:bg-surface/70"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <MonitorSmartphone className="h-4 w-4 shrink-0 text-primary" />
                            <span className="truncate text-sm font-medium">{cluster.name}</span>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{cluster.base_url}</p>
                        </div>
                        <StatusBadge variant={statusVariant(cluster.status)}>{cluster.status}</StatusBadge>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-lg bg-background/60 px-2 py-2">
                          <div className="font-semibold">{cluster.node_count}</div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Nodes</div>
                        </div>
                        <div className="rounded-lg bg-background/60 px-2 py-2">
                          <div className="font-semibold">{cluster.vm_count}</div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">VMs</div>
                        </div>
                        <div className="rounded-lg bg-background/60 px-2 py-2">
                          <div className="font-semibold">{cluster.container_count}</div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">LXCs</div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Seen {fmtAge(cluster.last_seen)}</span>
                        <span>Discovery {fmtAge(cluster.last_discovery)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Details</h3>
            </div>

            {!selectedDetails && (
              <div className="rounded-lg border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
                Pick a row to inspect it.
              </div>
            )}

            {selectedDetails && activeTab === "vms" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-surface/50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-semibold">{selectedDetails.name}</h4>
                        <span className="font-mono text-xs text-muted-foreground">#{selectedDetails.vmid}</span>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">{selectedDetails.node || "unknown node"}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge variant={statusVariant(selectedDetails.status)}>{selectedDetails.status || "unknown"}</StatusBadge>
                      <StatusBadge variant={statusVariant(selectedDetails.guest_agent_status)}>
                        {selectedDetails.guest_agent_status || "unknown"}
                      </StatusBadge>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-background/70 p-3">
                      <div className="text-xs text-muted-foreground">Guest hostname</div>
                      <div className="mt-1 text-sm font-medium">{selectedDetails.guest_hostname || "-"}</div>
                    </div>
                    <div className="rounded-lg bg-background/70 p-3">
                      <div className="text-xs text-muted-foreground">Primary IP</div>
                      <div className="mt-1 font-mono text-sm">{selectedDetails.guest_primary_ip || "-"}</div>
                    </div>
                    <div className="col-span-2 rounded-lg bg-background/70 p-3">
                      <div className="text-xs text-muted-foreground">Guest OS</div>
                      <div className="mt-1 text-sm font-medium">{selectedDetails.guest_os || "No guest OS data"}</div>
                      {selectedDetails.guest_kernel && (
                        <div className="mt-1 font-mono text-xs text-muted-foreground">{selectedDetails.guest_kernel}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <h4 className="mb-3 text-sm font-semibold">Runtime</h4>
                  <div className="space-y-3">
                    <DetailRow label="CPU" value={`${fmtPercent(selectedDetails.cpu_percent)} · ${selectedDetails.max_cpu || 0} vCPU`} />
                    <DetailRow
                      label="Memory"
                      value={`${fmtBytes(selectedDetails.memory_used_bytes)} / ${fmtBytes(selectedDetails.memory_total_bytes)}`}
                    />
                    <ProgressBar
                      value={utilizationPct(selectedDetails.memory_used_bytes, selectedDetails.memory_total_bytes)}
                      tone="healthy"
                    />
                    <DetailRow
                      label="Disk"
                      value={`${fmtBytes(selectedDetails.disk_used_bytes)} / ${fmtBytes(selectedDetails.disk_total_bytes)}`}
                    />
                    <DetailRow label="Uptime" value={fmtDuration(selectedDetails.uptime_seconds)} />
                    <DetailRow label="Pool" value={selectedDetails.pool} />
                    <DetailRow label="Tags" value={selectedDetails.tags} />
                    <DetailRow label="Last seen" value={fmtAge(selectedDetails.last_seen)} />
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Network className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold">Guest interfaces</h4>
                  </div>
                  {(selectedDetails.guest_interfaces || []).length ? (
                    <div className="space-y-3">
                      {(selectedDetails.guest_interfaces || []).map((iface: any) => (
                        <div key={iface.name} className="rounded-lg border border-border bg-surface/50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-medium">{iface.name || "interface"}</div>
                              <div className="font-mono text-xs text-muted-foreground">{iface["hardware-address"] || "-"}</div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              rx {fmtBytes(iface.statistics?.["rx-bytes"])} · tx {fmtBytes(iface.statistics?.["tx-bytes"])}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(iface["ip-addresses"] || []).map((ip: any) => (
                              <span
                                key={`${iface.name}-${ip["ip-address"]}`}
                                className="rounded-full border border-border bg-background/70 px-2.5 py-1 font-mono text-[11px]"
                              >
                                {ip["ip-address"]}/{ip.prefix}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No guest interface data yet. If the QEMU guest agent is enabled and running, it should appear here on refresh.
                    </p>
                  )}
                </div>
              </div>
            )}

            {selectedDetails && activeTab !== "vms" && (
              <div className="space-y-3">
                <DetailRow
                  label="Name"
                  value={selectedDetails.node || selectedDetails.name || selectedDetails.storage || selectedDetails.task_type}
                  mono={!!selectedDetails.vmid || !!selectedDetails.storage}
                />
                {selectedDetails.vmid !== undefined && <DetailRow label="VMID" value={selectedDetails.vmid} mono />}
                {selectedDetails.status !== undefined && <DetailRow label="Status" value={selectedDetails.status} />}
                {selectedDetails.node !== undefined && <DetailRow label="Node" value={selectedDetails.node} />}
                {selectedDetails.ip_address !== undefined && <DetailRow label="IP" value={selectedDetails.ip_address} mono />}
                {selectedDetails.cpu_percent !== undefined && <DetailRow label="CPU" value={fmtPercent(selectedDetails.cpu_percent)} />}
                {selectedDetails.memory_used_bytes !== undefined && (
                  <DetailRow
                    label="Memory"
                    value={`${fmtBytes(selectedDetails.memory_used_bytes)} / ${fmtBytes(selectedDetails.memory_total_bytes)}`}
                  />
                )}
                {selectedDetails.disk_used_bytes !== undefined && (
                  <DetailRow
                    label="Disk"
                    value={`${fmtBytes(selectedDetails.disk_used_bytes)} / ${fmtBytes(selectedDetails.disk_total_bytes)}`}
                  />
                )}
                {selectedDetails.storage_type !== undefined && <DetailRow label="Type" value={selectedDetails.storage_type} />}
                {selectedDetails.shared !== undefined && <DetailRow label="Shared" value={selectedDetails.shared ? "yes" : "no"} />}
                {selectedDetails.content !== undefined && <DetailRow label="Content" value={selectedDetails.content} />}
                {selectedDetails.user !== undefined && <DetailRow label="User" value={selectedDetails.user} />}
                {selectedDetails.resource_id !== undefined && <DetailRow label="Resource" value={selectedDetails.resource_id} mono />}
                {selectedDetails.upid !== undefined && <DetailRow label="UPID" value={selectedDetails.upid} mono />}
                {selectedDetails.uptime_seconds !== undefined && <DetailRow label="Uptime" value={fmtDuration(selectedDetails.uptime_seconds)} />}
                {selectedDetails.last_seen !== undefined && <DetailRow label="Last seen" value={fmtAge(selectedDetails.last_seen)} />}
                {selectedDetails.description && (
                  <div className="space-y-2 pt-2">
                    <div className="text-xs text-muted-foreground">Description</div>
                    <div className="rounded-lg bg-surface p-3 text-sm text-foreground">{selectedDetails.description}</div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      <AnimatePresence>
        {showAddCluster && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddCluster(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
              >
                <div className="border-b border-border px-6 py-4">
                  <h2 className="text-lg font-semibold">Add Proxmox Cluster</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Connect with an API token or username/password. Discovery stays read-only.
                  </p>
                </div>

                <div className="space-y-4 p-6">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Name</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-primary/50"
                      placeholder="e.g. homelab-pve"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Base URL</label>
                    <input
                      value={form.base_url}
                      onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-sm outline-none transition focus:border-primary/50"
                      placeholder="https://proxmox.example:8006"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Token ID</label>
                      <input
                        value={form.token_id}
                        onChange={(e) => setForm((f) => ({ ...f, token_id: e.target.value }))}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-sm outline-none transition focus:border-primary/50"
                        placeholder="root@pam!vordr"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Token Secret</label>
                      <input
                        value={form.token_secret}
                        onChange={(e) => setForm((f) => ({ ...f, token_secret: e.target.value }))}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-sm outline-none transition focus:border-primary/50"
                        placeholder="token secret"
                      />
                    </div>
                  </div>

                  <div className="relative py-1 text-center text-xs uppercase tracking-wide text-muted-foreground">
                    <span className="bg-card px-2">or</span>
                    <div className="absolute left-0 right-0 top-1/2 -z-10 h-px -translate-y-1/2 bg-border" />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Username</label>
                      <input
                        value={form.username}
                        onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-sm outline-none transition focus:border-primary/50"
                        placeholder="root@pam"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Password</label>
                      <input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-sm outline-none transition focus:border-primary/50"
                        placeholder="password"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.verify_tls}
                      onChange={(e) => setForm((f) => ({ ...f, verify_tls: e.target.checked }))}
                    />
                    Verify TLS certificates
                  </label>
                </div>

                <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
                  <button
                    onClick={() => setShowAddCluster(false)}
                    className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition hover:bg-surface"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => createMutation.mutate(form)}
                    disabled={
                      !form.name ||
                      !form.base_url ||
                      !((form.token_id && form.token_secret) || (form.username && form.password)) ||
                      createMutation.isPending
                    }
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Connect Proxmox
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
