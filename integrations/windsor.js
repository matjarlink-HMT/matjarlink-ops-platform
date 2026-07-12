// Windsor.ai adapter — organic + ads performance for IG/FB (and more).
// Returns null if WINDSOR_API_KEY is missing so the dashboard shows "غير مربوط".

const KEY = process.env.WINDSOR_API_KEY || "";
const FIELDS = process.env.WINDSOR_FIELDS || "source,date,followers,reach,impressions,engagement,clicks";

export const windsorReady = () => Boolean(KEY);

export async function getInsights() {
  if (!windsorReady()) return null;
  // Windsor exposes a flat JSON API: https://connectors.windsor.ai/all?api_key=...&fields=...
  const url = new URL("https://connectors.windsor.ai/all");
  url.search = new URLSearchParams({
    api_key: KEY, date_preset: "last_7d", fields: FIELDS
  }).toString();
  const res = await fetch(url);
  const json = await res.json();
  const rows = json.data || [];
  // Aggregate a compact KPI summary for the dashboard.
  const sum = (k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  return {
    updatedFor: "آخر ٧ أيام",
    followers: rows.at(-1)?.followers ?? null,
    reach: sum("reach"), impressions: sum("impressions"),
    engagement: sum("engagement"), clicks: sum("clicks"),
    rows: rows.slice(-14)
  };
}
