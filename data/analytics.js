// Per-platform analytics. NO mock/demo numbers — the Analytics page reads only
// REAL data synced from the connected platforms (Instagram via Meta, aggregate
// via Windsor). This returns an empty platform set on purpose; real figures come
// from /api/analytics/instagram, the Windsor insights, and /api/analytics/posts.
export function getAnalytics(range = "7d", windsor = null) {
  return { range, days: range === "30d" ? 30 : 7, live: Boolean(windsor), platforms: [] };
}
