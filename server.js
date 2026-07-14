import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { baseState } from "./data/seed.js";
import { getAnalytics } from "./data/analytics.js";
import { loadContent } from "./data/content.js";
import * as store from "./store.js";
import * as meta from "./integrations/meta.js";
import * as windsor from "./integrations/windsor.js";
import * as wa from "./integrations/whatsapp.js";
import * as claude from "./integrations/claude.js";
import * as metaPublish from "./integrations/metaPublish.js";
import { managerSystem, demoReply, errReply } from "./data/manager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const MODE = process.env.MODE || "mock";
const PORT = process.env.PORT || 8080;

// ── Optional password gate ──────────────────────────────────────────
const PW = process.env.DASHBOARD_PASSWORD || "";
if (PW) {
  app.use((req, res, next) => {
    if (req.path.startsWith("/webhook")) return next();
    const hdr = req.headers.authorization || "";
    const [, b64] = hdr.split(" ");
    const [, pass] = Buffer.from(b64 || "", "base64").toString().split(":");
    if (pass === PW) return next();
    res.set("WWW-Authenticate", 'Basic realm="MatjarLink Ops"').status(401).send("Auth required");
  });
}

// ── Aggregated state ────────────────────────────────────────────────
app.get("/api/state", async (req, res) => {
  const state = baseState();
  // Merge Claude-generated content (plan + captions) so new batches appear automatically.
  const content = loadContent();
  if (content) {
    if (content.queue?.length) state.queue = [...state.queue, ...content.queue];
    if (content.prep?.length) state.prep = [...state.prep, ...content.prep];
    if (content.plan) state.plan = content.plan;
    state.contentBatch = content.batch || null;
    state.contentGeneratedAt = content.generatedAt || null;
  }
  const conn = { meta: meta.metaReady(), whatsapp: wa.whatsappReady(), windsor: windsor.windsorReady() };
  state.connectivity = conn;
  state.mode = (conn.meta || conn.whatsapp || conn.windsor || MODE === "live") ? "live" : "mock";
  state.generatedAt = new Date().toISOString();

  // Attempt live pulls for whichever integrations are connected; each returns
  // empty/null instantly when not ready, so mock mode stays fast.
  const settle = async (p, fb) => { try { return await p; } catch (e) { console.error(e.message); return fb; } };
  const [comments, igMsgs, published, insights] = await Promise.all([
    settle(meta.getComments(), []), settle(meta.getMessages(), []),
    settle(meta.getPublished(), []), settle(windsor.getInsights(), null)
  ]);
  const waMsgs = wa.getMessages();
  if (comments.length) state.comments = comments;
  const merged = [...igMsgs, ...waMsgs];
  if (merged.length) state.messages = merged;
  if (published.length) state.published = published;
  if (insights) state.insights = insights;
  state.notes = store.getNotes();
  state.publishReady = metaPublish.publishReady();
  state.autoPublish = (process.env.AUTO_PUBLISH || store.cfgGet("AUTO_PUBLISH")) === "on";
  state.publishedLog = store.getPublished();
  res.json(state);
});

// Full queue = seed (July) + Claude-generated content (Aug+). Used for publishing.
function fullQueue() {
  const q = [...baseState().queue];
  const c = loadContent();
  if (c?.queue?.length) q.push(...c.queue);
  return q;
}

// ── Per-platform analytics ──────────────────────────────────────────
app.get("/api/analytics", async (req, res) => {
  const range = req.query.range === "30d" ? "30d" : "7d";
  let windsorData = null;
  if (windsor.windsorReady()) { try { windsorData = await windsor.getInsights(); } catch (e) { /* fall back to mock */ } }
  res.json(getAnalytics(range, windsorData));
});

// ── Manager chat (CAIMO) — powered by Claude when a key is set ───────
app.get("/api/chat", (req, res) => res.json({ history: store.getChat(), ready: claude.claudeReady() }));
app.post("/api/chat", async (req, res) => {
  const { message, reset, lang } = req.body || {};
  if (reset) return res.json({ ok: true, history: store.resetChat(), ready: claude.claudeReady() });
  if (!message || !message.trim()) return res.status(400).json({ ok: false, error: "message required" });
  store.addChat("user", message.trim());
  const st = baseState();
  st.connectivity = { meta: meta.metaReady(), whatsapp: wa.whatsappReady(), windsor: windsor.windsorReady() };
  st.insights = await settleOrNull(windsor.getInsights());
  let reply = null;
  try { reply = await claude.chat(store.getChat(), managerSystem(st, lang || "ar")); }
  catch (e) { console.error("[chat]", e.message); }
  if (!reply) reply = claude.claudeReady() ? errReply(lang) : demoReply(message, lang);
  store.addChat("manager", reply);
  res.json({ ok: true, history: store.getChat(), ready: claude.claudeReady() });
});
async function settleOrNull(p) { try { return await p; } catch (e) { return null; } }

// ── Connections: status + activation (paste keys → server config) ───
app.get("/api/connections", (req, res) => {
  const f = (k, label, secret) => ({ k, label, secret: !!secret, set: store.cfgHas(k) });
  res.json({ integrations: [
    { key: "claude", name: "Claude — المدير الذكي (CAIMO)", icon: "AI", connected: claude.claudeReady(),
      help: "https://console.anthropic.com/settings/keys", desc: "يشغّل حوار المدير: يناقش، يعترض، ويوجّه الفريق بذكاء.",
      fields: [f("ANTHROPIC_API_KEY", "API Key", true)] },
    { key: "meta", name: "Meta — Instagram + Facebook", icon: "IG", connected: meta.metaReady(),
      help: "https://developers.facebook.com", desc: "التعليقات والرسائل والمنشورات والردود (إنستغرام + فيسبوك).",
      fields: [f("META_ACCESS_TOKEN", "Page Access Token", true), f("META_IG_USER_ID", "Instagram User ID"), f("META_PAGE_ID", "Facebook Page ID")] },
    { key: "windsor", name: "Windsor.ai — التحليلات", icon: "AN", connected: windsor.windsorReady(),
      help: "https://windsor.ai", desc: "بيانات الأداء (وصول/تفاعل/نقرات) لكل المنصات.",
      fields: [f("WINDSOR_API_KEY", "API Key", true)] },
    { key: "whatsapp", name: "WhatsApp Cloud API", icon: "WA", connected: wa.whatsappReady(),
      help: "https://developers.facebook.com", desc: "استقبال رسائل واتساب والرد عليها.",
      fields: [f("WHATSAPP_TOKEN", "Access Token", true), f("WHATSAPP_PHONE_ID", "Phone Number ID")] }
  ]});
});
app.post("/api/connections", (req, res) => {
  const allowed = ["META_ACCESS_TOKEN", "META_IG_USER_ID", "META_PAGE_ID", "WINDSOR_API_KEY", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "META_GRAPH_VERSION", "AUTO_PUBLISH"];
  const clean = {}; for (const k of allowed) if (k in (req.body || {})) clean[k] = req.body[k];
  store.cfgSet(clean);
  res.json({ ok: true, connectivity: { meta: meta.metaReady(), whatsapp: wa.whatsappReady(), windsor: windsor.windsorReady() } });
});

// ── Shared review notes / approvals ─────────────────────────────────
app.get("/api/notes", (req, res) => res.json(store.getNotes()));
app.post("/api/notes", (req, res) => {
  const { id, note, action } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, error: "id required" });
  if (action === "approve") return res.json({ ok: true, notes: store.approve(id) });
  res.json({ ok: true, notes: store.setNote(id, note || "") });
});

// ── Publishing (Instagram) ──────────────────────────────────────────
// Explicit, per-post trigger. Publishes one queued post now. Requires the post
// to carry a public mediaUrl/images (Instagram pulls media from a URL).
app.post("/api/publish", async (req, res) => {
  const { id } = req.body || {};
  if (!metaPublish.publishReady()) return res.status(400).json({ ok: false, error: "Meta publishing not configured (add META_ACCESS_TOKEN + META_IG_USER_ID)" });
  if (store.isPublished(id)) return res.json({ ok: true, already: true, result: store.getPublished()[id] });
  const item = fullQueue().find((q) => q.id === id);
  if (!item) return res.status(404).json({ ok: false, error: "post not found" });
  const input = metaPublish.fromQueueItem(item);
  if (!input) return res.status(400).json({ ok: false, error: "no public media URL for this post — add mediaUrl (image/video) or images[] (carousel)" });
  try {
    const result = await metaPublish.publish(input);
    store.markPublished(id, result);
    res.json({ ok: true, result });
  } catch (e) {
    console.error("[publish]", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Auto-publish scheduler ── OFF by default (AUTO_PUBLISH=on to enable). ──
// When on: every minute, publishes APPROVED posts whose scheduled time has passed
// and that have public media, then records them so they never double-post.
const AUTO = () => (process.env.AUTO_PUBLISH || store.cfgGet("AUTO_PUBLISH")) === "on";
function parseWhen(date) { const m = (date || "").match(/(\d{4}-\d{2}-\d{2})[^\d]+(\d{2}):(\d{2})/); return m ? new Date(`${m[1]}T${m[2]}:${m[3]}:00`) : null; }
async function autoPublishTick() {
  if (!AUTO() || !metaPublish.publishReady()) return;
  const notes = store.getNotes();
  for (const q of fullQueue()) {
    if (store.isPublished(q.id)) continue;
    const approved = notes[q.id]?.status === "معتمد"; // silence-approval handled in UI; require explicit approve for auto-post
    const when = parseWhen(q.date);
    if (!approved || !when || when > new Date()) continue;
    const input = metaPublish.fromQueueItem(q);
    if (!input) continue; // needs public media
    try { const r = await metaPublish.publish(input); store.markPublished(q.id, r); console.log(`[auto-publish] ${q.id} → ${r.permalink || r.id}`); }
    catch (e) { console.error(`[auto-publish] ${q.id}: ${e.message}`); }
  }
}
setInterval(() => { autoPublishTick().catch(() => {}); }, 60000);

// ── Reply router ────────────────────────────────────────────────────
app.post("/api/reply", async (req, res) => {
  const { channel, target, message, kind } = req.body || {};
  if (!message || !target) return res.status(400).json({ ok: false, error: "target & message required" });
  // Send for real when the channel is connected; otherwise simulate.
  const ready = channel === "WA" ? wa.whatsappReady() : meta.metaReady();
  if (!ready) return res.json({ ok: true, simulated: true });
  try {
    let result;
    if (channel === "WA") result = await wa.sendMessage(target, message);
    else if (kind === "comment") result = await meta.replyToComment(target, message);
    else result = await meta.sendMessage(target, message);
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── WhatsApp webhook (verify + ingest) ──────────────────────────────
app.get("/webhook/whatsapp", (req, res) => {
  const verify = process.env.WHATSAPP_VERIFY_TOKEN || "matjarlink_verify";
  if (req.query["hub.verify_token"] === verify) return res.send(req.query["hub.challenge"]);
  res.sendStatus(403);
});
app.post("/webhook/whatsapp", (req, res) => { wa.ingestWebhook(req.body); res.sendStatus(200); });

// ── Public media (Instagram pulls post media from these URLs) ───────
app.use("/media", express.static(path.join(__dirname, "public", "media")));

// ── Static dashboard ────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`\n  MatjarLink Ops Platform`);
  console.log(`  ▸ http://localhost:${PORT}   (MODE=${MODE})`);
  console.log(`  ▸ Meta: ${meta.metaReady() ? "✓ ready" : "— add META_ACCESS_TOKEN"}`);
  console.log(`  ▸ WhatsApp: ${wa.whatsappReady() ? "✓ ready" : "— add WHATSAPP_TOKEN"}`);
  console.log(`  ▸ Windsor: ${windsor.windsorReady() ? "✓ ready" : "— add WINDSOR_API_KEY"}`);
  console.log(`  ▸ Publish: ${metaPublish.publishReady() ? `✓ ready (auto-publish ${AUTO() ? "ON" : "off"})` : "— needs Meta token"}\n`);
});
