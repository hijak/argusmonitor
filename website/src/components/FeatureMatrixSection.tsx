import { motion } from "framer-motion";
import { Check, Minus } from "lucide-react";

const columns = ["Capability", "Self-Hosted", "Cloud", "Enterprise"];

const rows = [
  ["Core monitoring", true, true, true],
  ["Dashboards, alerts, incidents, logs", true, true, true],
  ["Agents, service discovery, transactions", true, true, true],
  ["API access", true, true, true],
  ["BYOK AI", true, "Optional", "Optional"],
  ["Included AI credits", false, true, true],
  ["Managed control plane", false, true, true],
  ["Managed upgrades and backups", false, true, true],
  ["Team workspaces", "Basic", "Shared", "Advanced"],
  ["SSO / SAML / SCIM", false, "Higher-tier", true],
  ["Audit and governance controls", "Basic", "Basic", true],
  ["Private deployment options", "Self-run", false, true],
  ["Support", "Docs / community", "Standard", "Premium"],
];

const renderCell = (value: boolean | string) => {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-success" />;
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground" />;
  return <span className="text-xs text-muted-foreground sm:text-sm">{value}</span>;
};

const FeatureMatrixSection = () => (
  <section id="matrix" className="border-t border-border py-20 lg:py-28">
    <div className="container mx-auto px-4 lg:px-8">
      <div className="mx-auto mb-12 max-w-3xl text-center">
        <h2 className="mb-4 text-3xl font-display font-bold text-foreground sm:text-4xl">A split that stays honest.</h2>
        <p className="text-lg text-muted-foreground">
          The open-source edition remains useful on its own. Cloud monetizes convenience. Enterprise monetizes identity, governance, and support.
        </p>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden rounded-xl border border-border bg-card/40"
      >
        <div className="grid grid-cols-4 border-b border-border bg-card/70 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {columns.map((col) => (
            <div key={col} className="px-3 py-3 text-center first:text-left sm:px-4">{col}</div>
          ))}
        </div>
        <div>
          {rows.map((row) => (
            <div key={row[0] as string} className="grid grid-cols-4 border-b border-border/70 last:border-b-0">
              <div className="px-3 py-3 text-xs text-foreground sm:px-4 sm:text-sm">{row[0] as string}</div>
              <div className="px-3 py-3 text-center sm:px-4">{renderCell(row[1] as boolean | string)}</div>
              <div className="px-3 py-3 text-center sm:px-4">{renderCell(row[2] as boolean | string)}</div>
              <div className="px-3 py-3 text-center sm:px-4">{renderCell(row[3] as boolean | string)}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  </section>
);

export default FeatureMatrixSection;
