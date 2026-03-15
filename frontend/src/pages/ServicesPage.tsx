import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Globe, Activity, ArrowUpRight } from "lucide-react";
import { Sparkline } from "@/components/Sparkline";
import { motion } from "framer-motion";

const services = [
  { name: "API Gateway", status: "healthy" as const, uptime: "99.99%", latency: "45ms", requests: "12.4k/min", endpoints: 24, spark: [42,44,45,43,44,45,45] },
  { name: "User Service", status: "healthy" as const, uptime: "99.98%", latency: "62ms", requests: "8.2k/min", endpoints: 12, spark: [60,61,63,62,61,62,62] },
  { name: "Payment Service", status: "warning" as const, uptime: "99.95%", latency: "189ms", requests: "2.1k/min", endpoints: 8, spark: [150,160,170,175,180,185,189] },
  { name: "Auth Service", status: "healthy" as const, uptime: "99.99%", latency: "28ms", requests: "15.8k/min", endpoints: 6, spark: [25,27,28,27,28,28,28] },
  { name: "Notification Service", status: "healthy" as const, uptime: "99.97%", latency: "35ms", requests: "4.5k/min", endpoints: 4, spark: [33,34,35,34,35,35,35] },
  { name: "Search Service", status: "critical" as const, uptime: "98.50%", latency: "520ms", requests: "6.3k/min", endpoints: 3, spark: [200,250,300,350,400,480,520] },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

export default function ServicesPage() {
  return (
    <motion.div className="p-6 space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Services" description="Service health and performance monitoring" />
      </motion.div>

      <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map(svc => (
          <div key={svc.name} className="rounded-lg border border-border bg-card p-5 transition-colors hover:bg-surface-hover cursor-pointer group">
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
                  <span className="font-mono text-foreground">{svc.uptime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Latency:</span>
                  <span className={`font-mono ${parseInt(svc.latency) > 200 ? 'text-critical' : parseInt(svc.latency) > 100 ? 'text-warning' : 'text-foreground'}`}>{svc.latency}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Traffic:</span>
                  <span className="font-mono text-foreground">{svc.requests}</span>
                </div>
              </div>
              <Sparkline
                data={svc.spark}
                color={svc.status === "critical" ? "hsl(0 84% 60%)" : svc.status === "warning" ? "hsl(38 92% 50%)" : "hsl(160 84% 39%)"}
                width={80}
                height={32}
              />
            </div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
