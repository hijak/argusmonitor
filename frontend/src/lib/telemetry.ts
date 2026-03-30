import { init, trackEvent } from "@aptabase/web";
import type { AppMeta } from "@/contexts/AppMetaContext";

const APP_KEY = "A-SH-3181979690";
const HOST = "https://aptabase.exnet.systems";
const DEDUPE_KEY = "vordr.telemetry.last-app-start.v2";

let initialized = false;

export function maybeInitTelemetry(meta: AppMeta | null, telemetryEnabled: boolean | null | undefined) {
  if (!meta || meta.edition?.profile !== "self_hosted" || telemetryEnabled === false || initialized) {
    return false;
  }

  init(APP_KEY, {
    host: HOST,
    appVersion: import.meta.env.VITE_APP_VERSION,
  });
  initialized = true;
  return true;
}

export function trackAppStart(meta: AppMeta | null, telemetryEnabled: boolean | null | undefined) {
  const ready = maybeInitTelemetry(meta, telemetryEnabled);
  if (!ready && !initialized) return;

  const now = Date.now();
  const last = Number(localStorage.getItem(DEDUPE_KEY) || "0");
  if (Number.isFinite(last) && now - last < 12 * 60 * 60 * 1000) return;

  localStorage.setItem(DEDUPE_KEY, String(now));
  void trackEvent("app_started", {
    edition: meta?.edition?.profile || "unknown",
    managed: Boolean(meta?.edition?.is_managed),
  });
}
