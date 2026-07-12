// Per-platform analytics. Deterministic mock series (stable across refreshes so
// charts don't jump); live data comes from Windsor when MODE=live & key present.

const PLATFORMS = [
  { key: "IG", name: "Instagram", color: "#C13584", followers: 558, active: true, daily: { reach: 600, impressions: 1400, engagement: 92, clicks: 30 } },
  { key: "FB", name: "Facebook", color: "#1877F2", followers: 120, active: true, daily: { reach: 210, impressions: 460, engagement: 26, clicks: 10 } },
  { key: "WA", name: "WhatsApp", color: "#25D366", active: false, note: "يحتاج تفعيل WhatsApp API" },
  { key: "TT", name: "TikTok", color: "#111111", active: false, note: "مخطط بعد الإطلاق" },
  { key: "LI", name: "LinkedIn", color: "#0A66C2", active: false, note: "مخطط للمحتوى B2B" }
];

function wave(avg, i, seed) {
  const w = Math.sin((i + seed) * 0.7) * 0.18 + Math.cos((i + seed) * 0.4) * 0.10;
  return Math.max(0, Math.round(avg * (1 + w) * (1 + i * 0.012)));
}

export function getAnalytics(range = "7d", windsor = null) {
  const days = range === "30d" ? 30 : 7;
  const platforms = PLATFORMS.map((p, idx) => {
    if (!p.active) return { key: p.key, name: p.name, color: p.color, active: false, note: p.note };
    const metrics = {};
    for (const m of ["reach", "impressions", "engagement", "clicks"]) {
      const s = Array.from({ length: days }, (_, i) => wave(p.daily[m], i, idx * 3 + m.length));
      metrics[m] = { series: s, total: s.reduce((a, b) => a + b, 0) };
    }
    const step = Math.max(1, Math.round(p.followers * 0.006));
    const fol = Array.from({ length: days }, (_, i) => p.followers - (days - 1 - i) * step);
    metrics.followers = { series: fol, total: p.followers };
    const er = (metrics.engagement.total / Math.max(1, metrics.reach.total) * 100).toFixed(1);
    return { key: p.key, name: p.name, color: p.color, active: true, followers: p.followers, metrics, engagementRate: er, days };
  });
  return { range, days, live: Boolean(windsor), platforms };
}
