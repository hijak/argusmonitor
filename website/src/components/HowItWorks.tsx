import { motion } from "framer-motion";
import { Download, Radio, AlertTriangle, Bot } from "lucide-react";

const steps = [
  { icon: Download, title: "Deploy the agent", desc: "Install the lightweight systemd agent on the nodes you care about." },
  { icon: Radio, title: "Hosts report signals", desc: "Health metrics, logs, and service discovery data flow to the control plane." },
  { icon: AlertTriangle, title: "Control blast radius", desc: "Use alerts, on-call routing, maintenance windows, and silences to keep incidents useful instead of noisy." },
  { icon: Bot, title: "Operate with context", desc: "Use the AI copilot, audit logs, workspaces, and notification delivery foundations to move toward enterprise readiness." },
];

const HowItWorks = () => (
  <section className="py-20 lg:py-28 border-t border-border">
    <div className="container mx-auto px-4 lg:px-8">
      <div className="mx-auto max-w-2xl text-center mb-14">
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">How it works</h2>
        <p className="text-muted-foreground text-lg">Hosted control plane, lightweight agents on your infrastructure, and enterprise foundations where they actually matter.</p>
      </div>
      <div className="mx-auto max-w-4xl grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {steps.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
            className="relative text-center"
          >
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-card/60 text-primary">
              <s.icon className="h-5 w-5" />
            </div>
            <div className="absolute top-6 left-[60%] hidden w-[calc(100%-20px)] border-t border-dashed border-border lg:block" style={{ display: i === steps.length - 1 ? "none" : undefined }} />
            <span className="mb-2 block font-mono text-xs text-primary">Step {i + 1}</span>
            <h3 className="font-display font-semibold text-foreground mb-1.5">{s.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
