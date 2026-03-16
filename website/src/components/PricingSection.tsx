import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

const tiers = [
  {
    name: "Community",
    price: "Free",
    period: "",
    desc: "Self-hosted core monitoring for homelabs, tinkering, and technical evaluation.",
    cta: "Get Started",
    ctaVariant: "hero-outline" as const,
    highlight: false,
    features: [
      "Self-hosted deployment",
      "Up to 3 nodes",
      "Dashboards, alerts, and incidents",
      "Service discovery",
      "Log collection",
      "Community support",
    ],
  },
  {
    name: "Starter",
    price: "$19",
    period: "/mo",
    desc: "Hosted control plane for solo operators and small projects.",
    cta: "Start Free Trial",
    ctaVariant: "hero" as const,
    highlight: true,
    features: [
      "Hosted control plane",
      "Up to 10 nodes",
      "AI copilot with monthly credits",
      "Read-only host inspections",
      "Smart alerts & dashboards",
      "7-day data retention",
      "Email support",
      "Optional BYOK upgrade path",
    ],
  },
  {
    name: "Business / Enterprise Foundations",
    price: "Talk to us",
    period: "",
    desc: "For teams that need enterprise buyer basics without dragging in a giant platform.",
    cta: "Book Demo",
    ctaVariant: "hero-outline" as const,
    highlight: false,
    features: [
      "Organizations and workspaces",
      "RBAC foundation",
      "OIDC / SSO foundation",
      "Audit logs",
      "Maintenance windows and silences",
      "Real Slack / webhook / email delivery",
      "Priority support",
    ],
  },
];

const PricingSection = () => (
  <section id="pricing" className="py-20 lg:py-28 border-t border-border">
    <div className="container mx-auto px-4 lg:px-8">
      <div className="mx-auto max-w-2xl text-center mb-14">
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">Simple, honest pricing.</h2>
        <p className="text-muted-foreground text-lg">Start free. Scale when you need it. Enterprise buyer features are arriving as a focused layer, not a bloated edition.</p>
      </div>
      <div className="mx-auto max-w-5xl grid md:grid-cols-3 gap-6">
        {tiers.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
            className={`relative rounded-lg border p-6 flex flex-col ${t.highlight ? "border-primary/40 bg-card/70 glow-amber-subtle" : "border-border bg-card/40"}`}
          >
            {t.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-display font-semibold text-primary-foreground">
                Most popular
              </span>
            )}
            <h3 className="font-display font-bold text-lg text-foreground">{t.name}</h3>
            <div className="mt-3 mb-1 flex items-baseline gap-1">
              <span className="text-3xl font-display font-extrabold text-foreground">{t.price}</span>
              {t.period && <span className="text-sm text-muted-foreground">{t.period}</span>}
            </div>
            <p className="text-sm text-muted-foreground mb-6">{t.desc}</p>
            <ul className="space-y-2 mb-8 flex-1">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 flex-shrink-0 text-success mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Button variant={t.ctaVariant} className="w-full">{t.cta}</Button>
          </motion.div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-8">
        All paid plans include AI credits. Advanced users can opt into BYOK for provider flexibility and cost control.
      </p>
    </div>
  </section>
);

export default PricingSection;
