import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { MetricCard } from "@/components/MetricCard";
import { SectionCard } from "@/components/SectionCard";
import { Bell, User, CheckCircle2, Siren, Plus, ShieldAlert, Clock3, Route, Pencil, Trash2, BellOff, Wrench, MoreHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.02 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

function pillClasses(active: boolean) {
  return active
    ? "bg-primary text-primary-foreground shadow-sm"
    : "text-muted-foreground hover:bg-surface hover:text-foreground";
}

function scopeLabel(rule: any) {
  const parts = [rule.scope?.plugin_id, rule.scope?.service_type, rule.scope?.service_id, rule.scope?.host_id].filter(Boolean);
  return parts.length ? parts.join(" · ") : "workspace-wide";
}

function formatOwnershipLabel(ownership: any) {
  if (!ownership || Object.keys(ownership).length === 0) return null;
  const primary = ownership.primary_ref ? `${ownership.primary_type || "target"}:${ownership.primary_ref}` : null;
  const secondary = ownership.secondary_ref ? `${ownership.secondary_type || "target"}:${ownership.secondary_ref}` : null;
  const policy = ownership.escalation_policy_ref || ownership.escalation_policy || null;
  return [primary, secondary ? `fallback ${secondary}` : null, policy ? `policy ${policy}` : null].filter(Boolean).join(" · ");
}

function routeLabel(rule: any, teams: any[]) {
  const ownershipLabel = formatOwnershipLabel(rule.ownership);
  if (ownershipLabel) return ownershipLabel;
  if (!rule.oncall_team_id) return "workspace default route";
  const team = teams.find((entry: any) => entry.id === rule.oncall_team_id);
  return team ? team.name : "team route";
}

function toLocalDateTimeInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function servicePresetRecommendations(services: any[], presets: any[]) {
  const presetById = new Map((presets || []).map((preset: any) => [preset.id, preset]));
  const seen = new Set<string>();
  const recommended: any[] = [];

  for (const service of services || []) {
    const contract = service?.plugin_metadata?.plugin_contract || {};
    const profiles = Array.isArray(contract?.profiles) ? contract.profiles : [];
    for (const profile of profiles) {
      const presetIds = Array.isArray(profile?.alertPresetIds) ? profile.alertPresetIds : [];
      for (const presetId of presetIds) {
        const preset = presetById.get(presetId);
        if (!preset || seen.has(presetId)) continue;
        seen.add(presetId);
        recommended.push({
          ...preset,
          plugin_id: service?.plugin_id || contract?.plugin_id || null,
          profile_id: profile?.id || null,
          source: "plugin-profile",
          recommendation_reason: `${service?.name || service?.plugin_id || "service"} matches profile ${profile?.name || profile?.id || "profile"}`,
        });
      }
    }
  }

  return recommended;
}

function RuleDialog({ open, onOpenChange, onSubmit, pending, teams, policies, services, presets, initialRule }: any) {
  const [name, setName] = useState("");
  const [severity, setSeverity] = useState("warning");
  const [targetType, setTargetType] = useState("service");
  const [metric, setMetric] = useState("latency_ms");
  const [operator, setOperator] = useState(">");
  const [threshold, setThreshold] = useState("250");
  const [cooldownSeconds, setCooldownSeconds] = useState("300");
  const [pluginId, setPluginId] = useState("all");
  const [serviceType, setServiceType] = useState("all");
  const [serviceId, setServiceId] = useState("all");
  const [hostId, setHostId] = useState("all");
  const [teamId, setTeamId] = useState("none");
  const [policyId, setPolicyId] = useState("none");
  const [primaryOwnerType, setPrimaryOwnerType] = useState("none");
  const [primaryOwnerRef, setPrimaryOwnerRef] = useState("");
  const [secondaryOwnerType, setSecondaryOwnerType] = useState("none");
  const [secondaryOwnerRef, setSecondaryOwnerRef] = useState("");
  const [ownershipPolicyRef, setOwnershipPolicyRef] = useState("");

  const uniquePluginIds = useMemo(() => Array.from(new Set((services || []).map((s: any) => s.plugin_id).filter(Boolean))).sort(), [services]);
  const uniqueServiceTypes = useMemo(() => Array.from(new Set((services || []).map((s: any) => s.service_type).filter(Boolean))).sort(), [services]);
  const uniqueHosts = useMemo(
    () => Array.from(new Map((services || []).filter((s: any) => s.host_id).map((s: any) => [s.host_id, { id: s.host_id, name: s.host_name || s.host_id }])).values()),
    [services],
  );
  const recommendedPresets = useMemo(() => servicePresetRecommendations(services, presets), [services, presets]);
  const visiblePresets = useMemo(() => {
    const hostPresets = (presets || []).filter((preset: any) => preset.target_type === "host");
    const fallbackServicePresets = (presets || []).filter((preset: any) => preset.target_type === "service").slice(0, 4);
    return [...recommendedPresets, ...hostPresets, ...fallbackServicePresets].filter((preset: any, index: number, arr: any[]) => arr.findIndex((entry) => entry.id === preset.id) === index).slice(0, 8);
  }, [recommendedPresets, presets]);

  const isHostTarget = targetType === "host";
  const metricOptions = isHostTarget
    ? [
        { value: "cpu_percent", label: "CPU %" },
        { value: "memory_percent", label: "Memory %" },
        { value: "disk_percent", label: "Disk %" },
      ]
    : [
        { value: "latency_ms", label: "Latency (ms)" },
        { value: "uptime_percent", label: "Uptime %" },
        { value: "requests_per_min", label: "Requests / min" },
      ];

  useEffect(() => {
    if (!open) return;
    if (initialRule) {
      setName(initialRule.name || "");
      setSeverity(initialRule.severity || "warning");
      setTargetType(initialRule.target_type || "service");
      setMetric(initialRule.condition?.metric || "latency_ms");
      setOperator(initialRule.condition?.operator || ">");
      setThreshold(String(initialRule.condition?.value ?? 250));
      setCooldownSeconds(String(initialRule.cooldown_seconds ?? 300));
      setPluginId(initialRule.scope?.plugin_id || "all");
      setServiceType(initialRule.scope?.service_type || "all");
      setServiceId(initialRule.scope?.service_id || (initialRule.target_type === "service" && initialRule.target_id ? String(initialRule.target_id) : "all"));
      setHostId(initialRule.scope?.host_id || (initialRule.target_type === "host" && initialRule.target_id ? String(initialRule.target_id) : "all"));
      setTeamId(initialRule.oncall_team_id || "none");
      setPolicyId(initialRule.escalation_policy_id || "none");
      setPrimaryOwnerType(initialRule.ownership?.primary_type || "none");
      setPrimaryOwnerRef(initialRule.ownership?.primary_ref || "");
      setSecondaryOwnerType(initialRule.ownership?.secondary_type || "none");
      setSecondaryOwnerRef(initialRule.ownership?.secondary_ref || "");
      setOwnershipPolicyRef(initialRule.ownership?.escalation_policy_ref || "");
      return;
    }

    setName("");
    setSeverity("warning");
    setTargetType("service");
    setMetric("latency_ms");
    setOperator(">");
    setThreshold("250");
    setCooldownSeconds("300");
    setPluginId("all");
    setServiceType("all");
    setServiceId("all");
    setHostId("all");
    setTeamId("none");
    setPolicyId("none");
    setPrimaryOwnerType("none");
    setPrimaryOwnerRef("");
    setSecondaryOwnerType("none");
    setSecondaryOwnerRef("");
    setOwnershipPolicyRef("");
  }, [open, initialRule]);

  useEffect(() => {
    if (isHostTarget) {
      setMetric((current) => (["cpu_percent", "memory_percent", "disk_percent"].includes(current) ? current : "cpu_percent"));
      setPluginId("all");
      setServiceType("all");
      setServiceId("all");
    } else {
      setMetric((current) => (["latency_ms", "uptime_percent", "requests_per_min"].includes(current) ? current : "latency_ms"));
      setHostId("all");
    }
  }, [isHostTarget]);

  const applyPreset = (preset: any) => {
    setName(preset.label);
    setSeverity(preset.severity);
    setTargetType(preset.target_type);
    setMetric(preset.condition.metric);
    setOperator(preset.condition.operator);
    setThreshold(String(preset.condition.value));
    setCooldownSeconds(String(preset.cooldown_seconds || 300));
    setPluginId(preset.scope?.plugin_id || preset.plugin_id || "all");
    setServiceType(preset.scope?.service_type || "all");
    setServiceId("all");
    setHostId("all");
  };

  const submit = () => {
    const scope: any = {};
    if (pluginId !== "all") scope.plugin_id = pluginId;
    if (serviceType !== "all") scope.service_type = serviceType;
    if (serviceId !== "all") scope.service_id = serviceId;
    if (hostId !== "all") scope.host_id = hostId;

    onSubmit({
      name: name.trim(),
      severity,
      type: "threshold",
      target_type: targetType,
      target_id:
        serviceId !== "all" && targetType === "service"
          ? serviceId
          : hostId !== "all" && targetType === "host"
            ? hostId
            : null,
      condition: {
        metric,
        operator,
        value: Number(threshold),
      },
      scope,
      ownership: {
        primary_type: primaryOwnerType === "none" ? null : primaryOwnerType,
        primary_ref: primaryOwnerRef.trim() || null,
        secondary_type: secondaryOwnerType === "none" ? null : secondaryOwnerType,
        secondary_ref: secondaryOwnerRef.trim() || null,
        escalation_policy_ref: ownershipPolicyRef.trim() || null,
      },
      oncall_team_id: teamId === "none" ? null : teamId,
      escalation_policy_id: policyId === "none" ? null : policyId,
      cooldown_seconds: Number(cooldownSeconds || 300),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{initialRule ? "Edit alert rule" : "Create alert rule"}</DialogTitle>
          <DialogDescription>Scope alerts to hosts, services, plugins, and on-call teams.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {!initialRule && (
            <div className="space-y-2">
              <Label>Quick presets</Label>
              <div className="flex flex-wrap gap-2">
                {visiblePresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-surface-hover"
                    title={preset.recommendation_reason || preset.description || preset.label}
                  >
                    {preset.label}
                    {preset.profile_id ? ` · ${preset.profile_id}` : ""}
                  </button>
                ))}
              </div>
              {recommendedPresets.length > 0 && (
                <p className="text-xs text-muted-foreground">Recommended from live plugin/profile matches, plus a few core fallbacks.</p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rule-name">Rule name</Label>
              <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Redis latency above 75ms" />
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target type</Label>
              <Select value={targetType} onValueChange={setTargetType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="host">Host</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Metric</Label>
              <Select value={metric} onValueChange={setMetric}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {metricOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Operator</Label>
              <Select value={operator} onValueChange={setOperator}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[">", ">=", "<", "<=", "==", "!="].map((value) => (
                    <SelectItem key={value} value={value}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold">Threshold</Label>
              <Input id="threshold" type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cooldown">Cooldown seconds</Label>
              <Input id="cooldown" type="number" value={cooldownSeconds} onChange={(e) => setCooldownSeconds(e.target.value)} />
            </div>
          </div>

          <div className="min-h-[188px]">
            <div className="grid gap-4 sm:grid-cols-2">
              {isHostTarget ? (
                <>
                  <div className="space-y-2">
                    <Label>Host scope</Label>
                    <Select value={hostId} onValueChange={setHostId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any host</SelectItem>
                        {uniqueHosts.map((host: any) => (
                          <SelectItem key={host.id} value={host.id}>{host.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Host targeting</Label>
                    <div className="flex min-h-10 items-center rounded-md border border-border bg-background px-3 text-sm text-muted-foreground">
                      Host rules can target a specific host or apply workspace-wide.
                    </div>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Scope preview</Label>
                    <div className="rounded-md border border-dashed border-border bg-background/50 px-3 py-3 text-sm text-muted-foreground">
                      {hostId === "all" ? "All hosts in this workspace" : `Only host: ${uniqueHosts.find((host: any) => host.id === hostId)?.name || hostId}`}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Plugin scope</Label>
                    <Select value={pluginId} onValueChange={setPluginId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any plugin</SelectItem>
                        {uniquePluginIds.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Service type</Label>
                    <Select value={serviceType} onValueChange={setServiceType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any service type</SelectItem>
                        {uniqueServiceTypes.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Specific service</Label>
                    <Select value={serviceId} onValueChange={setServiceId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any service</SelectItem>
                        {(services || []).map((service: any) => <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Service targeting</Label>
                    <div className="flex min-h-10 items-center rounded-md border border-border bg-background px-3 text-sm text-muted-foreground">
                      Filter by plugin, service type, or lock to a single service.
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>On-call team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Workspace default</SelectItem>
                  {(teams || []).map((team: any) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Escalation policy</Label>
              <Select value={policyId} onValueChange={setPolicyId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default policy matching</SelectItem>
                  {(policies || []).map((policy: any) => <SelectItem key={policy.id} value={policy.id}>{policy.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
            <div className="mb-3 text-sm font-semibold text-foreground">Ownership routing overlay</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Primary owner type</Label>
                <Select value={primaryOwnerType} onValueChange={setPrimaryOwnerType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="policy">Policy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Primary owner ref</Label>
                <Input value={primaryOwnerRef} onChange={(e) => setPrimaryOwnerRef(e.target.value)} placeholder="mr-a / payments-primary" />
              </div>
              <div className="space-y-2">
                <Label>Secondary owner type</Label>
                <Select value={secondaryOwnerType} onValueChange={setSecondaryOwnerType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="policy">Policy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Secondary owner ref</Label>
                <Input value={secondaryOwnerRef} onChange={(e) => setSecondaryOwnerRef(e.target.value)} placeholder="mr-b / ops-backup" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Ownership escalation policy ref</Label>
                <Input value={ownershipPolicyRef} onChange={(e) => setOwnershipPolicyRef(e.target.value)} placeholder="payments-critical" />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>
          <button type="button" disabled={pending || !name.trim()} onClick={submit} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {pending ? (initialRule ? "Saving..." : "Creating...") : (initialRule ? "Save changes" : "Create rule")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SilenceDialog({ open, onOpenChange, onSubmit, pending, workspaceId, alert }: any) {
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [startsAt, setStartsAt] = useState(toLocalDateTimeInputValue(new Date()));
  const [endsAt, setEndsAt] = useState(toLocalDateTimeInputValue(new Date(Date.now() + 60 * 60 * 1000)));

  useEffect(() => {
    if (!open || !alert) return;
    setName(`Silence: ${alert.service || alert.host || alert.message}`);
    setReason(alert.message || "");
    setStartsAt(toLocalDateTimeInputValue(new Date()));
    setEndsAt(toLocalDateTimeInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  }, [open, alert]);

  const matcher: any = {};
  if (alert?.service) matcher.service = alert.service;
  if (alert?.host) matcher.host = alert.host;
  if (alert?.severity) matcher.severity = alert.severity;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create silence</DialogTitle>
          <DialogDescription>Suppress alerts matching this alert pattern for a fixed time window.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Deploy in progress" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Starts</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ends</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Matcher preview</Label>
            <div className="rounded-md border border-dashed border-border bg-background/50 px-3 py-3 text-sm text-muted-foreground">
              {Object.keys(matcher).length ? JSON.stringify(matcher) : "No matcher context"}
            </div>
          </div>
        </div>
        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>
          <button
            type="button"
            disabled={pending || !workspaceId || !name.trim()}
            onClick={() => onSubmit({
              workspace_id: workspaceId,
              name: name.trim(),
              matcher,
              starts_at: new Date(startsAt).toISOString(),
              ends_at: new Date(endsAt).toISOString(),
              reason: reason.trim() || null,
            })}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Creating..." : "Create silence"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MaintenanceDialog({ open, onOpenChange, onSubmit, pending, workspaceId, alert }: any) {
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [startsAt, setStartsAt] = useState(toLocalDateTimeInputValue(new Date()));
  const [endsAt, setEndsAt] = useState(toLocalDateTimeInputValue(new Date(Date.now() + 60 * 60 * 1000)));

  useEffect(() => {
    if (!open || !alert) return;
    setName(`Maintenance: ${alert.service || alert.host || "alert scope"}`);
    setReason(alert.message || "");
    setStartsAt(toLocalDateTimeInputValue(new Date()));
    setEndsAt(toLocalDateTimeInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  }, [open, alert]);

  let scopeType = "all";
  let scope: any = {};
  if (alert?.service) {
    scopeType = "service";
    scope = { services: [alert.service] };
  } else if (alert?.host) {
    scopeType = "host";
    scope = { hosts: [alert.host] };
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create maintenance window</DialogTitle>
          <DialogDescription>Suppress matching alerts during planned maintenance.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Scheduled upgrade" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Starts</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ends</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Scope preview</Label>
            <div className="rounded-md border border-dashed border-border bg-background/50 px-3 py-3 text-sm text-muted-foreground">
              {scopeType} · {JSON.stringify(scope)}
            </div>
          </div>
        </div>
        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>
          <button
            type="button"
            disabled={pending || !workspaceId || !name.trim()}
            onClick={() => onSubmit({
              workspace_id: workspaceId,
              name: name.trim(),
              starts_at: new Date(startsAt).toISOString(),
              ends_at: new Date(endsAt).toISOString(),
              scope_type: scopeType,
              scope,
              reason: reason.trim() || null,
            })}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Creating..." : "Create maintenance"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AlertsPage() {
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const [alertView, setAlertView] = useState<"active" | "resolved" | "all">("active");
  const [showAcked, setShowAcked] = useState(true);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [silenceAlert, setSilenceAlert] = useState<any | null>(null);
  const [maintenanceAlert, setMaintenanceAlert] = useState<any | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<any | null>(null);
  const [deleteRuleHistoryToo, setDeleteRuleHistoryToo] = useState(false);
  const [selectedAlertIds, setSelectedAlertIds] = useState<string[]>([]);
  const [bulkAckReason, setBulkAckReason] = useState("");
  const [bulkResolveMessage, setBulkResolveMessage] = useState("");
  const queryClient = useQueryClient();

  const { data: alertSummary } = useQuery({ queryKey: ["alert-summary"], queryFn: api.alertSummary, refetchInterval: 15000 });

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts", filter, showAcked, alertView],
    queryFn: () => api.listAlerts({
      severity: filter === "all" ? undefined : filter,
      acknowledged: alertView === "resolved" ? undefined : showAcked ? undefined : false,
      resolved: alertView === "active" ? false : alertView === "resolved" ? true : undefined,
    }),
    refetchInterval: 15000,
  });
  const { data: rules = [] } = useQuery({ queryKey: ["alert-rules"], queryFn: api.listAlertRules });
  const { data: presets = [] } = useQuery({ queryKey: ["alert-presets"], queryFn: api.listAlertPresets });
  const { data: services = [] } = useQuery({ queryKey: ["services", "alerts-builder"], queryFn: () => api.listServices().then((r: any) => r.items || []) });
  const { data: teams = [] } = useQuery({ queryKey: ["oncall-teams", "alerts-builder"], queryFn: api.listOnCallTeams });
  const { data: workspaces = [] } = useQuery({ queryKey: ["workspaces", "alerts-builder"], queryFn: () => api.listWorkspaces() });
  const workspaceId = workspaces[0]?.id;
  const { data: policies = [] } = useQuery({
    queryKey: ["escalation-policies", workspaceId],
    queryFn: () => workspaceId ? api.listEscalationPolicies(workspaceId) : Promise.resolve([]),
  });

  const ackMutation = useMutation({
    mutationFn: (id: string) => api.acknowledgeAlert(id),
    onSuccess: () => {
      toast.success("Alert acknowledged");
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to acknowledge alert"),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.resolveAlert(id),
    onSuccess: () => {
      toast.success("Alert resolved");
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to resolve alert"),
  });

  const bulkAckMutation = useMutation({
    mutationFn: () => api.bulkAcknowledgeAlerts(selectedAlertIds, bulkAckReason),
    onSuccess: () => {
      toast.success(`Acknowledged ${selectedAlertIds.length} alerts`);
      setSelectedAlertIds([]);
      setBulkAckReason("");
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to acknowledge selected alerts"),
  });

  const bulkResolveMutation = useMutation({
    mutationFn: () => api.bulkResolveAlerts(selectedAlertIds, bulkResolveMessage),
    onSuccess: () => {
      toast.success(`Resolved ${selectedAlertIds.length} alerts`);
      setSelectedAlertIds([]);
      setBulkResolveMessage("");
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to resolve selected alerts"),
  });

  const createRuleMutation = useMutation({
    mutationFn: (payload: any) => api.createAlertRule(payload),
    onSuccess: () => {
      toast.success("Alert rule created");
      setRuleDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create alert rule"),
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.updateAlertRule(id, payload),
    onSuccess: () => {
      toast.success("Alert rule updated");
      setEditingRule(null);
      setRuleDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update alert rule"),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: ({ id, deleteHistory }: { id: string; deleteHistory: boolean }) => api.deleteAlertRule(id, deleteHistory),
    onSuccess: (_data, variables) => {
      toast.success(variables.deleteHistory ? "Alert rule and history deleted" : "Alert rule deleted; history kept");
      setRuleToDelete(null);
      setDeleteRuleHistoryToo(false);
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete alert rule"),
  });

  const createSilenceMutation = useMutation({
    mutationFn: (payload: any) => api.createSilence(payload),
    onSuccess: () => {
      toast.success("Silence created");
      setSilenceAlert(null);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create silence"),
  });

  const createMaintenanceMutation = useMutation({
    mutationFn: (payload: any) => api.createMaintenanceWindow(payload),
    onSuccess: () => {
      toast.success("Maintenance window created");
      setMaintenanceAlert(null);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create maintenance window"),
  });

  const counts = useMemo(() => ({
    all: alerts.length,
    critical: alerts.filter((a: any) => a.severity === "critical").length,
    warning: alerts.filter((a: any) => a.severity === "warning").length,
    info: alerts.filter((a: any) => a.severity === "info").length,
    active: alerts.filter((a: any) => !a.resolved).length,
    acknowledged: alerts.filter((a: any) => a.acknowledged).length,
    routed: alerts.filter((a: any) => a.assigned_user || a.assigned_team_id).length,
  }), [alerts]);

  const summaryCards = [
    { label: "Active alerts", value: counts.active, icon: <Bell className="h-4 w-4 text-primary" /> },
    { label: "Critical", value: counts.critical, icon: <ShieldAlert className="h-4 w-4 text-critical" /> },
    { label: "Acknowledged", value: counts.acknowledged, icon: <CheckCircle2 className="h-4 w-4 text-success" /> },
    { label: "Rules", value: rules.length, icon: <Siren className="h-4 w-4 text-warning" /> },
  ];

  const ruleById = useMemo(() => new Map(rules.map((rule: any) => [rule.id, rule])), [rules]);
  const selectableAlerts = useMemo(() => alertView === "active" ? alerts.filter((alert: any) => !alert.resolved) : [], [alerts, alertView]);
  const allVisibleSelected = selectableAlerts.length > 0 && selectableAlerts.every((alert: any) => selectedAlertIds.includes(alert.id));

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <motion.div className="space-y-5 p-4 sm:space-y-6 sm:p-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Alerts" description="Live incidents, rule routing, silences, and maintenance windows.">
          <button
            onClick={() => {
              setEditingRule(null);
              setRuleDialogOpen(true);
            }}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Create Rule
          </button>
        </PageHeader>
      </motion.div>

      <motion.div variants={item} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <MetricCard key={card.label} label={card.label} value={card.value} icon={card.icon} className="p-4" />
        ))}
      </motion.div>

      <motion.div variants={item}>
        <SectionCard
          title="Alert views"
          description="Switch between active, resolved, and full alert history, then narrow by severity."
          icon={<Bell className="h-4 w-4" />}
          actions={
            alertView !== "resolved" ? (
              <button
                onClick={() => setShowAcked((v) => !v)}
                className={`min-h-10 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${showAcked ? "border-border text-muted-foreground hover:bg-surface-hover" : "border-primary/30 bg-primary/5 text-primary"}`}
              >
                {showAcked ? "Hide acknowledged" : "Show acknowledged"}
              </button>
            ) : null
          }
          contentClassName="p-4 sm:p-5"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {([
                { value: "active", label: "Active", count: counts.active },
                { value: "resolved", label: "Resolved", count: counts.resolved },
                { value: "all", label: "All", count: counts.all },
              ] as const).map((view) => (
                <button
                  key={view.value}
                  type="button"
                  onClick={() => {
                    setAlertView(view.value);
                    setSelectedAlertIds([]);
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${pillClasses(alertView === view.value)}`}
                >
                  {view.label}
                  <span className="ml-2 rounded bg-black/10 px-1.5 py-0.5 text-[11px] leading-none text-current/90">{view.count}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "critical", "warning", "info"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${pillClasses(filter === value)}`}
                >
                  {value === "all" ? "All severities" : value.charAt(0).toUpperCase() + value.slice(1)}
                  <span className="ml-2 rounded bg-black/10 px-1.5 py-0.5 text-[11px] leading-none text-current/90">
                    {counts[value]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </SectionCard>
      </motion.div>

      {alertView === "active" && selectedAlertIds.length > 0 && (
        <motion.div variants={item} className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">{selectedAlertIds.length} alerts selected</div>
              <div className="text-xs text-muted-foreground">Bulk acknowledge or resolve the currently visible selection.</div>
            </div>
            <button onClick={() => setSelectedAlertIds([])} className="text-xs text-muted-foreground hover:text-foreground">Clear selection</button>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Bulk ack reason</label>
              <input value={bulkAckReason} onChange={(e) => setBulkAckReason(e.target.value)} placeholder="Optional acknowledgement reason" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
              <button onClick={() => bulkAckMutation.mutate()} disabled={bulkAckMutation.isPending} className="min-h-10 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-hover disabled:opacity-50">
                {bulkAckMutation.isPending ? "Acknowledging..." : "Acknowledge selected"}
              </button>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Bulk resolution message</label>
              <input value={bulkResolveMessage} onChange={(e) => setBulkResolveMessage(e.target.value)} placeholder="Required resolution message" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
              <button onClick={() => bulkResolveMutation.mutate()} disabled={bulkResolveMutation.isPending || !bulkResolveMessage.trim()} className="min-h-10 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {bulkResolveMutation.isPending ? "Resolving..." : "Resolve selected"}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div variants={item} className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_380px]">
        <SectionCard
          title="Live alert feed"
          description="Newest alerts first, with acknowledgement, rule editing, silence, and maintenance controls."
          icon={<ShieldAlert className="h-4 w-4" />}
          contentClassName="p-0"
        >
          {alertView === "active" ? (
            <div className="border-b border-border/80 px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center gap-3">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={(checked) => setSelectedAlertIds(checked ? selectableAlerts.map((alert: any) => alert.id) : [])}
                />
                <div className="text-sm text-muted-foreground">Select all visible active alerts</div>
                <div className="text-xs text-muted-foreground">{selectableAlerts.length} selectable</div>
              </div>
            </div>
          ) : (
            <div className="border-b border-border/80 px-4 py-3 sm:px-5 text-sm text-muted-foreground">
              {alertView === "resolved" ? "Showing resolved alert history." : "Showing all alerts across active and resolved states."}
            </div>
          )}
          <div className="divide-y divide-border/80">
            {visibleAlerts.map((alert: any) => {
              const linkedRule = alert.rule_id ? ruleById.get(alert.rule_id) : null;
              return (
                <motion.div
                  key={alert.id}
                  variants={item}
                  className={`px-4 py-4 sm:px-5 ${alert.acknowledged ? "opacity-75" : ""}`}
                >
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        {alertView === "active" && !alert.resolved && (
                          <Checkbox
                            checked={selectedAlertIds.includes(alert.id)}
                            onCheckedChange={(checked) => setSelectedAlertIds((current) => checked ? [...new Set([...current, alert.id])] : current.filter((id) => id !== alert.id))}
                            className="mt-1"
                          />
                        )}
                        <div className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${alert.severity === "critical" ? "bg-critical pulse-live" : alert.severity === "warning" ? "bg-warning" : "bg-primary"}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="text-sm font-semibold text-foreground sm:text-[15px]">{alert.message}</p>
                            <span className={`text-[11px] font-medium uppercase tracking-wide ${alert.severity === "critical" ? "text-critical" : alert.severity === "warning" ? "text-warning" : "text-primary"}`}>
                              {alert.severity}
                            </span>
                            {alert.resolved && <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-400">resolved</span>}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span>{alert.service || "Unknown service"}</span>
                            <span className="text-border">•</span>
                            <span className="font-mono">{alert.host || "No host"}</span>
                            <span className="text-border">•</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="h-3 w-3" /> {timeAgo(alert.created_at)}
                            </span>
                          </div>

                          {(alert.assigned_user || alert.assigned_team_id || alert.acknowledged_by || linkedRule) && (
                            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              {(alert.assigned_user || alert.assigned_team_id) && (
                                <span className="inline-flex items-center gap-1.5 text-primary">
                                  <Route className="h-3 w-3" />
                                  {alert.assigned_user ? `On call: ${alert.assigned_user.name}` : `Team route: ${alert.assigned_team_id}`}
                                </span>
                              )}
                              {formatOwnershipLabel(alert.ownership) && (
                                <span className="inline-flex items-center gap-1.5 text-warning">
                                  <Route className="h-3 w-3" /> Owner: {formatOwnershipLabel(alert.ownership)}
                                </span>
                              )}
                              {(alert.assigned_user || alert.assigned_team_id || formatOwnershipLabel(alert.ownership)) && (linkedRule || alert.acknowledged_by) && <span className="text-border">•</span>}
                              {linkedRule && (
                                <span className="inline-flex items-center gap-1.5">
                                  <Siren className="h-3 w-3" /> Rule: {linkedRule.name}
                                </span>
                              )}
                              {linkedRule && alert.acknowledged_by && <span className="text-border">•</span>}
                              {alert.acknowledged_by && (
                                <span className="inline-flex items-center gap-1.5">
                                  <User className="h-3 w-3" /> Acked by {alert.acknowledged_by}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 xl:w-[200px] xl:justify-end">
                      {!alert.resolved && (
                        !alert.acknowledged ? (
                          <button
                            onClick={() => ackMutation.mutate(alert.id)}
                            className="min-h-10 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                          >
                            Ack
                          </button>
                        ) : (
                          <button
                            onClick={() => resolveMutation.mutate(alert.id)}
                            className="flex min-h-10 items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                          >
                            <CheckCircle2 className="h-3 w-3" /> Resolve
                          </button>
                        )
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-border px-3 py-2 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                            aria-label={`More actions for ${alert.message}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {!alert.acknowledged && !alert.resolved && (
                            <DropdownMenuItem onClick={() => ackMutation.mutate(alert.id)}>
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Acknowledge
                            </DropdownMenuItem>
                          )}
                          {!alert.resolved && (
                            <DropdownMenuItem onClick={() => resolveMutation.mutate(alert.id)}>
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Resolve alert
                            </DropdownMenuItem>
                          )}
                          {!alert.resolved && <DropdownMenuSeparator />}
                          {linkedRule && (
                            <DropdownMenuItem onClick={() => { setEditingRule(linkedRule); setRuleDialogOpen(true); }}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit rule
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setSilenceAlert(alert)}>
                            <BellOff className="mr-2 h-4 w-4" /> Create silence
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setMaintenanceAlert(alert)}>
                            <Wrench className="mr-2 h-4 w-4" /> Maintenance window
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            {alerts.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                No alerts matching the current filters.
              </div>
            )}
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard
            title="Rule coverage"
            description="Current alert rules and where they route."
            icon={<Siren className="h-4 w-4" />}
            actions={
              <button
                onClick={() => { setEditingRule(null); setRuleDialogOpen(true); }}
                className="flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Add rule
              </button>
            }
            contentClassName="p-0"
          >
            <div className="divide-y divide-border/80">
              {rules.slice(0, 8).map((rule: any) => (
                <div key={rule.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{rule.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {rule.target_type || "any"} · {rule.condition?.metric} {rule.condition?.operator} {rule.condition?.value}
                      </div>
                    </div>
                    <StatusBadge variant={rule.severity === "critical" ? "critical" : rule.severity === "warning" ? "warning" : "info"}>
                      {rule.severity}
                    </StatusBadge>
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    <div><span className="font-medium text-foreground">Scope:</span> {scopeLabel(rule)}</div>
                    <div><span className="font-medium text-foreground">Route:</span> {routeLabel(rule, teams)}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => { setEditingRule(rule); setRuleDialogOpen(true); }}
                      className="flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => { setRuleToDelete(rule); setDeleteRuleHistoryToo(false); }}
                      className="flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-critical hover:bg-surface-hover"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
              {rules.length === 0 && (
                <div className="px-4 py-8 text-sm text-muted-foreground">No rules yet.</div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Routing snapshot"
            description="How much of the current feed is assigned or team-routed."
            icon={<Route className="h-4 w-4" />}
            contentClassName="p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-xl border border-border/80 bg-background/60 p-3">
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Team or user routed</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{counts.routed}</div>
              </div>
              <div className="rounded-xl border border-border/80 bg-background/60 p-3">
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Visible rules</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{Math.min(rules.length, 8)}</div>
              </div>
            </div>
          </SectionCard>
        </div>
      </motion.div>

      <RuleDialog
        open={ruleDialogOpen}
        onOpenChange={(open: boolean) => {
          setRuleDialogOpen(open);
          if (!open) setEditingRule(null);
        }}
        onSubmit={(payload: any) => editingRule ? updateRuleMutation.mutate({ id: editingRule.id, payload }) : createRuleMutation.mutate(payload)}
        pending={createRuleMutation.isPending || updateRuleMutation.isPending}
        teams={teams}
        policies={policies}
        services={services}
        presets={presets}
        initialRule={editingRule}
      />

      <SilenceDialog
        open={!!silenceAlert}
        onOpenChange={(open: boolean) => !open && setSilenceAlert(null)}
        onSubmit={(payload: any) => createSilenceMutation.mutate(payload)}
        pending={createSilenceMutation.isPending}
        workspaceId={workspaceId}
        alert={silenceAlert}
      />

      <MaintenanceDialog
        open={!!maintenanceAlert}
        onOpenChange={(open: boolean) => !open && setMaintenanceAlert(null)}
        onSubmit={(payload: any) => createMaintenanceMutation.mutate(payload)}
        pending={createMaintenanceMutation.isPending}
        workspaceId={workspaceId}
        alert={maintenanceAlert}
      />

      <Dialog open={!!ruleToDelete} onOpenChange={(open: boolean) => !open && setRuleToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete alert rule?</DialogTitle>
            <DialogDescription>
              {ruleToDelete ? `Delete "${ruleToDelete.name}". By default, alert history is kept.` : "Delete alert rule"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-background/60 p-3">
              <Checkbox
                id="delete-rule-history"
                checked={deleteRuleHistoryToo}
                onCheckedChange={(checked) => setDeleteRuleHistoryToo(Boolean(checked))}
              />
              <div className="space-y-1">
                <Label htmlFor="delete-rule-history" className="cursor-pointer">Delete history too</Label>
                <p className="text-xs text-muted-foreground">Default is to keep historical alert records and only remove the rule.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRuleToDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteRuleMutation.isPending || !ruleToDelete}
              onClick={() => ruleToDelete && deleteRuleMutation.mutate({ id: ruleToDelete.id, deleteHistory: deleteRuleHistoryToo })}
            >
              {deleteRuleMutation.isPending ? "Deleting..." : deleteRuleHistoryToo ? "Delete rule + history" : "Delete rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
