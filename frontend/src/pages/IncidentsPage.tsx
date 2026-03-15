import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertTriangle, Clock, CheckCircle, ArrowRight, Bot } from "lucide-react";
import { motion } from "framer-motion";

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
  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents"],
    queryFn: api.listIncidents,
    refetchInterval: 30000,
  });

  const timeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}min`;
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

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
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">{inc.ref}</span>
                <StatusBadge variant={inc.severity} pulse>{inc.severity}</StatusBadge>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">{inc.status}</span>
              </div>
              <h3 className="mt-1 text-sm font-medium">{inc.title}</h3>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeSince(inc.started_at)}</div>
              <p className="mt-0.5">{new Date(inc.started_at).toLocaleString()}</p>
            </div>
          </div>

          <div className="border-b border-border px-5 py-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Affected:</span>
            {(inc.affected_hosts || []).map((h: string) => (
              <span key={h} className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{h}</span>
            ))}
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
                    <p className={`text-sm ${event.type === "ai" ? "text-primary" : ""}`}>{event.event_text}</p>
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
