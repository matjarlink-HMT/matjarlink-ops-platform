// Meta Graph API adapter — Instagram + Facebook comments, messages, media, replies.
// Tokens are read dynamically (env var OR runtime config set via the Connections page),
// so the app "lights up" the moment a token is provided — no restart needed.
import { cfgGet } from "../store.js";

const V = () => cfgGet("META_GRAPH_VERSION") || "v19.0";
const BASE = () => `https://graph.facebook.com/${V()}`;
const TOKEN = () => cfgGet("META_ACCESS_TOKEN");
const IG = () => cfgGet("META_IG_USER_ID");
const PAGE = () => cfgGet("META_PAGE_ID");

export const metaReady = () => Boolean(TOKEN() && (IG() || PAGE()));

async function g(path, params = {}) {
  const url = new URL(`${BASE()}/${path}`);
  url.search = new URLSearchParams({ access_token: TOKEN(), ...params }).toString();
  const json = await (await fetch(url)).json();
  if (json.error) throw new Error(`[meta] ${json.error.message}`);
  return json;
}
async function post(path, body = {}) {
  const res = await fetch(`${BASE()}/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: TOKEN(), ...body })
  });
  const json = await res.json();
  if (json.error) throw new Error(`[meta] ${json.error.message}`);
  return json;
}
const ago = (iso) => {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.round(m / 60); if (h < 24) return `قبل ${h} ساعة`;
  return `قبل ${Math.round(h / 24)} يوم`;
};

export async function getComments(limit = 25) {
  if (!metaReady() || !IG()) return [];
  const media = await g(`${IG()}/media`, { fields: "id,caption,timestamp", limit: 8 });
  const out = [];
  for (const md of media.data || []) {
    const cs = await g(`${md.id}/comments`, { fields: "id,text,username,timestamp", limit: 10 });
    for (const c of cs.data || []) out.push({ ch: "IG", id: c.id, who: "@" + (c.username || "user"), tx: c.text || "", tm: ago(c.timestamp), ref: "على منشور: " + (md.caption || md.id).slice(0, 30), sug: "" });
  }
  return out.slice(0, limit);
}
export async function getMessages(limit = 25) {
  if (!metaReady() || !PAGE()) return [];
  const out = [];
  for (const platform of ["instagram", "messenger"]) {
    try {
      const convos = await g(`${PAGE()}/conversations`, { platform, fields: "participants,updated_time,messages.limit(1){message,from,created_time}", limit: 10 });
      for (const cv of convos.data || []) {
        const last = cv.messages?.data?.[0];
        const who = cv.participants?.data?.find(p => p.id !== PAGE())?.username || cv.participants?.data?.[0]?.name || "عميل";
        out.push({ ch: platform === "instagram" ? "IG" : "FB", id: cv.id, who: (platform === "instagram" ? "@" : "") + who, tx: last?.message || "", tm: ago(cv.updated_time), sug: "" });
      }
    } catch (e) { /* platform not enabled */ }
  }
  return out.slice(0, limit);
}
export async function getPublished(limit = 12) {
  if (!metaReady() || !IG()) return [];
  const media = await g(`${IG()}/media`, { fields: "id,caption,media_type,permalink,timestamp,like_count,comments_count", limit });
  return (media.data || []).map(m => ({ id: m.id, t: (m.caption || m.media_type).slice(0, 40), cap: m.caption || "", type: m.media_type, ch: "IG", d: (m.timestamp || "").slice(0, 16).replace("T", " · "), ts: m.timestamp || "", likes: m.like_count ?? 0, comments: m.comments_count ?? 0, m: `${m.like_count ?? 0} إعجاب · ${m.comments_count ?? 0} تعليق`, url: m.permalink }));
}

// Instagram ACCOUNT-level insights (the native IG "Insights" numbers): reach,
// profile views, interactions, follower count + follower demographics. Each group
// is fetched independently so one unsupported metric never blanks the rest.
export async function getAccountInsights() {
  if (!metaReady() || !IG()) return null;
  const out = { totals: {}, demographics: {}, series: {} };
  const until = Math.floor(Date.now() / 1000), since = until - 29 * 86400;
  // Account totals over the last 30 days (metric_type=total_value).
  try {
    const r = await g(`${IG()}/insights`, { metric: "reach,profile_views,accounts_engaged,total_interactions,website_clicks", metric_type: "total_value", period: "day", since, until });
    for (const it of r.data || []) out.totals[it.name] = it.total_value?.value ?? (it.values || []).reduce((a, v) => a + (v.value || 0), 0);
  } catch (e) { out.totalsError = e.message; }
  // Follower-count daily series (→ current total + trend).
  try {
    const r = await g(`${IG()}/insights`, { metric: "follower_count", period: "day", since, until });
    const vals = (r.data?.[0]?.values || []).map((v) => v.value || 0);
    out.series.followers = vals; out.gainedFollowers = vals.reduce((a, b) => a + b, 0);
  } catch (e) {}
  // Profile snapshot (authoritative follower/media count + username).
  try {
    const p = await g(`${IG()}`, { fields: "followers_count,follows_count,media_count,username,name,profile_picture_url,biography" });
    out.profile = { followers: p.followers_count ?? null, follows: p.follows_count ?? null, media: p.media_count ?? null, username: p.username, name: p.name, pic: p.profile_picture_url, bio: p.biography };
  } catch (e) {}
  // Follower demographics (top breakdowns).
  for (const bd of ["country", "city", "age", "gender"]) {
    try {
      const r = await g(`${IG()}/insights`, { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", timeframe: "last_30_days", breakdown: bd });
      const results = r.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
      out.demographics[bd] = results.map((x) => ({ label: (x.dimension_values || [])[0], value: x.value })).sort((a, b) => b.value - a.value).slice(0, 6);
    } catch (e) {}
  }
  return out;
}

// Reach / impressions / saved / shares for one media (Insights edge).
export async function getMediaInsights(mediaId) {
  if (!metaReady() || !mediaId) return null;
  try {
    const r = await g(`${mediaId}/insights`, { metric: "reach,saved,shares,total_interactions" });
    const out = {};
    for (const it of r.data || []) out[it.name] = it.values?.[0]?.value ?? 0;
    return out;
  } catch (e) { return null; } // some metrics not available for older/di­fferent media types
}
export async function replyToComment(commentId, message) { return post(`${commentId}/replies`, { message }); }
export async function sendMessage(recipientId, message) { return post(`me/messages`, { recipient: { id: recipientId }, message: { text: message }, messaging_type: "RESPONSE" }); }
