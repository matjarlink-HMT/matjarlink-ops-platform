// Meta Graph API adapter — Instagram + Facebook comments, messages, media, replies.
// Uses global fetch (Node 18+). All calls are no-ops that return [] if the token is missing,
// so the app runs fine in mock mode and "lights up" the moment META_ACCESS_TOKEN is set.

const V = process.env.META_GRAPH_VERSION || "v19.0";
const BASE = `https://graph.facebook.com/${V}`;
const TOKEN = process.env.META_ACCESS_TOKEN || "";
const IG = process.env.META_IG_USER_ID || "";
const PAGE = process.env.META_PAGE_ID || "";

export const metaReady = () => Boolean(TOKEN && (IG || PAGE));

async function g(path, params = {}) {
  const url = new URL(`${BASE}/${path}`);
  url.search = new URLSearchParams({ access_token: TOKEN, ...params }).toString();
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(`[meta] ${json.error.message}`);
  return json;
}
async function post(path, body = {}) {
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: TOKEN, ...body })
  });
  const json = await res.json();
  if (json.error) throw new Error(`[meta] ${json.error.message}`);
  return json;
}

const ago = (iso) => {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `قبل ${mins} دقيقة`;
  const h = Math.round(mins / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  return `قبل ${Math.round(h / 24)} يوم`;
};

// ── Comments: latest across the newest IG media ──────────────────────
export async function getComments(limit = 25) {
  if (!metaReady() || !IG) return [];
  const media = await g(`${IG}/media`, { fields: "id,caption,timestamp", limit: 8 });
  const out = [];
  for (const m of media.data || []) {
    const cs = await g(`${m.id}/comments`, { fields: "id,text,username,timestamp", limit: 10 });
    for (const c of cs.data || []) {
      out.push({
        ch: "IG", id: c.id, who: "@" + (c.username || "user"),
        tx: c.text || "", tm: ago(c.timestamp),
        ref: "على منشور: " + (m.caption || m.id).slice(0, 30), sug: ""
      });
    }
  }
  return out.slice(0, limit);
}

// ── Messages / conversations (Instagram + Facebook Page inbox) ───────
export async function getMessages(limit = 25) {
  if (!metaReady() || !PAGE) return [];
  const out = [];
  for (const platform of ["instagram", "messenger"]) {
    try {
      const convos = await g(`${PAGE}/conversations`, { platform, fields: "participants,updated_time,messages.limit(1){message,from,created_time}", limit: 10 });
      for (const cv of convos.data || []) {
        const last = cv.messages?.data?.[0];
        const who = cv.participants?.data?.find(p => p.id !== PAGE)?.username
          || cv.participants?.data?.[0]?.name || "عميل";
        out.push({
          ch: platform === "instagram" ? "IG" : "FB", id: cv.id,
          who: (platform === "instagram" ? "@" : "") + who,
          tx: last?.message || "", tm: ago(cv.updated_time), sug: ""
        });
      }
    } catch (e) { /* platform not enabled — skip */ }
  }
  return out.slice(0, limit);
}

// ── Latest published media ──────────────────────────────────────────
export async function getPublished(limit = 10) {
  if (!metaReady() || !IG) return [];
  const media = await g(`${IG}/media`, { fields: "id,caption,media_type,permalink,timestamp,like_count,comments_count", limit });
  return (media.data || []).map(m => ({
    t: (m.caption || m.media_type).slice(0, 40), ch: "IG",
    d: (m.timestamp || "").slice(0, 16).replace("T", " · "),
    m: `${m.like_count ?? 0} إعجاب · ${m.comments_count ?? 0} تعليق`, url: m.permalink
  }));
}

// ── Replies ─────────────────────────────────────────────────────────
export async function replyToComment(commentId, message) {
  return post(`${commentId}/replies`, { message });
}
export async function sendMessage(conversationRecipientId, message) {
  // For Page/IG messaging you send to the user id via /me/messages
  return post(`me/messages`, {
    recipient: { id: conversationRecipientId },
    message: { text: message }, messaging_type: "RESPONSE"
  });
}
