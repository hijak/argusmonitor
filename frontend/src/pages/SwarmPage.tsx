import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { FilterDropdown } from "@/components/ui/filter-dropdown";
import { api } from "@/lib/api";
import { AnimatePresence, motion } from "framer-motion";
import { Boxes, ChevronRight, Cpu, HardDrive, Layers3, Loader2, Network, Plus, RefreshCw, Search, Server, Trash2, Workflow, Clock, Package } from "lucide-react";

const tabs = [
  { key: "overview", label: "Overview", icon: Layers3 },
  { key: "nodes", label: "Nodes", icon: Server },
  { key: "services", label: "Services", icon: Workflow },
  { key: "tasks", label: "Tasks", icon: Package },
  { key: "networks", label: "Networks", icon: Network },
  { key: "volumes", label: "Volumes", icon: HardDrive },
  { key: "events", label: "Events", icon: Clock },
] as const;

type TabKey = (typeof tabs)[number]["key"];

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
    <div className="grid grid-cols-[96px_1fr] gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all font-mono text-foreground">{value || "-"}</span>
    </div>
  );
}

export default function SwarmPage() {
  const queryClient = useQueryClient();
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [selectedResource, setSelectedResource] = useState<any | null>(null);
  const [stackFilter, setStackFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showAddCluster, setShowAddCluster] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDockerHost, setNewDockerHost] = useState("unix:///var/run/docker.sock");
  const [newAuthType, setNewAuthType] = useState("local");
  const [newJumpHost, setNewJumpHost] = useState("");

  const { data: clusters = [] } = useQuery({ queryKey: ["swarm-clusters"], queryFn: api.listSwarmClusters, refetchInterval: 30000 });
  useEffect(() => { if (!selectedCluster && clusters.length) setSelectedCluster(clusters[0].id); }, [clusters, selectedCluster]);

  const selectedClusterData = clusters.find((c: any) => c.id === selectedCluster) ?? null;
  const stackQuery = stackFilter === "all" ? undefined : stackFilter;

  const { data: stats } = useQuery({ queryKey: ["swarm-stats", selectedCluster], queryFn: () => api.getSwarmClusterStats(selectedCluster!), enabled: !!selectedCluster });
  const { data: nodes = [] } = useQuery({ queryKey: ["swarm-nodes", selectedCluster], queryFn: () => api.listSwarmNodes(selectedCluster!), enabled: !!selectedCluster });
  const { data: services = [] } = useQuery({ queryKey: ["swarm-services", selectedCluster, stackQuery], queryFn: () => api.listSwarmServices(selectedCluster!, stackQuery), enabled: !!selectedCluster });
  const { data: tasks = [] } = useQuery({ queryKey: ["swarm-tasks", selectedCluster, stackQuery], queryFn: () => api.listSwarmTasks(selectedCluster!, stackQuery), enabled: !!selectedCluster });
  const { data: networks = [] } = useQuery({ queryKey: ["swarm-networks", selectedCluster], queryFn: () => api.listSwarmNetworks(selectedCluster!), enabled: !!selectedCluster });
  const { data: volumes = [] } = useQuery({ queryKey: ["swarm-volumes", selectedCluster], queryFn: () => api.listSwarmVolumes(selectedCluster!), enabled: !!selectedCluster });
  const { data: events = [] } = useQuery({ queryKey: ["swarm-events", selectedCluster], queryFn: () => api.listSwarmEvents(selectedCluster!, 100), enabled: !!selectedCluster });

  const createMutation = useMutation({
    mutationFn: api.createSwarmCluster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swarm-clusters"] });
      setShowAddCluster(false);
      setNewName("");
      setNewDockerHost("unix:///var/run/docker.sock");
      setNewAuthType("local");
      setNewJumpHost("");
    },
  });

  const discoverMutation = useMutation({
    mutationFn: api.discoverSwarmCluster,
    onSuccess: () => {
      ["swarm-clusters", "swarm-stats", "swarm-nodes", "swarm-services", "swarm-tasks", "swarm-networks", "swarm-volumes", "swarm-events"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteSwarmCluster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swarm-clusters"] });
      setSelectedCluster(null);
      setSelectedResource(null);
    },
  });

  const handleCreate = () => {
    if (!newName || !newDockerHost) return;
    createMutation.mutate({
      name: newName,
      docker_host: newDockerHost,
      auth_type: newAuthType,
      auth_config: {
        jump_host: newJumpHost || undefined,
      },
    });
  };

  const rawItems = useMemo(() => {
    switch (activeTab) {
      case "nodes": return nodes;
      case "services": return services;
      case "tasks": return tasks;
      case "networks": return networks;
      case "volumes": return volumes;
      case "events": return events;
      default: return [];
    }
  }, [activeTab, nodes, services, tasks, networks, volumes, events]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rawItems.filter((item: any) => {
      const hay = [item.hostname, item.name, item.service_name, item.stack, item.status, item.current_state, item.event_type, item.action, item.actor_name, item.message].filter(Boolean).join(" ").toLowerCase();
      return !q || hay.includes(q);
    });
  }, [rawItems, search]);

  const stackOptions = useMemo(() => {
    const set = new Set<string>();
    services.forEach((svc: any) => svc.stack && set.add(svc.stack));
    tasks.forEach((task: any) => task.stack && set.add(task.stack));
    return ["all", ...Array.from(set).sort()];
  }, [services, tasks]);

  const renderRows = (items: any[]) => {
    if (activeTab === "nodes") return items.map((node: any) => <tr key={node.id} className="cursor-pointer hover:bg-surface/60" onClick={() => setSelectedResource(node)}><td className="px-4 py-3 font-mono text-xs">{node.hostname}</td><td className="px-4 py-3 text-xs">{node.role}</td><td className="px-4 py-3 text-xs">{node.availability}</td><td className="px-4 py-3 text-xs">{node.status}</td><td className="px-4 py-3 font-mono text-xs">{node.engine_version || "-"}</td><td className="px-4 py-3 font-mono text-xs">{node.cpu_count}</td><td className="px-4 py-3 font-mono text-xs">{Math.round((node.memory_bytes || 0) / 1024 / 1024 / 1024)} GB</td></tr>);
    if (activeTab === "services") return items.map((svc: any) => <tr key={svc.id} className="cursor-pointer hover:bg-surface/60" onClick={() => setSelectedResource(svc)}><td className="px-4 py-3 font-mono text-xs">{svc.name}</td><td className="px-4 py-3 text-xs text-muted-foreground">{svc.stack || "-"}</td><td className="px-4 py-3 text-xs">{svc.mode}</td><td className="px-4 py-3 font-mono text-xs">{svc.replicas_running}/{svc.replicas_desired}</td><td className="px-4 py-3 font-mono text-xs">{svc.image || "-"}</td><td className="px-4 py-3 text-xs text-muted-foreground">{(svc.published_ports || []).map((p: any) => p.published).filter(Boolean).join(", ") || "-"}</td></tr>);
    if (activeTab === "tasks") return items.map((task: any) => <tr key={task.id} className="cursor-pointer hover:bg-surface/60" onClick={() => setSelectedResource(task)}><td className="px-4 py-3 font-mono text-xs">{task.service_name || task.task_id.slice(0, 12)}</td><td className="px-4 py-3 text-xs text-muted-foreground">{task.stack || "-"}</td><td className="px-4 py-3 font-mono text-xs">{task.slot || "-"}</td><td className="px-4 py-3 text-xs">{task.current_state}</td><td className="px-4 py-3 text-xs text-muted-foreground">{task.desired_state}</td><td className="px-4 py-3 text-xs text-muted-foreground">{task.node_name || "-"}</td></tr>);
    if (activeTab === "networks") return items.map((net: any) => <tr key={net.id} className="cursor-pointer hover:bg-surface/60" onClick={() => setSelectedResource(net)}><td className="px-4 py-3 font-mono text-xs">{net.name}</td><td className="px-4 py-3 text-xs">{net.driver}</td><td className="px-4 py-3 text-xs">{net.scope}</td><td className="px-4 py-3 text-xs">{net.attachable ? "yes" : "no"}</td><td className="px-4 py-3 text-xs">{net.ingress ? "yes" : "no"}</td></tr>);
    if (activeTab === "volumes") return items.map((vol: any) => <tr key={vol.id} className="cursor-pointer hover:bg-surface/60" onClick={() => setSelectedResource(vol)}><td className="px-4 py-3 font-mono text-xs">{vol.name}</td><td className="px-4 py-3 text-xs">{vol.driver}</td><td className="px-4 py-3 text-xs">{vol.scope}</td></tr>);
    if (activeTab === "events") return items.map((evt: any) => <tr key={evt.id} className="cursor-pointer hover:bg-surface/60" onClick={() => setSelectedResource(evt)}><td className="px-4 py-3 text-xs">{evt.event_type}</td><td className="px-4 py-3 text-xs">{evt.action}</td><td className="px-4 py-3 text-xs text-muted-foreground">{evt.actor_name || evt.actor_id || "-"}</td><td className="px-4 py-3 text-xs text-muted-foreground">{fmtAge(evt.event_time || evt.last_seen)}</td></tr>);
    return null;
  };

  const heads = {
    nodes: ["Hostname", "Role", "Availability", "Status", "Engine", "CPU", "Memory"],
    services: ["Name", "Stack", "Mode", "Replicas", "Image", "Ports"],
    tasks: ["Service", "Stack", "Slot", "Current", "Desired", "Node"],
    networks: ["Name", "Driver", "Scope", "Attachable", "Ingress"],
    volumes: ["Name", "Driver", "Scope"],
    events: ["Type", "Action", "Actor", "Age"],
  } as const;

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Docker Swarm" description="Lens-style read-only Swarm views for nodes, services, tasks, stacks, networks, volumes, and events.">
        <button onClick={() => setShowAddCluster(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" />Add Swarm</button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.4fr)_400px] xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="space-y-4">
          {selectedClusterData && <div className="rounded-xl border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-lg font-semibold">{selectedClusterData.name}</h2><StatusBadge variant={selectedClusterData.status}>{selectedClusterData.status}</StatusBadge></div><p className="mt-1 text-sm text-muted-foreground">Read-only Docker Swarm operator view.</p></div><div className="flex items-center gap-2"><button onClick={() => discoverMutation.mutate(selectedClusterData.id)} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface"><RefreshCw className={`h-4 w-4 ${discoverMutation.isPending ? "animate-spin" : ""}`} />Refresh</button><button onClick={() => deleteMutation.mutate(selectedClusterData.id)} className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-surface hover:text-critical"><Trash2 className="h-4 w-4" /></button></div></div><div className="mt-4 grid grid-cols-2 gap-3 2xl:grid-cols-6 xl:grid-cols-3"><div className="rounded-lg bg-surface p-3"><div className="text-xs text-muted-foreground">Managers</div><div className="mt-1 text-xl font-semibold">{selectedClusterData.manager_count}</div></div><div className="rounded-lg bg-surface p-3"><div className="text-xs text-muted-foreground">Workers</div><div className="mt-1 text-xl font-semibold">{selectedClusterData.worker_count}</div></div><div className="rounded-lg bg-surface p-3"><div className="text-xs text-muted-foreground">Services</div><div className="mt-1 text-xl font-semibold">{selectedClusterData.service_count}</div></div><div className="rounded-lg bg-surface p-3"><div className="text-xs text-muted-foreground">Tasks</div><div className="mt-1 text-xl font-semibold">{selectedClusterData.task_count}</div></div><div className="rounded-lg bg-surface p-3"><div className="text-xs text-muted-foreground">Stacks</div><div className="mt-1 text-xl font-semibold">{selectedClusterData.stack_count}</div></div><div className="rounded-lg bg-surface p-3"><div className="text-xs text-muted-foreground">Networks</div><div className="mt-1 text-xl font-semibold">{stats?.network_count ?? networks.length}</div></div></div></div>}

          <div className="rounded-xl border border-border bg-card">
            <div className="sticky top-0 z-20 border-b border-border bg-card px-4 py-3"><div className="flex flex-wrap items-center gap-2">{tabs.map((tab) => { const Icon = tab.icon; return <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${activeTab === tab.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface hover:text-foreground"}`}><Icon className="h-4 w-4" />{tab.label}</button>; })}</div>{activeTab !== "overview" && <div className="mt-3 relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${activeTab}...`} className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm outline-none" /></div>}</div>
            <div className="max-h-[780px] overflow-auto">
              {activeTab === "overview" && <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2"><div className="rounded-lg border border-border p-4"><h3 className="mb-3 text-sm font-semibold">State summary</h3><div className="space-y-3 text-sm"><div className="flex items-center justify-between"><span className="text-muted-foreground">Task states</span><span className="font-mono text-xs">{JSON.stringify(stats?.tasks_by_state || {})}</span></div><div className="flex items-center justify-between"><span className="text-muted-foreground">Node states</span><span className="font-mono text-xs">{JSON.stringify(stats?.nodes_by_status || {})}</span></div><div className="flex items-center justify-between"><span className="text-muted-foreground">Volumes</span><span className="font-mono text-xs">{stats?.volume_count ?? volumes.length}</span></div></div></div><div className="rounded-lg border border-border p-4"><h3 className="mb-3 text-sm font-semibold">Problem tasks</h3><div className="space-y-2">{(stats?.top_error_tasks || []).map((task: any) => <button key={task.id} onClick={() => { setActiveTab("tasks"); setSelectedResource(task); }} className="flex w-full items-center justify-between rounded-md bg-surface px-3 py-2 text-left text-sm hover:bg-surface/80"><div><div className="font-mono text-xs">{task.service_name || task.task_id.slice(0, 12)}</div><div className="text-xs text-muted-foreground">{task.node_name || "unknown node"}</div></div><div className="text-xs text-warning">{task.current_state}</div></button>)}{(!stats?.top_error_tasks || stats.top_error_tasks.length === 0) && <p className="text-sm text-muted-foreground">No obvious task errors.</p>}</div></div></div>}

              {activeTab !== "overview" && <table className="w-full text-sm"><thead className="sticky top-0 bg-card z-10"><tr className="border-b border-border text-left text-xs text-muted-foreground">{heads[activeTab as keyof typeof heads].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{renderRows(filteredItems)}</tbody></table>}
            </div>
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-3 flex items-center justify-between px-1"><h3 className="text-sm font-semibold">Swarm clusters</h3><span className="text-xs text-muted-foreground">{clusters.length}</span></div>
            <div className="space-y-2">{clusters.map((cluster: any) => <button key={cluster.id} onClick={() => setSelectedCluster(cluster.id)} className={`w-full rounded-lg border p-3 text-left ${selectedCluster === cluster.id ? "border-primary/50 bg-primary/5" : "border-border bg-surface/40 hover:border-primary/30"}`}><div className="flex items-start justify-between"><div><div className="flex items-center gap-2"><Boxes className="h-4 w-4 text-primary" /><span className="text-sm font-medium">{cluster.name}</span></div><p className="mt-1 text-xs text-muted-foreground">{cluster.docker_host}</p></div><StatusBadge variant={cluster.status}>{cluster.status}</StatusBadge></div><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-md bg-background/60 px-2 py-2"><div className="font-semibold">{cluster.node_count}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Nodes</div></div><div className="rounded-md bg-background/60 px-2 py-2"><div className="font-semibold">{cluster.service_count}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Services</div></div><div className="rounded-md bg-background/60 px-2 py-2"><div className="font-semibold">{cluster.task_count}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Tasks</div></div></div></button>)}</div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-3 px-1"><h3 className="text-sm font-semibold">Scope</h3></div>
            <div className="space-y-3">
              <FilterDropdown
                label="Stack"
                value={stackFilter}
                onChange={setStackFilter}
                options={stackOptions.map((stack) => ({ value: stack, label: stack === "all" ? "All stacks" : stack }))}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4"><div className="mb-3 flex items-center gap-2"><ChevronRight className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">Details</h3></div>{!selectedResource && <div className="rounded-lg border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">Pick a row to inspect it.</div>}{selectedResource && <div className="space-y-3"><DetailRow label="Name" value={selectedResource.hostname || selectedResource.name || selectedResource.service_name || selectedResource.actor_name} />{selectedResource.role !== undefined && <DetailRow label="Role" value={selectedResource.role} />}{selectedResource.availability !== undefined && <DetailRow label="Avail" value={selectedResource.availability} />}{selectedResource.status !== undefined && <DetailRow label="Status" value={selectedResource.status} />}{selectedResource.mode !== undefined && <DetailRow label="Mode" value={selectedResource.mode} />}{selectedResource.stack !== undefined && <DetailRow label="Stack" value={selectedResource.stack} />}{selectedResource.image !== undefined && <DetailRow label="Image" value={selectedResource.image} />}{selectedResource.update_status !== undefined && <DetailRow label="Update" value={selectedResource.update_status} />}{selectedResource.current_state !== undefined && <DetailRow label="Current" value={selectedResource.current_state} />}{selectedResource.desired_state !== undefined && <DetailRow label="Desired" value={selectedResource.desired_state} />}{selectedResource.node_name !== undefined && <DetailRow label="Node" value={selectedResource.node_name} />}{selectedResource.driver !== undefined && <DetailRow label="Driver" value={selectedResource.driver} />}{selectedResource.scope !== undefined && <DetailRow label="Scope" value={selectedResource.scope} />}{selectedResource.event_type !== undefined && <DetailRow label="Event" value={`${selectedResource.event_type}:${selectedResource.action}`} />}{selectedResource.addr !== undefined && <DetailRow label="Address" value={selectedResource.addr} />}{selectedResource.message && <div className="space-y-2 pt-2"><div className="text-xs text-muted-foreground">Message</div><div className="rounded-lg bg-surface p-3 text-sm text-foreground">{selectedResource.message}</div></div>}{selectedResource.error && <div className="space-y-2 pt-2"><div className="text-xs text-muted-foreground">Error</div><div className="rounded-lg bg-surface p-3 text-sm text-warning">{selectedResource.error}</div></div>}{selectedResource.labels && Object.keys(selectedResource.labels).length > 0 && <div className="space-y-2 pt-2"><div className="text-xs text-muted-foreground">Labels</div><div className="rounded-lg bg-surface p-3 font-mono text-xs text-foreground">{Object.entries(selectedResource.labels).slice(0, 20).map(([k, v]) => <div key={k}>{k}: {String(v)}</div>)}</div></div>}{selectedResource.published_ports && <div className="space-y-2 pt-2"><div className="text-xs text-muted-foreground">Published ports</div><div className="rounded-lg bg-surface p-3 font-mono text-xs text-foreground">{(selectedResource.published_ports || []).map((p: any, i: number) => <div key={i}>{p.published || "-"} → {p.target || "-"}/{p.protocol || "tcp"} ({p.mode || "ingress"})</div>)}</div></div>}</div>}</div>
        </div>
      </div>

      <AnimatePresence>{showAddCluster && <><motion.div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddCluster(false)} /><div className="fixed inset-0 z-50 flex items-center justify-center p-4"><motion.div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl" initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }}><div className="border-b border-border px-6 py-4"><h2 className="text-lg font-semibold">Add Swarm Cluster</h2><p className="mt-0.5 text-xs text-muted-foreground">Connect to a Docker Swarm manager via local socket, SSH-backed Docker context, or TCP host.</p></div><div className="space-y-4 p-6"><div><label className="mb-1.5 block text-sm font-medium">Name</label><input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none" placeholder="e.g. edge-swarm" /></div><div><label className="mb-1.5 block text-sm font-medium">Docker host</label><input value={newDockerHost} onChange={(e) => setNewDockerHost(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none font-mono" placeholder="unix:///var/run/docker.sock or ssh://user@host" /></div><FilterDropdown label="Auth type" value={newAuthType} onChange={setNewAuthType} options={[{ value: "local", label: "Local" }, { value: "ssh", label: "SSH" }, { value: "tcp", label: "TCP" }]} />{newAuthType === "ssh" && <div><label className="mb-1.5 block text-sm font-medium">Jump host</label><input value={newJumpHost} onChange={(e) => setNewJumpHost(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none font-mono" placeholder="e.g. jumpuser@bastion.example.com" /><p className="mt-1 text-xs text-muted-foreground">Optional bastion for ProxyJump/ProxyCommand style access.</p></div>}</div><div className="flex justify-end gap-3 border-t border-border px-6 py-4"><button onClick={() => setShowAddCluster(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-surface-hover">Cancel</button><button onClick={handleCreate} disabled={!newName || !newDockerHost || createMutation.isPending} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{createMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}Connect Swarm</button></div></motion.div></div></>}</AnimatePresence>
    </div>
  );
}
