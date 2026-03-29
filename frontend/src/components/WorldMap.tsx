import { useRef, useState } from "react";
import { motion } from "framer-motion";
import DottedMap from "dotted-map";

export type WorldPing = {
  id: string;
  label: string;
  x: number;
  y: number;
  severity?: "critical" | "warning" | "info" | "healthy";
  meta?: string;
  nodes?: Array<{ name: string; ip?: string | null; inAlert?: boolean; severity?: "critical" | "warning" | "info" | "healthy"; alertCount?: number }>;
};

type DotConnection = {
  start: { lat: number; lng: number; label?: string };
  end: { lat: number; lng: number; label?: string };
};

function pingColor(severity?: WorldPing["severity"]) {
  switch (severity) {
    case "critical": return "#ef4444";
    case "warning": return "#f59e0b";
    case "healthy": return "#22c55e";
    default: return "#0ea5e9";
  }
}

function xyToLatLng(x: number, y: number) {
  const lng = x * 360 - 180;
  const lat = 90 - y * 180;
  return { lat, lng };
}

function projectPoint(lat: number, lng: number) {
  const x = (lng + 180) * (800 / 360);
  const y = (90 - lat) * (400 / 180);
  return { x, y };
}

function createCurvedPath(start: { x: number; y: number }, end: { x: number; y: number }) {
  const midX = (start.x + end.x) / 2;
  const midY = Math.min(start.y, end.y) - 50;
  return `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;
}

export function WorldMap({ pings, className = "", dense = false }: { pings: WorldPing[]; className?: string; dense?: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const map = new DottedMap({ height: 100, grid: "diagonal" });
  const svgMap = map.getSVG({
    radius: 0.24,
    color: "rgba(163, 149, 142, 0.32)",
    shape: "circle",
    backgroundColor: "hsl(20 8% 15%)",
  });

  const dots: DotConnection[] = pings.map((ping) => ({
    start: { ...xyToLatLng(0.49, 0.24), label: "Vordr" },
    end: { ...xyToLatLng(ping.x, ping.y), label: ping.label },
  }));
  const showTracers = pings.length > 1;

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl border border-border bg-card font-sans ${className}`}>
      <img
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMap)}`}
        className="pointer-events-none absolute inset-0 h-full w-full select-none [mask-image:linear-gradient(to_bottom,transparent,white_10%,white_90%,transparent)]"
        alt="world map"
        draggable={false}
      />
      <svg ref={svgRef} viewBox="0 0 800 400" className="absolute inset-0 h-full w-full select-none">
        {dots.map((dot, i) => {
          const ping = pings[i];
          const startPoint = projectPoint(dot.start.lat, dot.start.lng);
          const endPoint = projectPoint(dot.end.lat, dot.end.lng);
          const color = pingColor(ping?.severity);
          const isHovered = hoveredId === ping.id;
          const nodes = ping.nodes?.length ? ping.nodes : [{ name: ping.label, ip: ping.meta || null, inAlert: false, severity: "healthy" as const }];
          const tooltipWidth = dense ? 220 : 260;
          const tooltipHeight = Math.min(220, Math.max(78, 42 + nodes.length * 34));
          const tooltipX = Math.max(12, Math.min(800 - tooltipWidth - 12, endPoint.x + 10));
          const tooltipY = Math.max(12, Math.min(400 - tooltipHeight - 12, endPoint.y - 14));
          return (
            <g key={`path-group-${i}`}>
              {showTracers && (
                <motion.path
                  d={createCurvedPath(startPoint, endPoint)}
                  fill="none"
                  stroke="url(#path-gradient)"
                  strokeWidth="1.2"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1, delay: 0.18 * i, ease: "easeOut" }}
                />
              )}
              <g
                onMouseEnter={() => setHoveredId(ping.id)}
                onMouseLeave={() => setHoveredId((current) => current === ping.id ? null : current)}
                className="cursor-pointer"
              >
                <circle cx={endPoint.x} cy={endPoint.y} r={dense ? 4 : 5} fill={color} opacity={0.2} />
                <circle cx={endPoint.x} cy={endPoint.y} r={dense ? 2.5 : 3.5} fill={color} />
                <circle cx={endPoint.x} cy={endPoint.y} r={dense ? 2.5 : 3.5} fill={color} opacity="0.55">
                  <animate attributeName="r" from={dense ? "2.5" : "3.5"} to={dense ? "8" : "12"} dur="1.5s" begin="0s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.55" to="0" dur="1.5s" begin="0s" repeatCount="indefinite" />
                </circle>
                {isHovered && (
                  <foreignObject
                    x={tooltipX}
                    y={tooltipY}
                    width={String(tooltipWidth)}
                    height={String(tooltipHeight)}
                    className="overflow-visible pointer-events-none"
                  >
                    <div className="rounded-xl border border-border bg-card px-3 py-2 text-[12px] text-card-foreground shadow-2xl" xmlns="http://www.w3.org/1999/xhtml">
                      <div className="mb-2 flex items-center justify-between gap-2 border-b border-border/70 pb-2">
                        <div className="font-semibold text-card-foreground">{ping.label}</div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{ping.meta}</div>
                      </div>
                      <div className="space-y-1.5">
                        {nodes.map((node) => (
                          <div key={`${ping.id}-${node.name}`} className={`rounded-md px-2.5 py-1.5 ${node.inAlert ? 'bg-destructive/10 ring-1 ring-destructive/30' : 'bg-background/35'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`truncate ${node.inAlert ? 'text-foreground' : 'text-card-foreground'}`}>{node.name}</span>
                              {node.inAlert && <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-destructive">{node.alertCount || 1} alert{(node.alertCount || 1) === 1 ? '' : 's'}</span>}
                            </div>
                            <div className="truncate font-mono text-[11px] text-muted-foreground">{node.ip || "No IP"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </foreignObject>
                )}
              </g>
            </g>
          );
        })}
        <defs>
          <linearGradient id="path-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="5%" stopColor="#0ea5e9" stopOpacity="1" />
            <stop offset="95%" stopColor="#0ea5e9" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <div className="relative z-10 flex h-full flex-col justify-between px-4 py-3 pointer-events-none">
        <div className="flex items-center justify-end text-[11px] uppercase tracking-[0.22em] text-slate-300/70">
          <span>{pings.length} location{pings.length === 1 ? "" : "s"}</span>
        </div>
        <div />
      </div>
    </div>
  );
}
