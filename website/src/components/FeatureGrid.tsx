import { motion } from "framer-motion";
import { Cpu, Search, Bell, Bot, ShieldCheck, LayoutDashboard, FileText, Cog, Building2, KeyRound, ScrollText, CalendarClock } from "lucide-react";

const features = [
  { icon: Cpu, title: "Host Monitoring", desc: "Live CPU, memory, disk, uptime, and host health at a glance." },
  { icon: Search, title: "Service Discovery", desc: "Automatically discover known services and start monitoring them quickly." },
  { icon: Bell, title: "Smart Alerts", desc: "Useful default alerts for hosts and services, with real notification delivery." },
  { icon: Bot, title: "AI Copilot", desc: "Ask infrastructure questions in plain English and get grounded answers." },
  { icon: ShieldCheck, title: "Read-only Inspection", desc: "Safely inspect files, folders, and system state via bounded agent actions." },
  { icon: Building2, title: "Organizations & Workspaces", desc: "Lay the groundwork for enterprise separation, ownership, and environment scoping." },
  { icon: KeyRound, title: "OIDC + RBAC Foundations", desc: "Start moving toward SSO and role-based access control instead of one flat admin surface." },
  { icon: ScrollText, title: "Audit Logs", desc: "Track security-sensitive and operational changes with an enterprise audit trail." },
  { icon: CalendarClock, title: "Maintenance & Silences", desc: "Create maintenance windows and alert silences to cut noisy false positives." },
  { icon: LayoutDashboard, title: "Dashboards", desc: "Clean, live dashboards for full infrastructure visibility." },
  { icon: FileText, title: "Logs & Incidents", desc: "Correlate signals across hosts and investigate incidents faster." },
  { icon: Cog, title: "Systemd-native Agents", desc: "Deploy native agents via systemd — no containers required." },
];

const FeatureGrid = () => (
  <section id="features" className="py-20 lg:py-28">
    <div className="container mx-auto px-4 lg:px-8">
      <div className="mx-auto max-w-2xl text-center mb-14">
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">Operational visibility first. Enterprise foundations next.</h2>
        <p className="text-muted-foreground text-lg">ArgusMonitor still keeps the product lean, but it now has the beginnings of the boring adult features buyers expect.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className="group rounded-lg border border-border bg-card/40 p-5 transition-all duration-200 hover:border-primary/30 hover:bg-card/70"
          >
            <div className="mb-3 inline-flex rounded-md border border-border bg-accent/60 p-2 text-primary transition-colors duration-200 group-hover:border-primary/30">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="font-display font-semibold text-foreground mb-1.5">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default FeatureGrid;
