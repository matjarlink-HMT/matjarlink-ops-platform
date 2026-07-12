// Windsor.ai adapter — organic + ads performance for IG/FB (and more).
// Key read dynamically (env or Connections page). Returns null if not connected.
import { cfgGet } from "../store.js";

const KEY = () => cfgGet("WINDSOR_API_KEY");
const FIELDS = () => cfgGet("WINDSOR_FIELDS") || "source,date,followers,reach,impressions,engagement,clicks";

export const windsorReady = () => Boolean(KEY());

export async function getInsights() {
  if (!windsorReady()) return null;
  const url = new URL("https://connectors.windsor.ai/all");
  url.search = new URLSearchParams({ api_key: KEY(), date_preset: "last_7d", fields: FIELDS() }).toString();
  const json = await (await fetch(url)).json();
  const rows = json.data || [];
  const sum = (k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  return {
    updatedFor: "آخر ٧ أيام", followers: rows.at(-1)?.followers ?? null,
    reach: sum("reach"), impressions: sum("impressions"), engagement: sum("engagement"), clicks: sum("clicks"),
    rows: rows.slice(-14)
  };
}
