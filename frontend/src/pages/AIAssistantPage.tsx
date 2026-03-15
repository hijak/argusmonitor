import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Bot, Send, User, Zap, Server, Bell, LayoutDashboard } from "lucide-react";
import { motion } from "framer-motion";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const sampleMessages: Message[] = [
  { id: "1", role: "user", content: "Why is worker-03 showing critical status?", timestamp: "14:52" },
  { id: "2", role: "assistant", content: "**worker-03** is in critical state due to:\n\n1. **CPU at 95%** — sustained for 45+ minutes\n2. **Memory at 92%** — approaching OOM threshold\n3. **Job queue backlog** — 15,234 pending jobs\n\n**Root Cause:** The worker is processing a large batch import that started at 13:47. The job queue is growing faster than the worker can process.\n\n**Recommended Actions:**\n- Scale horizontally: add 2 more worker instances\n- Increase memory limit from 4GB to 8GB\n- Consider splitting the batch into smaller chunks\n\nWould you like me to create an alert rule for this pattern?", timestamp: "14:52" },
  { id: "3", role: "user", content: "Create a transaction monitor for our checkout flow", timestamp: "14:54" },
  { id: "4", role: "assistant", content: "I'll create a **Checkout Flow** transaction monitor with these steps:\n\n1. **Navigate** to `/products`\n2. **Click** 'Add to Cart' button\n3. **Navigate** to `/cart`\n4. **Assert** cart contains items\n5. **Click** 'Proceed to Checkout'\n6. **Fill** shipping information\n7. **Click** 'Place Order'\n8. **Assert** order confirmation page\n\n**Schedule:** Every 5 minutes\n**Timeout:** 30 seconds\n**Alert on:** 2 consecutive failures\n\nShall I create this monitor now?", timestamp: "14:54" },
];

const quickActions = [
  { label: "Explain alert", icon: Bell },
  { label: "Create monitor", icon: Zap },
  { label: "Server health", icon: Server },
  { label: "Build dashboard", icon: LayoutDashboard },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

export default function AIAssistantPage() {
  const [input, setInput] = useState("");

  return (
    <motion.div className="flex h-full flex-col" variants={container} initial="hidden" animate="show">
      <motion.div variants={item} className="border-b border-border px-6 py-4">
        <PageHeader title="Argus Co-pilot" description="AI-powered monitoring assistant" />
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {sampleMessages.map(msg => (
          <motion.div key={msg.id} variants={item} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className={`max-w-2xl rounded-xl px-4 py-3 text-sm ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border"
            }`}>
              {msg.content.split('\n').map((line, i) => {
                if (line.startsWith('**') && line.endsWith('**')) {
                  return <p key={i} className="font-semibold mt-1">{line.replace(/\*\*/g, '')}</p>;
                }
                if (line.startsWith('- ')) {
                  return <p key={i} className="ml-3">• {line.slice(2)}</p>;
                }
                if (line.match(/^\d\./)) {
                  return <p key={i} className="ml-1">{line}</p>;
                }
                return <p key={i} className={line === '' ? 'h-2' : ''}>{line}</p>;
              })}
              <span className={`mt-2 block text-[10px] ${msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{msg.timestamp}</span>
            </div>
            {msg.role === "user" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="px-6 py-2 flex gap-2">
        {quickActions.map(a => (
          <button key={a.label} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground">
            <a.icon className="h-3 w-3" />{a.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-border px-6 py-4">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask Argus anything..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
