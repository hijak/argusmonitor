import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Activity, Menu, X, Github } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DEMO_URL, DOCS_URL, GITHUB_URL, START_URL } from "@/lib/site";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "AI Copilot", href: "#copilot" },
  { label: "Pricing", href: "#pricing" },
  { label: "Plugin Directory", href: PLUGIN_DIRECTORY_URL },
  { label: "Docs", href: DOCS_URL },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 font-display text-lg font-bold text-foreground">
          <Activity className="h-6 w-6 text-primary" />
          Vordr
        </a>

        {/* Desktop links */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <a key={l.label} href={l.href} className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground">
              {l.label}
            </a>
          ))}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground flex items-center gap-1.5">
            <Github className="h-4 w-4" /> GitHub
          </a>
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          <Button asChild variant="hero-outline" size="sm"><a href={DEMO_URL}>Book Demo</a></Button>
          <Button asChild variant="hero" size="sm"><a href={START_URL} target="_blank" rel="noreferrer">Get Started</a></Button>
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="border-b border-border bg-background md:hidden overflow-hidden"
          >
            <div className="flex flex-col gap-3 px-4 py-4">
              {navLinks.map((l) => (
                <a key={l.label} href={l.href} className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>
                  {l.label}
                </a>
              ))}
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5">
                <Github className="h-4 w-4" /> GitHub
              </a>
              <div className="flex gap-3 pt-2">
                <Button asChild variant="hero-outline" size="sm" className="flex-1"><a href={DEMO_URL}>Book Demo</a></Button>
                <Button asChild variant="hero" size="sm" className="flex-1"><a href={START_URL} target="_blank" rel="noreferrer">Get Started</a></Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
