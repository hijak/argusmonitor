import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Cpu, Database, HardDrive, Loader2, MonitorSmartphone, Plus, RefreshCw, Search, Server, Trash2, ChevronRight, Boxes } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";

const tabs = [
  { key: "overview", label: "Overview", icon: Boxes },
  { key: "nodes", label: "Nodes", icon: Server },
  { key: "vms", label: "VMs", icon: MonitorSmartphone },
  { key: "containers", label: "LXCs", icon: Database },
  { key: "storage", label: "Storage", icon: HardDrive },
  { key: "tasks", label: "Tasks", icon: Clock },
] as const;

type TabKey = (typeof tabs)[number]["key"];

function fmtBytes(value?: number) {
  const num = Number(value || 0);
  if (!num) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let idx = 0;
  let n = num;
  while (n >= 1024 && idx < units.length - 1) { n /= 1024; idx += 1; }
  return `${n.toFixed(n >= 10 ? 0 : 1)} ${units[idx]}`;
}

function fmtAge(date?: string) {
  if (!date) return "-";
  const then = new Date(date).getTime();
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function DetailRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="grid grid-cols-[104px_1fr] gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all font-mono text-foreground">{value || "-"}</span>
    </div>
  );
}

export default function ProxmoxPage() {
  const queryClient = useQueryClient();
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [selectedResource, setSelectedResource] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [showAddCluster, setShowAddCluster] = useState(false);
  const [form, setForm] = useState({ name: "", base_url: "", token_id: "", token_secret: "", verify_tls: true });

  const { data: clusters = [] } = useQuery({ queryKey: ["proxmox-clusters"], queryFn: api.listProxmoxClusters, refetchInterval: 30000 });
  useEffect(() => { if (!selectedCluster && clusters.length) setSelectedCluster(clusters[0].id); }, [clusters, selectedCluster]);

  const selectedClusterData = clusters.find((c: any) => c.id === selectedCluster) ?? null;

  const { data: stats } = useQuery({ queryKey: ["proxmox-stats", selectedCluster], queryFn: () => api.getProxmoxClusterStats(selectedCluster!), enabled: !!selectedCluster });
  const { data: nodes = [] } = useQuery({ queryKey: ["proxmox-nodes", selectedCluster], queryFn: () => api.listProxmoxNodes(selectedCluster!), enabled: !!selectedCluster });
  const { data: vms = [] } = useQuery({ queryKey: ["proxmox-vms", selectedCluster, search], queryFn: () => api.listProxmoxVMs(selectedCluster!, search || undefined), enabled: !!selectedCluster });
  const { data: containers = [] } = useQuery({ queryKey: ["proxmox-containers", selectedCluster, search], queryFn: () => api.listProxmoxContainers(selectedCluster!, search || undefined), enabled: !!selectedCluster });
  const { data: storage = [] } = useQuery({ queryKey: ["proxmox-storage", selectedCluster], queryFn: () => api.listProxmoxStorage(selectedCluster!), enabled: !!selectedCluster });
  const { data: tasks = [] } = useQuery({ queryKey: ["proxmox-tasks", selectedCluster], queryFn: () => api.listProxmoxTasks(selectedCluster!, 100), enabled: !!selectedCluster });

  const createMutation = useMutation({
    mutationFn: api.createProxmoxCluster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proxmox-clusters"] });
      setShowAddCluster(false);
      setForm({ name: "", base_url: "", token_id: "", token_secret: "", username: "", password: "", verify_tls: true });
    },
  });

  const discoverMutation = useMutation({
    mutationFn: api.discoverProxmoxCluster,
    onSuccess: () => {
      ["proxmox-clusters", "proxmox-stats", "proxmox-nodes", "proxmox-vms", "proxmox-containers", "proxmox-storage", "proxmox-tasks"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteProxmoxCluster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proxmox-clusters"] });
      setSelectedCluster(null);
      setSelectedResource(null);
    },
  });

  const rawItems = useMemo(() => {
    switch (activeTab) {
      case "nodes": return nodes;
      case "vms": return vms;
      case "containers": return containers;
      case "storage": return storage;
      case "tasks": return tasks;
      default: return [];
    }
  }, [activeTab, nodes, vms, containers, storage, tasks]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rawItems.filter((item: any) => {
      const hay = [item.node, item.name, item.status, item.storage, item.task_type, item.user, item.description, item.resource_id].filter(Boolean).join(" ").toLowerCase();
      return !q || hay.includes(q);
    });
  }, [rawItems, search]);

  const renderRows = (items: any[]) => {
    if (activeTab === "nodes") return items.map((node: any) => <tr key={node.id} className="cursor-pointer hover:bg-surface/60" onClick={() => setSelectedResource(node)}><td className="px-4 py-3 font-mono text-xs">{node.node}</td><td className="px-4 py-3 text-xs">{node.status}</td><td className="px-4 py-3 font-mono text-xs">{node.ip_address || "-"}</td><td className="px-4 py-3 font-mono text-xs">{Math.round(node.cpu_percent || 0)}%</td><td className="px-4 py-3 font-mono text-xs">{fmtBytes(node.memory_used_bytes)} / {fmtBytes(node.memory_total_bytes)}</td><td className="px-4 py-3 font-mono text-xs">{fmtAge(node.last_seen)}</td></tr>);
    if (activeTab === "vms") return items.map((vm: any) => <tr key={vm.id} className="cursor-pointer hover:bg-surface/60" onClick={() => setSelectedResource(vm)}><td className="px-4 py-3 font-mono text-xs">{vm.vmid}</td><td className="px-4 py-3 font-mono text-xs">{vm.name}</td><td className="px-4 py-3 text-xs">{vm.node}</td><td className="px-4 py-3 text-xs">{vm.status}</td><td className="px-4 py-3 font-mono text-xs">{Math.round(vm.cpu_percent || 0)}%</td><td className="px-4 py-3 font-mono text-xs">{fmtBytes(vm.memory_used_bytes)} / {fmtBytes(vm.memory_total_bytes)}</td></tr>);
    if (activeTab === "containers") return items.map((ct: any) => <tr key={ct.id} className="cursor-pointer hover:bg-surface/60" onClick={() => setSelectedResource(ct)}><td className="px-4 py-3 font-mono text-xs">{ct.vmid}</td><td className="px-4 py-3 font-mono text-xs">{ct.name}</td><td className="px-4 py-3 text-xs">{ct.node}</td><td className="px-4 py-3 text-xs">{ct.status}</td><td className="px-4 py-3 font-mono text-xs">{Math.round(ct.cpu_percent || 0)}%</td><td className="px-4 py-3 font-mono text-xs">{fmtBytes(ct.memory_used_bytes)} / {fmtBytes(ct.memory_total_bytes)}</td></tr>);
    if (activeTab === "storage") return items.map((s: any) => <tr key={s.id} className="cursor-pointer hover:bg-surface/60" onClick={() => setSelectedResource(s)}><td className="px-4 py-3 font-mono text-xs">{s.storage}</td><td className="px-4 py-3 text-xs">{s.node || "cluster"}</td><td className="px-4 py-3 text-xs">{s.storage_type || "-"}</td><td className="px-4 py-3 text-xs">{s.status || "-"}</td><td className="px-4 py-3 font-mono text-xs">{fmtBytes(s.used_bytes)} / {fmtBytes(s.total_bytes)}</td><td className="px-4 py-3 text-xs">{s.shared ? "shared" : "local"}</td></tr>);
    if (activeTab === "tasks") return items.map((task: any) => <tr key={task.id} className="cursor-pointer hover:bg-surface/60" onClick={() => setSelectedResource(task)}><td className="px-4 py-3 font-mono text-xs">{task.task_type || "task"}</td><td className="px-4 py-3 text-xs">{task.node || "-"}</td><td className="px-4 py-3 text-xs">{task.status || "-"}</td><td className="px-4 py-3 text-xs">{task.user || "-"}</td><td className="px-4 py-3 font-mono text-xs">{task.resource_id || "-"}</td><td className="px-4 py-3 font-mono text-xs">{fmtAge(task.start_time || task.last_seen)}</td></tr>);
    return null;
  };

  const heads = {
    nodes: ["Node", "Status", "IP", "CPU", "Memory", "Seen"],
    vms: ["VMID", "Name", "Node", "Status", "CPU", "Memory"],
    containers: ["VMID", "Name", "Node", "Status", "CPU", "Memory"],
    storage: ["Storage", "Node", "Type", "Status", "Usage", "Mode"],
    tasks: ["Task", "Node", "Status", "User", "Resource", "Age"],
  } as const;

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Proxmox" description="Read-only Proxmox cluster views for nodes, VMs, LXCs, storage, and recent tasks — in the same family as the Kubernetes and Swarm pages.">
        <button onClick={() => setShowAddCluster(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" />Add Proxmox</button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-3 flex items-center justify-between px-1"><h3 className="text-sm font-semibold">Proxmox clusters</h3><span className="text-xs text-muted-foreground">{clusters.length}</span></div>
            <div className="space-y-2">{clusters.map((cluster: any) => <button key={cluster.id} onClick={() => setSelectedCluster(cluster.id)} className={`w-full rounded-lg border p-3 text-left ${selectedCluster === cluster.id ? "border-primary/50 bg-primary/5" : "border-border bg-surface/40 hover:border-primary/30"}`}><div className="flex items-start justify-between"><div><div className="flex items-center gap-2"><MonitorSmartphone className="h-4 w-4 text-primary" /><span className="text-sm font-medium">{cluster.name}</span></div><p className="mt-1 text-xs text-muted-foreground">{cluster.base_url}</p></div><StatusBadge variant={cluster.status}>{cluster.status}</StatusBadge></div><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-md bg-background/60 px-2 py-2"><div className="font-semibold">{cluster.node_count}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Nodes</div></div><div className="rounded-md bg-background/60 px-2 py-2"><div className="font-semibold">{cluster.vm_count}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">VMs</div></div><div className="rounded-md bg-background/60 px-2 py-2"><div className="font-semibold">{cluster.container_count}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">LXCs</div></div></div></button>)}</div>
          </div>
        </div>

        <div className="space-y-4">
          {selectedClusterData && <div className="rounded-xl border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-lg font-semibold">{selectedClusterData.name}</h2><StatusBadge variant={selectedClusterData.status}>{selectedClusterData.status}</StatusBadge></div><p className="mt-1 text-sm text-muted-foreground">Proxmox VE operator view for cluster health, VMs, containers, storage, and tasks.</p></div><div className="flex items-center gap-2"><button onClick={() => discoverMutation.mutate(selectedClusterData.id)} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface"><RefreshCw className={`h-4 w-4 ${discoverMutation.isPending ? "animate-spin" : ""}`} />Refresh</button><button onClick={() => deleteMutation.mutate(selectedClusterData.id)} className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-surface hover:text-critical"><Trash2 className="h-4 w-4" /></button></div></div><div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-6"><div className="rounded-lg bg-surface p-3"><div className="text-xs text-muted-foreground">Nodes</div><div className="mt-1 text-xl font-semibold">{selectedClusterData.node_count}</div></div><div className="rounded-lg bg-surface p-3"><div className="text-xs text-muted-foreground">VMs</div><div className="mt-1 text-xl font-semibold">{selectedClusterData.vm_count}</div></div><div className="rounded-lg bg-surface p-3"><div className="text-xs text-muted-foreground">LXCs</div><div className="mt-1 text-xl font-semibold">{selectedClusterData.container_count}</div></div><div className="rounded-lg bg-surface p-3"><div className="text-xs text-muted-foreground">Storage</div><div className="mt-1 text-xl font-semibold">{selectedClusterData.storage_count}</div></div><div className="rounded-lg bg-surface p-3"><div className="text-xs text-muted-foreground">Version</div><div className="mt-1 text-sm font-semibold">{selectedClusterData.version || "-"}</div></div><div className="rounded-lg bg-surface p-3"><div className="text-xs text-muted-foreground">Seen</div><div className="mt-1 text-sm font-semibold">{fmtAge(selectedClusterData.last_seen)}</div></div></div></div>}

          <div className="rounded-xl border border-border bg-card">
            <div className="sticky top-0 z-20 border-b border-border bg-card px-4 py-3"><div className="flex flex-wrap items-center gap-2">{tabs.map((tab) => { const Icon = tab.icon; return <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${activeTab === tab.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface hover:text-foreground"}`}><Icon className="h-4 w-4" />{tab.label}</button>; })}</div>{activeTab !== "overview" && <div className="mt-3 relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${activeTab}...`} className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm outline-none" /></div>}</div>
            <div className="max-h-[780px] overflow-auto">
              {activeTab === "overview" && <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2"><div className="rounded-lg border border-border p-4"><h3 className="mb-3 text-sm font-semibold">State summary</h3><div className="space-y-3 text-sm"><div className="flex items-center justify-between"><span className="text-muted-foreground">VM states</span><span className="font-mono text-xs">{JSON.stringify(stats?.vms_by_status || {})}</span></div><div className="flex items-center justify-between"><span className="text-muted-foreground">LXC states</span><span className="font-mono text-xs">{JSON.stringify(stats?.containers_by_status || {})}</span></div><div className="flex items-center justify-between"><span className="text-muted-foreground">Node states</span><span className="font-mono text-xs">{JSON.stringify(stats?.nodes_by_status || {})}</span></div></div></div><div className="rounded-lg border border-border p-4"><h3 className="mb-3 text-sm font-semibold">Recent failed tasks</h3><div className="space-y-2">{(stats?.recent_failed_tasks || []).map((task: any) => <button key={task.id} onClick={() => { setActiveTab("tasks"); setSelectedResource(task); }} className="flex w-full items-center justify-between rounded-md bg-surface px-3 py-2 text-left text-sm hover:bg-surface/80"><div><div className="font-mono text-xs">{task.task_type || task.upid.slice(0, 24)}</div><div className="text-xs text-muted-foreground">{task.node || "unknown node"}</div></div><div className="text-xs text-warning">{task.status}</div></button>)}{(!stats?.recent_failed_tasks || stats.recent_failed_tasks.length === 0) && <p className="text-sm text-muted-foreground">No obvious failed tasks.</p>}</div></div></div>}
              {activeTab !== "overview" && <table className="w-full text-sm"><thead className="sticky top-0 bg-card z-10"><tr className="border-b border-border text-left text-xs text-muted-foreground">{heads[activeTab as keyof typeof heads].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{renderRows(filteredItems)}</tbody></table>}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4"><div className="mb-3 flex items-center gap-2"><ChevronRight className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">Details</h3></div>{!selectedResource && <div className="rounded-lg border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">Pick a row to inspect it.</div>}{selectedResource && <div className="space-y-3"><DetailRow label="Name" value={selectedResource.node || selectedResource.name || selectedResource.storage || selectedResource.task_type} />{selectedResource.vmid !== undefined && <DetailRow label="VMID" value={selectedResource.vmid} />}{selectedResource.status !== undefined && <DetailRow label="Status" value={selectedResource.status} />}{selectedResource.node !== undefined && <DetailRow label="Node" value={selectedResource.node} />}{selectedResource.ip_address !== undefined && <DetailRow label="IP" value={selectedResource.ip_address} />}{selectedResource.cpu_percent !== undefined && <DetailRow label="CPU" value={`${Math.round(selectedResource.cpu_percent || 0)}%`} />}{selectedResource.memory_used_bytes !== undefined && <DetailRow label="Memory" value={`${fmtBytes(selectedResource.memory_used_bytes)} / ${fmtBytes(selectedResource.memory_total_bytes)}`} />}{selectedResource.disk_used_bytes !== undefined && <DetailRow label="Disk" value={`${fmtBytes(selectedResource.disk_used_bytes)} / ${fmtBytes(selectedResource.disk_total_bytes)}`} />}{selectedResource.storage_type !== undefined && <DetailRow label="Type" value={selectedResource.storage_type} />}{selectedResource.shared !== undefined && <DetailRow label="Shared" value={selectedResource.shared ? "yes" : "no"} />}{selectedResource.user !== undefined && <DetailRow label="User" value={selectedResource.user} />}{selectedResource.resource_id !== undefined && <DetailRow label="Resource" value={selectedResource.resource_id} />}{selectedResource.upid !== undefined && <DetailRow label="UPID" value={selectedResource.upid} />}{selectedResource.description && <div className="space-y-2 pt-2"><div className="text-xs text-muted-foreground">Description</div><div className="rounded-lg bg-surface p-3 text-sm text-foreground">{selectedResource.description}</div></div>}</div>}</div>
        </div>
      </div>

      <AnimatePresence>{showAddCluster && <><motion.div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddCluster(false)} /><div className="fixed inset-0 z-50 flex items-center justify-center p-4"><motion.div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl" initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }}><div className="border-b border-border px-6 py-4"><h2 className="text-lg font-semibold">Add Proxmox Cluster</h2><p className="mt-0.5 text-xs text-muted-foreground">Connect via API token or username/password for read-only cluster discovery.</p></div><div className="space-y-4 p-6"><div><label className="mb-1.5 block text-sm font-medium">Name</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none" placeholder="e.g. homelab-pve" /></div><div><label className="mb-1.5 block text-sm font-medium">Base URL</label><input value={form.base_url} onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none font-mono" placeholder="https://proxmox.example:8006" /></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-sm font-medium">Token ID</label><input value={form.token_id} onChange={(e) => setForm((f) => ({ ...f, token_id: e.target.value }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none font-mono" placeholder="root@pam!argus" /></div><div><label className="mb-1.5 block text-sm font-medium">Token Secret</label><input value={form.token_secret} onChange={(e) => setForm((f) => ({ ...f, token_secret: e.target.value }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none font-mono" placeholder="token secret" /></div></div><div className="relative py-1 text-center text-xs uppercase tracking-wide text-muted-foreground"><span className="bg-card px-2">or</span><div className="absolute left-0 right-0 top-1/2 -z-10 h-px -translate-y-1/2 bg-border" /></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-sm font-medium">Username</label><input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none font-mono" placeholder="root@pam" /></div><div><label className="mb-1.5 block text-sm font-medium">Password</label><input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none font-mono" placeholder="password" /></div></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.verify_tls} onChange={(e) => setForm((f) => ({ ...f, verify_tls: e.target.checked }))} /> Verify TLS</label></div><div className="flex justify-end gap-3 border-t border-border px-6 py-4"><button onClick={() => setShowAddCluster(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-surface-hover">Cancel</button><button onClick={() => createMutation.mutate(form)} disabled={!form.name || !form.base_url || !((form.token_id && form.token_secret) || (form.username && form.password)) || createMutation.isPending} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{createMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}Connect Proxmox</button></div></motion.div></div></>}</AnimatePresence>
    </div>
  );
}
