import { Activity } from "lucide-react";
import { DOCS_URL, GITHUB_URL } from "@/lib/site";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "AI Copilot", href: "#copilot" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: DOCS_URL },
      { label: "GitHub", href: GITHUB_URL },
      { label: "Contact", href: "mailto:plutus.ghost@gmail.com" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
    ],
  },
];

const Footer = () => (
  <footer className="border-t border-border bg-card/20 py-12">
    <div className="container mx-auto px-4 lg:px-8">
      <div className="grid sm:grid-cols-4 gap-8">
        <div>
          <a href="/" className="flex items-center gap-2 font-display font-bold text-foreground mb-3">
            <Activity className="h-5 w-5 text-primary" /> ArgusMonitor
          </a>
          <p className="text-sm text-muted-foreground leading-relaxed">AI-powered monitoring for modern infrastructure.</p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="font-display font-semibold text-sm text-foreground mb-3">{col.title}</h4>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">{l.label}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-10 pt-6 border-t border-border text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ArgusMonitor. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;
