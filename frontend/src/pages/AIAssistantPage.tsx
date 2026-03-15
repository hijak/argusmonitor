import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Bot, Send, User, Zap, Server, Bell, LayoutDashboard, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: history = [] } = useQuery({
    queryKey: ["ai-history"],
    queryFn: api.aiHistory,
  });

  const chatMutation = useMutation({
    mutationFn: (message: string) => api.aiChat(message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-history"] });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, chatMutation.isPending]);

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;
    chatMutation.mutate(input);
    setInput("");
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="font-semibold mt-1">{line.replace(/\*\*/g, '')}</p>;
      }
      if (line.match(/\*\*[^*]+\*\*/)) {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i}>
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j}>{part.replace(/\*\*/g, '')}</strong>
                : part
            )}
          </p>
        );
      }
      if (line.startsWith('- ')) {
        return <p key={i} className="ml-3">&#8226; {line.slice(2)}</p>;
      }
      if (line.match(/^\d+\./)) {
        return <p key={i} className="ml-1">{line}</p>;
      }
      return <p key={i} className={line === '' ? 'h-2' : ''}>{line}</p>;
    });
  };

  return (
    <motion.div className="flex h-full flex-col" variants={container} initial="hidden" animate="show">
      <motion.div variants={item} className="border-b border-border px-6 py-4">
        <PageHeader title="Argus Co-pilot" description="AI-powered monitoring assistant" />
      </motion.div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {history.length === 0 && !chatMutation.isPending && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="h-12 w-12 text-muted-foreground/20 mb-4" />
            <p className="text-lg font-medium">How can I help?</p>
            <p className="text-sm text-muted-foreground mt-1">Ask about alerts, create monitors, or analyze incidents.</p>
          </div>
        )}

        {history.map((msg: any, i: number) => (
          <motion.div key={i} variants={item} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
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
              {renderContent(msg.content)}
              <span className={`mt-2 block text-[10px] ${msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                {formatTime(msg.timestamp)}
              </span>
            </div>
            {msg.role === "user" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </motion.div>
        ))}

        {chatMutation.isPending && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="rounded-xl bg-card border border-border px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-6 py-2 flex gap-2">
        {quickActions.map(a => (
          <button
            key={a.label}
            onClick={() => { setInput(a.label); }}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <a.icon className="h-3 w-3" />{a.label}
          </button>
        ))}
      </div>

      <div className="border-t border-border px-6 py-4">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder="Ask Argus anything..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSend}
            disabled={chatMutation.isPending || !input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
