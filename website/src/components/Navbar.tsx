import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Activity, Menu, X, Github } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DEMO_URL, DOCS_URL, GITHUB_URL, PLUGIN_DIRECTORY_URL, START_URL } from "@/lib/site";

const navLinks = [
  { label: "Editions", href: "/#editions" },
  { label: "Pricing", href: "/pricing" },
  { label: "Open Source", href: "/open-source" },
  { label: "Docs", href: DOCS_URL },
  { label: "Plugin Directory", href: PLUGIN_DIRECTORY_URL },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
        <a href="/" className="flex items-center gap-2.5 font-display text-lg font-bold text-foreground">
          <Activity className="h-6 w-6 text-primary" />
          Vordr
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <a key={l.label} href={l.href} className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground">
              {l.label}
            </a>
          ))}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground">
            <Github className="h-4 w-4" /> GitHub
          </a>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Button asChild variant="hero-outline" size="sm"><a href={DEMO_URL}>Book Demo</a></Button>
          <Button asChild variant="hero" size="sm"><a href={START_URL} target="_blank" rel="noreferrer">Start Self-Hosted</a></Button>
        </div>

        <button className="text-foreground md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-b border-border bg-background md:hidden"
          >
            <div className="flex flex-col gap-3 px-4 py-4">
              {navLinks.map((l) => (
                <a key={l.label} href={l.href} className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>
                  {l.label}
                </a>
              ))}
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <Github className="h-4 w-4" /> GitHub
              </a>
              <div className="flex gap-3 pt-2">
                <Button asChild variant="hero-outline" size="sm" className="flex-1"><a href={DEMO_URL}>Book Demo</a></Button>
                <Button asChild variant="hero" size="sm" className="flex-1"><a href={START_URL} target="_blank" rel="noreferrer">Start Self-Hosted</a></Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
