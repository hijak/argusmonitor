import { motion } from "framer-motion";
import { Download, Radio, Cloud, Building2 } from "lucide-react";

const steps = [
  { icon: Download, title: "Choose your edition", desc: "Start with open-source Self-Hosted, evaluate Cloud, or design for Enterprise from day one." },
  { icon: Radio, title: "Connect your infrastructure", desc: "Deploy agents, bring monitored systems online, and start collecting useful host and service signals." },
  { icon: Cloud, title: "Decide who runs the control plane", desc: "Keep it self-hosted for full control, or move to Cloud when you want less operational burden." },
  { icon: Building2, title: "Add organizational control as needed", desc: "Layer in identity, governance, audit, and private deployment options when the team and buying process demand it." },
];

const HowItWorks = () => (
  <section className="border-t border-border py-20 lg:py-28">
    <div className="container mx-auto px-4 lg:px-8">
      <div className="mx-auto mb-14 max-w-3xl text-center">
        <h2 className="mb-4 text-3xl font-display font-bold text-foreground sm:text-4xl">How the product grows with you</h2>
        <p className="text-lg text-muted-foreground">The journey should feel additive: product first, convenience next, organizational control when it is actually needed.</p>
      </div>
      <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
            <div className="absolute left-[60%] top-6 hidden w-[calc(100%-20px)] border-t border-dashed border-border lg:block" style={{ display: i === steps.length - 1 ? "none" : undefined }} />
            <span className="mb-2 block font-mono text-xs text-primary">Step {i + 1}</span>
            <h3 className="mb-1.5 font-display font-semibold text-foreground">{s.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
