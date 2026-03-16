export type HostSortKey = "name" | "status" | "cpu" | "memory" | "uptime" | "last_seen";
export type HostSortDirection = "asc" | "desc";

const statusOrder: Record<string, number> = {
  critical: 0,
  warning: 1,
  healthy: 2,
  unknown: 3,
};

function uptimeToMinutes(value?: string | null): number {
  if (!value) return -1;
  const match = value.match(/(\d+)\s*([smhdw])/i);
  if (!match) return -1;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = { s: 1 / 60, m: 1, h: 60, d: 1440, w: 10080 };
  return amount * (multipliers[unit] ?? 0);
}

function compareValues(a: number | string, b: number | string) {
  if (typeof a === "string" && typeof b === "string") {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  }
  return Number(a) - Number(b);
}

export function sortHosts<T extends Record<string, any>>(
  hosts: T[],
  sortKey: HostSortKey,
  sortDirection: HostSortDirection,
): T[] {
  const sorted = [...hosts].sort((a, b) => {
    let left: number | string;
    let right: number | string;

    switch (sortKey) {
      case "name":
        left = a.name || "";
        right = b.name || "";
        break;
      case "status":
        left = statusOrder[a.status] ?? 99;
        right = statusOrder[b.status] ?? 99;
        break;
      case "cpu":
        left = a.cpu_percent ?? -1;
        right = b.cpu_percent ?? -1;
        break;
      case "memory":
        left = a.memory_percent ?? -1;
        right = b.memory_percent ?? -1;
        break;
      case "uptime":
        left = uptimeToMinutes(a.uptime);
        right = uptimeToMinutes(b.uptime);
        break;
      case "last_seen":
        left = a.last_seen ? new Date(a.last_seen).getTime() : 0;
        right = b.last_seen ? new Date(b.last_seen).getTime() : 0;
        break;
      default:
        left = a.name || "";
        right = b.name || "";
    }

    return compareValues(left, right);
  });

  return sortDirection === "asc" ? sorted : sorted.reverse();
}
