import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertTriangle, Clock, CheckCircle, ArrowRight, Bot, User, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/sonner";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

const typeColors: Record<string, string> = {
  alert: "text-critical",
  system: "text-muted-foreground",
  ai: "text-primary",
  action: "text-success",
};

const typeBg: Record<string, string> = {
  alert: "bg-critical/10",
  system: "bg-muted",
  ai: "bg-primary/10",
  action: "bg-success/10",
};

export default function IncidentsPage() {
  const queryClient = useQueryClient();
  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents"],
    queryFn: api.listIncidents,
    refetchInterval: 30000,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.resolveIncident(id),
    onSuccess: () => {
      toast.success("Incident resolved");
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to resolve incident"),
  });

  const timeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}min`;
  };

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <motion.div className="p-6 space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Incidents" description="Active and recent incident timelines" />
      </motion.div>

      {incidents.length === 0 && (
        <div className="rounded-lg border border-border bg-card px-5 py-12 text-center text-muted-foreground">
          No incidents to display
        </div>
      )}

      {incidents.map((inc: any) => (
        <motion.div key={inc.id} variants={item} className="rounded-lg border border-border bg-card">
          <div className="flex flex-col gap-4 border-b border-border px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">{inc.ref}</span>
                <StatusBadge variant={inc.severity} pulse>{inc.severity}</StatusBadge>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">{inc.status}</span>
              </div>
              <h3 className="mt-2 text-base font-semibold text-foreground">{inc.title}</h3>
              {inc.assigned_user && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                  <User className="h-3 w-3" /> On call: {inc.assigned_user.name}
                </div>
              )}
            </div>
            <div className="flex items-start gap-3">
              <div className="text-right text-xs text-muted-foreground">
                <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeSince(inc.started_at)}</div>
                <p className="mt-0.5">{new Date(inc.started_at).toLocaleString()}</p>
              </div>
              {inc.status !== "resolved" && (
                <button
                  onClick={() => resolveMutation.mutate(inc.id)}
                  className="flex min-h-10 items-center gap-1 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                >
                  <CheckCircle2 className="h-3 w-3" /> Resolve
                </button>
              )}
            </div>
          </div>

          <div className="border-b border-border px-5 py-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Affected:</span>
            {(inc.affected_hosts || []).map((h: string) => (
              <span key={h} className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{h}</span>
            ))}
            {(inc.affected_hosts || []).length === 0 && <span className="text-xs text-muted-foreground">None listed</span>}
          </div>

          <div className="px-5 py-4">
            <div className="space-y-0">
              {(inc.events || []).map((event: any, i: number) => (
                <div key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < inc.events.length - 1 && (
                    <div className="absolute left-[11px] top-[24px] h-[calc(100%-8px)] w-px bg-border" />
                  )}
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${typeBg[event.type] || "bg-muted"}`}>
                    {event.type === "alert" && <AlertTriangle className={`h-3 w-3 ${typeColors[event.type]}`} />}
                    {event.type === "system" && <ArrowRight className={`h-3 w-3 ${typeColors[event.type]}`} />}
                    {event.type === "ai" && <Bot className={`h-3 w-3 ${typeColors[event.type]}`} />}
                    {event.type === "action" && <CheckCircle className={`h-3 w-3 ${typeColors[event.type]}`} />}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className={`text-sm ${event.type === "ai" ? "text-primary" : "text-foreground"}`}>{event.event_text}</p>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground pt-0.5">{formatTime(event.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
