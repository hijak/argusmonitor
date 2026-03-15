import { Button } from "@/components/ui/button";
import { Github, Cpu, MemoryStick, Activity, Bot, AlertTriangle, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { DEMO_URL, GITHUB_URL, START_URL } from "@/lib/site";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.4 } }),
};

const MiniChart = ({ color, values }: { color: string; values: number[] }) => (
  <svg viewBox="0 0 100 30" className="w-full h-8" preserveAspectRatio="none">
    <polyline
      fill="none"
      stroke={color}
      strokeWidth="2"
      points={values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - v * 0.3}`).join(" ")}
    />
  </svg>
);

const StatusDot = ({ status }: { status: "healthy" | "warning" | "critical" }) => {
  const colors = { healthy: "bg-success", warning: "bg-primary", critical: "bg-destructive" };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[status]}`} />;
};

const DashboardPreview = () => (
  <div className="glass-panel rounded-lg p-3 sm:p-4 space-y-3 text-xs">
    {/* Top bar */}
    <div className="flex items-center justify-between border-b border-border pb-2">
      <span className="font-display font-semibold text-sm text-foreground">Dashboard</span>
      <div className="flex items-center gap-2">
        <span className="text-success font-mono text-[10px]">3 healthy</span>
        <span className="text-destructive font-mono text-[10px]">1 alert</span>
      </div>
    </div>
    {/* Node cards */}
    <div className="grid grid-cols-2 gap-2">
      {[
        { name: "node01", status: "healthy" as const, cpu: 34, mem: 62 },
        { name: "node02", status: "healthy" as const, cpu: 18, mem: 41 },
        { name: "db-primary", status: "warning" as const, cpu: 87, mem: 78 },
        { name: "proxy-01", status: "healthy" as const, cpu: 12, mem: 29 },
      ].map((n) => (
        <div key={n.name} className="rounded-md border border-border bg-accent/50 p-2 space-y-1">
          <div className="flex items-center gap-1.5">
            <StatusDot status={n.status} />
            <span className="font-mono text-foreground">{n.name}</span>
          </div>
          <div className="flex gap-2 text-muted-foreground">
            <span className="flex items-center gap-0.5"><Cpu className="h-3 w-3" />{n.cpu}%</span>
            <span className="flex items-center gap-0.5"><MemoryStick className="h-3 w-3" />{n.mem}%</span>
          </div>
        </div>
      ))}
    </div>
    {/* Charts */}
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-md border border-border bg-accent/50 p-2">
        <span className="text-muted-foreground mb-1 block">CPU Load</span>
        <MiniChart color="hsl(38, 92%, 50%)" values={[20, 35, 28, 45, 60, 55, 42, 50, 65, 87, 72, 58]} />
      </div>
      <div className="rounded-md border border-border bg-accent/50 p-2">
        <span className="text-muted-foreground mb-1 block">Memory</span>
        <MiniChart color="hsl(187, 80%, 42%)" values={[40, 42, 45, 48, 50, 52, 55, 60, 62, 65, 78, 75]} />
      </div>
    </div>
    {/* Alert + Copilot */}
    <div className="grid grid-cols-5 gap-2">
      <div className="col-span-3 rounded-md border border-border bg-accent/50 p-2 space-y-1">
        <span className="text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-primary" />Alerts</span>
        <div className="flex items-center gap-1.5 text-foreground">
          <StatusDot status="warning" />
          <span className="font-mono">db-primary: CPU &gt; 85%</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CheckCircle className="h-3 w-3 text-success" />
          <span className="font-mono">All services healthy</span>
        </div>
      </div>
      <div className="col-span-2 rounded-md border border-secondary/30 bg-accent/50 p-2 space-y-1 glow-cyan" style={{ boxShadow: "0 0 15px -5px hsl(187 80% 42% / 0.15)" }}>
        <span className="text-secondary flex items-center gap-1 font-medium"><Bot className="h-3 w-3" />Copilot</span>
        <p className="text-muted-foreground leading-relaxed">db-primary CPU spike correlates with a backup cron at 02:00…</p>
      </div>
    </div>
  </div>
);

const HeroSection = () => (
  <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
    {/* Background glow */}
    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

    <div className="container mx-auto px-4 lg:px-8">
      <div className="mx-auto max-w-5xl text-center space-y-6">
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-mono text-muted-foreground backdrop-blur-sm">
            <Activity className="h-3 w-3 text-primary" /> Now in public beta
          </span>
        </motion.div>

        <motion.h1 custom={1} variants={fadeUp} initial="hidden" animate="visible" className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold tracking-tight text-foreground leading-[1.1]">
          Monitoring without{" "}
          <span className="text-gradient-amber">the bloat.</span>
        </motion.h1>

        <motion.p custom={2} variants={fadeUp} initial="hidden" animate="visible" className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
          Host monitoring, service discovery, alerts, logs, dashboards, and an AI copilot that can safely inspect monitored nodes through bounded read-only agent actions.
        </motion.p>

        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible" className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button asChild variant="hero" size="lg"><a href={START_URL} target="_blank" rel="noreferrer">Start Free</a></Button>
          <Button asChild variant="hero-outline" size="lg"><a href={DEMO_URL}>Book Demo</a></Button>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
            <Github className="h-4 w-4" /> View on GitHub
          </a>
        </motion.div>
      </div>

      {/* Dashboard Preview */}
      <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible" className="mx-auto mt-14 max-w-4xl">
        <div className="rounded-xl border border-border bg-card/40 p-2 sm:p-3 backdrop-blur-sm glow-amber-subtle">
          <DashboardPreview />
        </div>
      </motion.div>
    </div>
  </section>
);

export default HeroSection;
