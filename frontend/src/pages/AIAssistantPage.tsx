import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Bot, Send, User, Zap, Server, Bell, LayoutDashboard, Loader2, Plus, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

const quickActions = [
  { label: "Explain alert", icon: Bell },
  { label: "Create monitor", icon: Zap },
  { label: "Server health", icon: Server },
  { label: "Build dashboard", icon: LayoutDashboard },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="argus-markdown prose prose-invert max-w-none prose-p:my-2 prose-pre:rounded-lg prose-pre:border prose-pre:border-border prose-pre:bg-black/30 prose-code:text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-li:text-foreground/90 prose-table:text-foreground prose-th:text-foreground prose-td:text-foreground/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code(props) {
            const { children, className, ...rest } = props;
            const inline = !className;
            if (inline) {
              return <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground" {...rest}>{children}</code>;
            }
            return <code className={className} {...rest}>{children}</code>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function AIAssistantPage() {
  const [input, setInput] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: sessions = [] } = useQuery({
    queryKey: ["ai-sessions"],
    queryFn: api.aiSessions,
  });

  useEffect(() => {
    if (!selectedSessionId && sessions.length > 0) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  const { data: history = [] } = useQuery({
    queryKey: ["ai-history", selectedSessionId],
    queryFn: () => api.aiHistory(selectedSessionId || undefined),
    enabled: sessions.length > 0 || !!selectedSessionId,
    refetchInterval: selectedSessionId ? 5000 : false,
    refetchIntervalInBackground: true,
  });

  const createSessionMutation = useMutation({
    mutationFn: () => api.aiCreateSession(`Chat ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
      setSelectedSessionId(session.id);
      toast.success("New chat created");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create chat session"),
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      let sessionId = selectedSessionId;
      if (!sessionId) {
        const session = await api.aiCreateSession(message.slice(0, 60));
        sessionId = session.id;
        setSelectedSessionId(sessionId);
        queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
      }
      return api.aiChat(message, sessionId || undefined);
    },
    onSuccess: (response) => {
      if (response.session_id) setSelectedSessionId(response.session_id);
      queryClient.invalidateQueries({ queryKey: ["ai-history"] });
      queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
    },
    onError: (error: Error) => toast.error(error.message || "AI request failed"),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, chatMutation.isPending]);

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;
    chatMutation.mutate(input);
    setInput("");
  };

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const selectedSession = useMemo(() => sessions.find((s: any) => s.id === selectedSessionId), [sessions, selectedSessionId]);

  return (
    <motion.div className="flex h-full" variants={container} initial="hidden" animate="show">
      <aside className="hidden w-72 shrink-0 border-r border-border bg-card/40 lg:flex lg:flex-col">
        <div className="border-b border-border p-4">
          <button
            onClick={() => createSessionMutation.mutate()}
            disabled={createSessionMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {createSessionMutation.isPending ? "Creating..." : "New chat"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sessions.map((session: any) => (
            <button
              key={session.id}
              onClick={() => setSelectedSessionId(session.id)}
              className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                selectedSessionId === session.id ? "border-primary/40 bg-primary/10" : "border-border bg-background hover:bg-surface-hover"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-md bg-muted p-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{session.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(session.updated_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            </button>
          ))}
          {sessions.length === 0 && <div className="px-3 py-6 text-sm text-muted-foreground">No chats yet.</div>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <motion.div variants={item} className="border-b border-border px-6 py-4">
          <PageHeader title="Argus Co-pilot" description={selectedSession?.title || "AI-powered monitoring assistant"}>
            <button
              onClick={() => createSessionMutation.mutate()}
              disabled={createSessionMutation.isPending}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-surface-hover lg:hidden"
            >
              <Plus className="h-4 w-4" />
              New chat
            </button>
          </PageHeader>
        </motion.div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {history.length === 0 && !chatMutation.isPending && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Bot className="mb-4 h-12 w-12 text-muted-foreground/20" />
              <p className="text-lg font-medium">How can I help?</p>
              <p className="mt-1 text-sm text-muted-foreground">Ask about alerts, create monitors, or analyze incidents.</p>
            </div>
          )}

          {history.map((msg: any, i: number) => (
            <motion.div key={i} variants={item} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={`max-w-3xl rounded-xl px-4 py-3 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
                {msg.role === "user" ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <MarkdownMessage content={msg.content} />
                )}
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
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="px-6 py-2 flex flex-wrap gap-2 border-t border-border/50">
          {quickActions.map((a) => (
            <button
              key={a.label}
              onClick={() => setInput(a.label)}
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
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
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
      </div>
    </motion.div>
  );
}
