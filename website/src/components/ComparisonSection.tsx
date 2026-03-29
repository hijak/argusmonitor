import { motion } from "framer-motion";
import { Minus, Zap } from "lucide-react";

const points = [
  { pain: "Open-source editions that feel like crippled teasers", solution: "A self-hosted edition that remains genuinely useful on its own" },
  { pain: "Hosted plans that only exist because basic features were hidden", solution: "Cloud positioned around convenience, onboarding, upgrades, and included AI" },
  { pain: "Enterprise tiers that really just hide basic security", solution: "Enterprise focused on identity, governance, support, and private deployment" },
  { pain: "AI add-ons with no operational grounding", solution: "AI usage framed around real infrastructure context and deployment choice" },
  { pain: "Pricing pages that confuse deployment model and feature access", solution: "A simple story: Self-Hosted, Cloud, and Enterprise" },
  { pain: "Monitoring platforms that get heavier as the pitch gets fancier", solution: "Keep the core lean and monetize the right layers" },
];

const ComparisonSection = () => (
  <section className="border-t border-border py-20 lg:py-28">
    <div className="container mx-auto px-4 lg:px-8">
      <div className="mx-auto mb-14 max-w-3xl text-center">
        <h2 className="mb-4 text-3xl font-display font-bold text-foreground sm:text-4xl">A split people can actually understand.</h2>
        <p className="text-lg text-muted-foreground">The product story should feel coherent to operators, buyers, and contributors.</p>
      </div>
      <div className="mx-auto max-w-4xl space-y-3">
        {points.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05, duration: 0.25 }}
            className="grid gap-3 rounded-lg border border-border bg-card/30 p-4 sm:grid-cols-2 sm:gap-6"
          >
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Minus className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
              {p.pain}
            </div>
            <div className="flex items-start gap-2 text-sm text-foreground">
              <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              {p.solution}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default ComparisonSection;
