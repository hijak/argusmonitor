import { motion } from "framer-motion";
import { Bot, User, Sparkles } from "lucide-react";

const messages = [
  { role: "user" as const, text: "What are the largest files under /var on node01?" },
  {
    role: "assistant" as const,
    text: `Running safe read-only inspection on **node01**…

\`\`\`
/var/log/syslog          1.2 GB
/var/lib/docker/overlay  890 MB
/var/log/journal         340 MB
/var/cache/apt           210 MB
\`\`\`

The largest consumer is \`/var/log/syslog\` at 1.2 GB. Consider configuring log rotation or archiving older entries.`,
  },
  { role: "user" as const, text: "Which services are unhealthy right now?" },
  {
    role: "assistant" as const,
    text: `**2 services** are currently unhealthy:

- **postgres** on \`db-primary\` — connection refused on port 5432 (last seen 4m ago)
- **nginx** on \`proxy-01\` — health check returning 502 (since 12:04 UTC)

Both are flagged with active alerts. Want me to inspect the logs?`,
  },
];

const CopilotShowcase = () => (
  <section id="copilot" className="py-20 lg:py-28 border-t border-border">
    <div className="container mx-auto px-4 lg:px-8">
      <div className="mx-auto max-w-2xl text-center mb-14">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 text-xs font-mono text-secondary mb-4">
          <Sparkles className="h-3 w-3" /> AI-powered
        </div>
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">An AI copilot with real context.</h2>
        <p className="text-muted-foreground text-lg">Not a generic chatbot. The copilot has access to your monitoring data and can safely inspect nodes through read-only agent actions.</p>
      </div>

      {/* Chat UI */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="mx-auto max-w-2xl rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Bot className="h-4 w-4 text-secondary" />
          <span className="font-display font-semibold text-sm text-foreground">ArgusMonitor Copilot</span>
          <span className="ml-auto text-[10px] font-mono text-muted-foreground">context: 4 hosts, 12 services</span>
        </div>
        <div className="p-4 space-y-4 max-h-[480px] overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "" : ""}`}>
              <div className={`mt-0.5 flex-shrink-0 h-6 w-6 rounded-md flex items-center justify-center text-xs ${m.role === "user" ? "bg-accent border border-border text-foreground" : "bg-secondary/15 border border-secondary/20 text-secondary"}`}>
                {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              </div>
              <div className="flex-1 text-sm leading-relaxed">
                {m.text.split("\n").map((line, li) => {
                  if (line.startsWith("```")) return null;
                  if (line.startsWith("- ")) {
                    return <p key={li} className="text-muted-foreground pl-2 border-l border-border ml-1 my-0.5">{renderInline(line.slice(2))}</p>;
                  }
                  if (line.startsWith("/") || line.match(/^\S+\s+[\d.]+\s/)) {
                    return <code key={li} className="block font-mono text-xs text-secondary bg-accent/60 px-2 py-0.5 rounded">{line}</code>;
                  }
                  return <p key={li} className="text-foreground my-0.5">{renderInline(line)}</p>;
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-accent/40 px-3 py-2 text-sm text-muted-foreground">
            Ask about your infrastructure…
          </div>
        </div>
      </motion.div>

      <div className="mx-auto max-w-lg mt-6 text-center text-xs text-muted-foreground">
        AI usage included via plan credits, or bring your own API key (BYOK) for advanced use.
      </div>
    </div>
  </section>
);

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-foreground font-medium">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="font-mono text-xs text-secondary bg-accent/60 px-1 py-0.5 rounded">{part.slice(1, -1)}</code>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default CopilotShowcase;
