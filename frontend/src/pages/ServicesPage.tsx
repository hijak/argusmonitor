import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Globe } from "lucide-react";
import { Sparkline } from "@/components/Sparkline";
import { motion } from "framer-motion";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

export default function ServicesPage() {
  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: api.listServices,
    refetchInterval: 30000,
  });

  return (
    <motion.div className="p-6 space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Services" description="Service health and performance monitoring" />
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
