import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

const tiers = [
  {
    name: "Self-Hosted",
    price: "Free",
    period: "",
    desc: "Open-source core monitoring for operators who want to run the product themselves.",
    cta: "View on GitHub",
    ctaVariant: "hero-outline" as const,
    highlight: false,
    features: [
      "Self-hosted control plane",
      "Core monitoring, alerts, dashboards, and logs",
      "Service discovery, transactions, and agents",
      "BYOK AI support",
      "Docs and community-led support",
    ],
  },
  {
    name: "Cloud",
    price: "Talk to us",
    period: "",
    desc: "Managed Vordr with a simpler onboarding path, included AI usage, and less operational overhead.",
    cta: "Book Demo",
    ctaVariant: "hero" as const,
    highlight: true,
    features: [
      "Managed control plane",
      "Included AI credits",
      "Managed upgrades and backups",
      "Shared team usage",
      "Faster onboarding and evaluation",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For teams that need identity, governance, procurement readiness, and private deployment options.",
    cta: "Talk to Sales",
    ctaVariant: "hero-outline" as const,
    highlight: false,
    features: [
      "SSO / SAML / SCIM",
      "Advanced RBAC and audit visibility",
      "Private deployment options",
      "Premium support and onboarding",
      "Policy and governance-oriented controls",
    ],
  },
];

const PricingSection = () => (
  <section id="pricing" className="border-t border-border py-20 lg:py-28">
    <div className="container mx-auto px-4 lg:px-8">
      <div className="mx-auto mb-14 max-w-3xl text-center">
        <h2 className="mb-4 text-3xl font-display font-bold text-foreground sm:text-4xl">One product. Three ways to buy it.</h2>
        <p className="text-lg text-muted-foreground">
          The pricing story is simple: Self-Hosted gives you the product, Cloud removes the operational burden, and Enterprise adds organizational control.
        </p>
      </div>
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
        {tiers.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
            className={`relative flex flex-col rounded-lg border p-6 ${t.highlight ? "border-primary/40 bg-card/70 glow-amber-subtle" : "border-border bg-card/40"}`}
          >
            {t.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-display font-semibold text-primary-foreground">
                Recommended
              </span>
            )}
            <h3 className="text-lg font-display font-bold text-foreground">{t.name}</h3>
            <div className="mb-1 mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-display font-extrabold text-foreground">{t.price}</span>
              {t.period && <span className="text-sm text-muted-foreground">{t.period}</span>}
            </div>
            <p className="mb-6 text-sm text-muted-foreground">{t.desc}</p>
            <ul className="mb-8 flex-1 space-y-2">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                  {f}
                </li>
              ))}
            </ul>
            <Button variant={t.ctaVariant} className="w-full">{t.cta}</Button>
          </motion.div>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-muted-foreground">
        Self-Hosted stays genuinely useful. Cloud monetizes convenience. Enterprise monetizes identity, governance, and support.
      </p>
    </div>
  </section>
);

export default PricingSection;
