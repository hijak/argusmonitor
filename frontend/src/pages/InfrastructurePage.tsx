import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Sparkline } from "@/components/Sparkline";
import {
  Search,
  Plus,
  Server,
  Database,
  Container,
  Wifi,
  Activity,
  Clock,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  Copy,
  Trash2,
  Shield,
  TerminalSquare,
  Info,
  RefreshCw,
  Link as LinkIcon,
  KeyRound,
} from "lucide-react";
import { motion } from "framer-motion";
import { HostDetailModal } from "@/components/HostDetailModal";
import { toast } from "@/components/ui/sonner";
import { sortHosts, type HostSortKey } from "@/lib/hostSorting";
import { usePersistentHostSort } from "@/hooks/usePersistentHostSort";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type HostType = "server" | "database" | "container" | "network";

type ManualHostForm = {
  name: string;
  type: HostType;
  ip_address: string;
  os: string;
  tags: string;
};

type EnrollmentInfo = {
  host_id: string;
  token: string;
  expires_at: string | null;
  install_url: string;
  command: string;
};

const typeIcons: Record<HostType, typeof Server> = {
  server: Server,
  database: Database,
  container: Container,
  network: Wifi,
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.02 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };
const HOST_PAGE_SIZE = 100;

function enrollmentBadgeClasses(status: string) {
  switch (status) {
    case "online":
      return "bg-success/10 text-success";
    case "enrolled":
      return "bg-sky-500/10 text-sky-400";
    case "pending":
      return "bg-primary/10 text-primary";
    case "expired":
      return "bg-warning/10 text-warning";
    case "revoked":
      return "bg-critical/10 text-critical";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function EnrollmentBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium capitalize", enrollmentBadgeClasses(status))}>
      <KeyRound className="h-3 w-3" /> {status}
    </span>
  );
}

function MetricPill({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" | "critical" }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 font-mono text-sm font-medium",
          tone === "critical" ? "text-critical" : tone === "warning" ? "text-warning" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function DeleteHostButton({ host, onDelete }: { host: any; onDelete: (host: any) => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onDelete(host);
      }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-critical/30 hover:bg-critical/10 hover:text-critical"
      aria-label={`Delete ${host.name}`}
      title={`Delete ${host.name}`}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function MobileHostCard({ host, onClick, onDelete }: { host: any; onClick: () => void; onDelete: (host: any) => void }) {
  const Icon = typeIcons[host.type as HostType] || Server;
  const cpuTone = host.cpu_percent > 80 ? "critical" : host.cpu_percent > 60 ? "warning" : "default";
  const memTone = host.memory_percent > 80 ? "critical" : host.memory_percent > 60 ? "warning" : "default";

  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-surface-hover">
      <div className="flex items-start justify-between gap-3">
        <button onClick={onClick} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <div className="mt-0.5 rounded-lg bg-surface p-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-mono text-sm font-medium text-foreground">{host.name}</p>
              <StatusBadge variant={host.status}>{host.status}</StatusBadge>
              {host.enrollment_pending && !host.is_agent_connected && (
                <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  <KeyRound className="h-3 w-3" /> Pending
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{host.ip_address || "No IP"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="capitalize">{host.type}</span>
              {host.is_agent_connected && (
                <span className="inline-flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 font-medium text-success">
                  <Activity className="h-3 w-3" /> Live
                </span>
              )}
              {host.last_seen && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(host.last_seen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <DeleteHostButton host={host} onDelete={onDelete} />
          <button onClick={onClick} className="rounded-lg p-1 text-muted-foreground" aria-label={`Open ${host.name}`}>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </button>
        </div>
      </div>

      <button onClick={onClick} className="mt-4 block w-full text-left">
        <div className="grid grid-cols-2 gap-2">
          <MetricPill label="CPU" value={`${Math.round(host.cpu_percent)}%`} tone={cpuTone} />
          <MetricPill label="Memory" value={`${Math.round(host.memory_percent)}%`} tone={memTone} />
          <MetricPill label="Uptime" value={host.uptime || "N/A"} />
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Trend</div>
            <div className="mt-1">
              <Sparkline
                data={host.spark || []}
                color={host.status === "critical" ? "hsl(0 84% 60%)" : host.status === "warning" ? "hsl(38 92% 50%)" : "hsl(160 84% 39%)"}
                width={84}
                height={24}
              />
            </div>
          </div>
        </div>

        {!!host.tags?.length && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(host.tags || []).slice(0, 4).map((tag: string) => (
              <span key={tag} className="rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}
      </button>
    </div>
  );
}

export default function InfrastructurePage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<HostType | "all">("all");
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null);
  const [hostToDelete, setHostToDelete] = useState<any | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingHostId, setOnboardingHostId] = useState<string | null>(null);
  const [manualHostForm, setManualHostForm] = useState<ManualHostForm>({
    name: "",
    type: "server",
    ip_address: "",
    os: "",
    tags: "manual",
  });
  const [enrollmentInfo, setEnrollmentInfo] = useState<EnrollmentInfo | null>(null);

  const { sortKey, sortDirection, toggleSort } = usePersistentHostSort({
    storageKey: "argus-infrastructure-host-sort",
    defaultKey: "status",
    defaultDirection: "asc",
    queryKey: "infraHostSort",
    queryDirection: "infraHostDir",
  });
  const queryClient = useQueryClient();

  const { data: hostsResponse, isLoading } = useQuery({
    queryKey: ["hosts", typeFilter, search, page],
    queryFn: () => api.listHosts({ type: typeFilter === "all" ? undefined : typeFilter, search: search || undefined, limit: HOST_PAGE_SIZE, offset: page * HOST_PAGE_SIZE }),
  });

  const { data: allHostsResponse } = useQuery({
    queryKey: ["hosts-all-counts"],
    queryFn: () => api.listHosts({ limit: 500, offset: 0 }),
  });

  const hosts = hostsResponse?.items || [];
  const allHosts = allHostsResponse?.items || [];
  const totalHosts = hostsResponse?.total || 0;
  const totalHostPages = Math.max(1, Math.ceil(totalHosts / HOST_PAGE_SIZE));

  const createHostMutation = useMutation({
    mutationFn: (payload: any) => api.createHost(payload),
    onSuccess: async (host) => {
      toast.success(`Added ${host.name}`);
      queryClient.invalidateQueries({ queryKey: ["hosts"] });
      queryClient.invalidateQueries({ queryKey: ["hosts-all-counts"] });
      setOnboardingHostId(host.id);
      setSelectedHostId(host.id);
      setManualHostForm({ name: "", type: "server", ip_address: "", os: "", tags: "manual" });
      const tokenInfo = await api.rotateHostEnrollmentToken(host.id);
      setEnrollmentInfo(tokenInfo);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to add host"),
  });

  const rotateEnrollmentMutation = useMutation({
    mutationFn: (hostId: string) => api.rotateHostEnrollmentToken(hostId),
    onSuccess: (data) => {
      setEnrollmentInfo(data);
      queryClient.invalidateQueries({ queryKey: ["hosts"] });
      queryClient.invalidateQueries({ queryKey: ["hosts-all-counts"] });
      toast.success("Enrollment token refreshed");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to refresh install command"),
  });

  const deleteHostMutation = useMutation({
    mutationFn: (id: string) => api.deleteHost(id),
    onSuccess: () => {
      toast.success("Host deleted");
      queryClient.invalidateQueries({ queryKey: ["hosts"] });
      queryClient.invalidateQueries({ queryKey: ["hosts-all-counts"] });
      if (selectedHostId === hostToDelete?.id) setSelectedHostId(null);
      if (onboardingHostId === hostToDelete?.id) {
        setOnboardingHostId(null);
        setEnrollmentInfo(null);
      }
      setHostToDelete(null);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete host"),
  });

  const counts = useMemo(
    () => ({
      all: allHosts.length,
      server: allHosts.filter((h: any) => h.type === "server").length,
      database: allHosts.filter((h: any) => h.type === "database").length,
      container: allHosts.filter((h: any) => h.type === "container").length,
      network: allHosts.filter((h: any) => h.type === "network").length,
    }),
    [allHosts],
  );

  const sortedHosts = useMemo(() => sortHosts(hosts, sortKey, sortDirection), [hosts, sortKey, sortDirection]);
  const onboardingHost = useMemo(() => allHosts.find((host: any) => host.id === onboardingHostId) || null, [allHosts, onboardingHostId]);

  useEffect(() => {
    if (!onboardingOpen) {
      setEnrollmentInfo(null);
      setOnboardingHostId(null);
    }
  }, [onboardingOpen]);

  const submitManualHost = () => {
    if (!manualHostForm.name.trim()) {
      toast.error("Host name is required");
      return;
    }
    createHostMutation.mutate({
      name: manualHostForm.name.trim(),
      type: manualHostForm.type,
      ip_address: manualHostForm.ip_address.trim() || null,
      os: manualHostForm.os.trim() || null,
      tags: manualHostForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
  };

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const refreshEnrollment = async () => {
    if (!onboardingHostId) {
      toast.error("Create or select a host first");
      return;
    }
    rotateEnrollmentMutation.mutate(onboardingHostId);
  };

  return (
    <>
      <motion.div className="space-y-4 p-4 sm:space-y-6 sm:p-6" variants={container} initial="hidden" animate="show">
        <motion.div variants={item}>
          <PageHeader title="Infrastructure" description="Monitored hosts and devices">
            <button
              onClick={() => setOnboardingOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Add Host
            </button>
          </PageHeader>
        </motion.div>

        <motion.div variants={item} className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center">
          <div className="relative w-full xl:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search hosts..."
              className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-card p-1">
            <div className="flex min-w-max items-center gap-1">
              {(["all", "server", "database", "container", "network"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                    typeFilter === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)} ({counts[t]})
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground xl:justify-start">
            <Activity className="h-3.5 w-3.5 text-success" />
            <span>{allHosts.filter((h: any) => h.is_agent_connected).length} live agent hosts</span>
          </div>
        </motion.div>

        <motion.div variants={item} className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Shield className="h-4 w-4 text-primary" /> Host onboarding
              </div>
              <p className="text-sm text-muted-foreground">
                Per-host enrollment tokens, same-origin install commands, and manual registration for static entries.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => setOnboardingOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
              >
                <TerminalSquare className="h-4 w-4" /> Start onboarding
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div variants={item} className="space-y-3 lg:hidden">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Hosts</h3>
              <span className="text-xs text-muted-foreground">{sortedHosts.length}</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {(["status", "cpu", "memory", "uptime"] as HostSortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => toggleSort(key)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 capitalize",
                    sortKey === key ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-background text-foreground",
                  )}
                >
                  {key}
                  {sortKey === key && (sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                </button>
              ))}
            </div>
          </div>

          {sortedHosts.map((host: any) => (
            <motion.div key={host.id} variants={item}>
              <MobileHostCard host={host} onClick={() => setSelectedHostId(host.id)} onDelete={setHostToDelete} />
            </motion.div>
          ))}

          {isLoading && <div className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Loading hosts...</div>}
          {!isLoading && sortedHosts.length === 0 && <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">No hosts match the current filters.</div>}
        </motion.div>

        <motion.div variants={item} className="hidden overflow-hidden rounded-lg border border-border bg-card lg:block">
          <div className="grid grid-cols-[1fr_100px_80px_80px_90px_80px_120px_56px] items-center gap-4 border-b border-border px-5 py-3 text-xs font-medium text-muted-foreground">
            {([
              ["name", "Host"],
              ["status", "Status"],
              ["cpu", "CPU"],
              ["memory", "Memory"],
              ["uptime", "Uptime"],
            ] as [HostSortKey, string][]).map(([key, label], index) => (
              <button
                key={key}
                onClick={() => toggleSort(key)}
                className={`flex items-center gap-1 text-left ${index === 0 ? "" : "justify-start"} ${sortKey === key ? "text-primary" : "hover:text-foreground"}`}
              >
                <span>{label}</span>
                {sortKey === key && (sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
              </button>
            ))}
            <span>Trend</span>
            <span>Tags</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-border">
            {sortedHosts.map((host: any) => {
              const Icon = typeIcons[host.type as HostType] || Server;
              return (
                <motion.div
                  key={host.id}
                  variants={item}
                  className="grid grid-cols-[1fr_100px_80px_80px_90px_80px_120px_56px] items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-hover"
                >
                  <button onClick={() => setSelectedHostId(host.id)} className="flex min-w-0 items-center gap-3 text-left">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-mono text-sm">{host.name}</p>
                        {host.is_agent_connected && (
                          <span className="inline-flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                            <Activity className="h-2.5 w-2.5" /> Live
                          </span>
                        )}
                        {host.enrollment_pending && !host.is_agent_connected && (
                          <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            <KeyRound className="h-2.5 w-2.5" /> Pending
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{host.ip_address || "No IP"}</p>
                    </div>
                  </button>
                  <StatusBadge variant={host.status}>{host.status}</StatusBadge>
                  <span className={`font-mono text-sm ${host.cpu_percent > 80 ? "text-critical" : host.cpu_percent > 60 ? "text-warning" : "text-foreground"}`}>{Math.round(host.cpu_percent)}%</span>
                  <span className={`font-mono text-sm ${host.memory_percent > 80 ? "text-critical" : host.memory_percent > 60 ? "text-warning" : "text-foreground"}`}>{Math.round(host.memory_percent)}%</span>
                  <div className="space-y-0.5">
                    <span className="block font-mono text-sm text-muted-foreground">{host.uptime || "N/A"}</span>
                    {host.last_seen && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" /> {new Date(host.last_seen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                  <Sparkline
                    data={host.spark || []}
                    color={host.status === "critical" ? "hsl(0 84% 60%)" : host.status === "warning" ? "hsl(38 92% 50%)" : "hsl(160 84% 39%)"}
                    width={64}
                    height={20}
                  />
                  <div className="flex gap-1 overflow-hidden">
                    {(host.tags || []).slice(0, 2).map((tag: string) => (
                      <span key={tag} className="truncate rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <DeleteHostButton host={host} onDelete={setHostToDelete} />
                  </div>
                </motion.div>
              );
            })}
            {isLoading && <div className="px-5 py-8 text-center text-sm text-muted-foreground">Loading hosts...</div>}
            {!isLoading && sortedHosts.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted-foreground">No hosts match the current filters.</div>}
          </div>
        </motion.div>

        <motion.div variants={item} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{hosts.length}</span> of <span className="font-medium text-foreground">{totalHosts}</span> hosts
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0}
              className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <div className="rounded-lg bg-surface px-3 py-2 text-sm text-muted-foreground">
              Page <span className="font-medium text-foreground">{page + 1}</span> / {totalHostPages}
            </div>
            <button
              onClick={() => setPage((current) => Math.min(totalHostPages - 1, current + 1))}
              disabled={page >= totalHostPages - 1}
              className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </motion.div>

        <HostDetailModal hostId={selectedHostId} variant="detailed" onClose={() => setSelectedHostId(null)} />
      </motion.div>

      <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Add host</DialogTitle>
            <DialogDescription>
              Create a host entry, then generate a same-origin install command with a dynamic per-host enrollment token.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <TerminalSquare className="h-4 w-4 text-primary" /> Agent onboarding
              </div>
              <p className="text-sm text-muted-foreground">
                Create or choose the host entry first. Then Vordr generates a one-off install command tied to that specific host and the same origin you are viewing.
              </p>

              <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 text-sm text-muted-foreground">
                <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                  <Info className="h-4 w-4 text-primary" /> What changed
                </div>
                <ul className="space-y-1.5 pl-5 text-sm list-disc">
                  <li>No more static shared onboarding token in the UI path.</li>
                  <li>The install command uses the same app origin you opened.</li>
                  <li>Each host gets its own rotatable enrollment token.</li>
                </ul>
              </div>

              <div className="rounded-lg border border-border bg-background p-3">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Enrollment target</span>
                  {onboardingHost && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-foreground">
                      <LinkIcon className="h-3 w-3" /> {onboardingHost.name}
                    </span>
                  )}
                </div>

                {!onboardingHost ? (
                  <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                    Create a manual host entry below to generate a unique install command.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button
                        onClick={refreshEnrollment}
                        disabled={rotateEnrollmentMutation.isPending}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-hover disabled:opacity-50"
                      >
                        <RefreshCw className={cn("h-4 w-4", rotateEnrollmentMutation.isPending && "animate-spin")} />
                        {enrollmentInfo ? "Rotate token" : "Generate install command"}
                      </button>
                      <button
                        onClick={() => onboardingHostId && revokeEnrollmentMutation.mutate(onboardingHostId)}
                        disabled={!onboardingHostId || revokeEnrollmentMutation.isPending}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-critical/30 bg-critical/5 px-3 py-2 text-sm font-medium text-critical hover:bg-critical/10 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" /> Revoke token
                      </button>
                      {enrollmentInfo?.expires_at && (
                        <div className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
                          Expires: {new Date(enrollmentInfo.expires_at).toLocaleString()}
                        </div>
                      )}
                      {enrollmentInfo?.scope && (
                        <div className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground capitalize">
                          Scope: {enrollmentInfo.scope}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-muted-foreground">Install command</span>
                        <button
                          onClick={() => enrollmentInfo?.command && copyText(enrollmentInfo.command, "Install command")}
                          disabled={!enrollmentInfo?.command}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-surface-hover disabled:opacity-50"
                        >
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                      </div>
                      <code className="block overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                        {enrollmentInfo?.command || "Generate an install command for this host."}
                      </code>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-muted-foreground">Install URL</span>
                        <button
                          onClick={() => enrollmentInfo?.install_url && copyText(enrollmentInfo.install_url, "Install URL")}
                          disabled={!enrollmentInfo?.install_url}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-surface-hover disabled:opacity-50"
                        >
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                      </div>
                      <code className="block overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                        {enrollmentInfo?.install_url || "No same-origin install URL generated yet."}
                      </code>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Server className="h-4 w-4 text-primary" /> Manual registration
              </div>
              <p className="text-sm text-muted-foreground">
                Create the host record first. That gives you something concrete to enroll, track, and revoke later.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Host name</label>
                  <input
                    value={manualHostForm.name}
                    onChange={(e) => setManualHostForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
                    placeholder="db-01"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["server", "database", "container", "network"] as HostType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => setManualHostForm((f) => ({ ...f, type }))}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm capitalize transition-colors",
                          manualHostForm.type === type ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:bg-surface-hover",
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">IP address</label>
                  <input
                    value={manualHostForm.ip_address}
                    onChange={(e) => setManualHostForm((f) => ({ ...f, ip_address: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
                    placeholder="10.13.37.41"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Operating system</label>
                  <input
                    value={manualHostForm.os}
                    onChange={(e) => setManualHostForm((f) => ({ ...f, os: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
                    placeholder="Ubuntu 24.04"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tags</label>
                  <input
                    value={manualHostForm.tags}
                    onChange={(e) => setManualHostForm((f) => ({ ...f, tags: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
                    placeholder="manual, prod"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <button onClick={() => setOnboardingOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-hover">
              Close
            </button>
            <button
              onClick={submitManualHost}
              disabled={createHostMutation.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createHostMutation.isPending ? "Creating..." : "Create host and generate token"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!hostToDelete} onOpenChange={(open) => !open && setHostToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete host</DialogTitle>
            <DialogDescription>
              Remove <span className="font-mono text-foreground">{hostToDelete?.name}</span> from Infrastructure? This removes the host record and its metrics history from the current workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-critical/20 bg-critical/5 p-3 text-sm text-muted-foreground">
            If the agent is still running, it may re-register itself on the next heartbeat unless you also rotate/revoke its enrollment path.
          </div>
          <DialogFooter>
            <button onClick={() => setHostToDelete(null)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-hover">
              Cancel
            </button>
            <button
              onClick={() => hostToDelete && deleteHostMutation.mutate(hostToDelete.id)}
              disabled={deleteHostMutation.isPending}
              className="rounded-lg bg-critical px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {deleteHostMutation.isPending ? "Deleting..." : "Delete host"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}