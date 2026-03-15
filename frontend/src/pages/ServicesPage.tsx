import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Globe, Radar, ShieldAlert } from "lucide-react";
import { Sparkline } from "@/components/Sparkline";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/sonner";
import { useServicesStream } from "@/hooks/useServiceStream";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

export default function ServicesPage() {
  const queryClient = useQueryClient();
  const { data: serviceSeed = [], isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: api.listServices,
  });
  const services = useServicesStream(serviceSeed);

  const discoverMutation = useMutation({
    mutationFn: api.discoverServices,
    onSuccess: (result) => {
      toast.success(result.created > 0 ? `Discovered ${result.created} service${result.created === 1 ? "" : "s"}` : "No new services found");
      queryClient.invalidateQueries({ queryKey: ["services"] });
    },
    onError: (error: Error) => toast.error(error.message || "Service discovery failed"),
  });

  const seedAlertsMutation = useMutation({
    mutationFn: api.seedDefaultAlerts,
    onSuccess: (result) => {
      toast.success(result.created > 0 ? `Added ${result.created} default alert rules` : "Default alerts already present");
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to add default alerts"),
  });

  return (
    <motion.div className="p-6 space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Services" description="Service health and performance monitoring">
          <button
            onClick={() => seedAlertsMutation.mutate()}
            disabled={seedAlertsMutation.isPending}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-surface-hover disabled:opacity-50"
          >
            <ShieldAlert className="h-4 w-4" />
            {seedAlertsMutation.isPending ? "Adding alerts..." : "Add Default Alerts"}
          </button>
          <button
            onClick={() => discoverMutation.mutate()}
            disabled={discoverMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Radar className="h-4 w-4" />
            {discoverMutation.isPending ? "Scanning..." : "Discover Services"}
          </button>
        </PageHeader>
      </motion.div>

      <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((svc: any) => (
          <div key={svc.id} className="rounded-lg border border-border bg-card p-5 transition-colors hover:bg-surface-hover cursor-pointer group">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">{svc.name}</h3>
              </div>
              <StatusBadge variant={svc.status} pulse={svc.status === "critical"}>{svc.status}</StatusBadge>
            </div>
            <div className="flex items-end justify-between">
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Uptime:</span>
                  <span className="font-mono text-foreground">{svc.uptime_percent}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Latency:</span>
                  <span className={`font-mono ${svc.latency_ms > 200 ? 'text-critical' : svc.latency_ms > 100 ? 'text-warning' : 'text-foreground'}`}>{Math.round(svc.latency_ms)}ms</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Traffic:</span>
                  <span className="font-mono text-foreground">{Math.round(svc.requests_per_min)}/min</span>
                </div>
              </div>
              <Sparkline
                data={svc.spark || []}
                color={svc.status === "critical" ? "hsl(0 84% 60%)" : svc.status === "warning" ? "hsl(38 92% 50%)" : "hsl(160 84% 39%)"}
                width={80}
                height={32}
              />
            </div>
          </div>
        ))}
        {isLoading && <div className="col-span-full text-center py-8 text-muted-foreground">Loading services...</div>}
      </motion.div>
    </motion.div>
  );
}
