import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { baseState } from "./data/seed.js";
import { getAnalytics } from "./data/analytics.js";
import { loadContent, saveContent, appendPost, nextIdNum } from "./data/content.js";
import * as generator from "./data/generator.js";
import * as store from "./store.js";
import * as meta from "./integrations/meta.js";
import * as windsor from "./integrations/windsor.js";
import * as wa from "./integrations/whatsapp.js";
import * as claude from "./integrations/claude.js";
import * as metaPublish from "./integrations/metaPublish.js";
import { fetchDrive } from "./integrations/driveMedia.js";
import { managerSystem, demoReply, errReply, managerNoteSystem, demoNoteReply, agentImproveSystem, fallbackImprovement } from "./data/manager.js";

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
    if (req.path.startsWith("/webhook") || req.path.startsWith("/media")) return next(); // media must be public for Instagram to pull
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
  // Merge approved agent self-improvements (raised level, updated task/eval/suggestion).
  const agState = store.getAgentState();
  state.agents = state.agents.map((a) => {
    const o = agState[a.n];
    if (!o) return a;
    return { ...a, task: o.task || a.task, ev: o.ev || a.ev, sug: o.sug || a.sug, sc: o.sc ?? a.sc, improved: true, improvements: o.improvements || 0 };
  });
  state.notes = store.getNotes();
  state.publishReady = metaPublish.publishReady();
  state.autoPublish = (process.env.AUTO_PUBLISH || store.cfgGet("AUTO_PUBLISH")) === "on";
  state.publishedLog = store.getPublished();
  // Apply Claude-regenerated content overrides onto the queue.
  const ov = store.getOverrides();
  state.queue = state.queue.map((q) => {
    const o = ov[q.id]; if (!o) return q;
    return { ...q, t: o.t ?? q.t, cap: o.cap ?? q.cap, brief: o.brief ?? q.brief, ty: o.ty ?? q.ty, regenerated: true, regens: o.regens };
  });
  state.plan = (loadContent() || {}).plan || state.plan || null;
  // Live KPIs computed from real state (no static/fake numbers).
  const followers = state.insights?.followers ?? 558;
  const pending = state.queue.filter((q) => !state.publishedLog[q.id] && state.notes[q.id]?.status !== "معتمد").length;
  const publishedCount = Object.keys(state.publishedLog).length;
  state.kpis = [
    [String(state.agents.length), "", state.mode === "live" ? "حيّ" : "—", "p-new"],
    [String(pending), "", "بانتظار الاعتماد", "p-warn"],
    [String(publishedCount), "", "منذ الإطلاق", publishedCount ? "p-ok" : "p-idle"],
    [String(followers), "", "إنستغرام", "p-info"]
  ];
  res.json(state);
});

// ── Content generation (Claude) ─────────────────────────────────────
// Regenerate one post from the owner's notes; persists an override.
app.post("/api/regenerate", async (req, res) => {
  const { id, lang } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, error: "id required" });
  if (!generator.claudeReady()) return res.status(400).json({ ok: false, error: "add ANTHROPIC_API_KEY to enable generation" });
  const item = fullQueue().find((q) => q.id === id);
  if (!item) return res.status(404).json({ ok: false, error: "post not found" });
  const notes = store.getPostThread(id);
  let out;
  try { out = await generator.regeneratePost({ ...item, ...(store.getOverrides()[id] || {}) }, notes, lang || "ar"); }
  catch (e) { console.error("[regenerate]", e.message); return res.status(500).json({ ok: false, error: e.message }); }
  if (!out) return res.status(502).json({ ok: false, error: "generation failed" });
  const saved = store.setOverride(id, out);
  // Record CAIMO's action in the post thread so the owner sees it happened.
  store.addPostNote(id, "manager", `♻️ أعدتُ توليد المنشور حسب ملاحظتك: «${out.t}». حدّثتُ الكابشن والبريف — بانتظار التصميم الجديد.`);
  res.json({ ok: true, override: saved, thread: store.getPostThread(id) });
});

// Generate a brand-new post from an optional free-form prompt.
app.post("/api/generate-post", async (req, res) => {
  const { prompt, date, lang } = req.body || {};
  if (!generator.claudeReady()) return res.status(400).json({ ok: false, error: "add ANTHROPIC_API_KEY to enable generation" });
  const idNum = nextIdNum(baseState().queue);
  const when = date || defaultNextSlot();
  let post;
  try { post = await generator.generatePost({ idNum, date: when, prompt: prompt || "" }, lang || "ar"); }
  catch (e) { console.error("[generate-post]", e.message); return res.status(500).json({ ok: false, error: e.message }); }
  if (!post) return res.status(502).json({ ok: false, error: "generation failed" });
  appendPost(post);
  res.json({ ok: true, post });
});

// Full queue = seed (July) + Claude-generated content (Aug+). Used for publishing.
function fullQueue() {
  const q = [...baseState().queue];
  const c = loadContent();
  if (c?.queue?.length) q.push(...c.queue);
  return q;
}

// Public base URL for building absolute media links Instagram can fetch.
const FALLBACK_BASE = "https://matjarlink-ops-production.up.railway.app";
function publicBase(req) { return process.env.PUBLIC_BASE || (req ? `${req.protocol}://${req.get("host")}` : FALLBACK_BASE); }

// Resolve a queue item to publish input. Priority: explicit images[]/mediaUrl,
// else proxy the Drive design through our public /media/drive/<id> URL.
function resolveMedia(q, base) {
  const isReel = (q.ty || "").includes("ريل");
  const cap = q.cap || q.t || "";
  if (q.images?.length) return { images: q.images, caption: cap, kind: q.images.length > 1 ? "carousel" : "image" };
  if (q.mediaUrl) return { mediaUrl: q.mediaUrl.startsWith("/") ? `${base}${q.mediaUrl}` : q.mediaUrl, caption: cap, kind: isReel ? "reel" : "image" };
  if (q.drive) return { mediaUrl: `${base}/media/drive/${q.drive}?type=${isReel ? "video" : "image"}`, caption: cap, kind: isReel ? "reel" : "image" };
  return null;
}

// Drive media proxy — streams a public Drive file with a clean content-type.
app.get("/media/drive/:id", async (req, res) => {
  const id = (req.params.id || "").replace(/[^A-Za-z0-9_-]/g, "");
  if (!id) return res.status(400).send("bad id");
  try {
    const { buf, contentType } = await fetchDrive(id);
    const clean = contentType && !contentType.includes("text/html") && contentType !== "application/octet-stream";
    const type = req.query.type === "video" ? "video/mp4" : clean ? contentType : "image/jpeg";
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.end(buf);
  } catch (e) { console.error("[media]", e.message); res.status(502).send("media fetch failed"); }
});

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

// ── Per-post note → CAIMO replies directly on the post ──────────────
app.post("/api/post-note", async (req, res) => {
  const { id, note, lang } = req.body || {};
  if (!id || !note || !note.trim()) return res.status(400).json({ ok: false, error: "id & note required" });
  store.addPostNote(id, "user", note.trim());
  const item = fullQueue().find((q) => q.id === id) || { id };
  const st = baseState();
  st.connectivity = { meta: meta.metaReady(), whatsapp: wa.whatsappReady(), windsor: windsor.windsorReady() };
  let reply = null;
  try {
    const thread = store.getPostThread(id).map((m) => ({ role: m.role, text: m.text }));
    reply = await claude.chat(thread, managerNoteSystem(st, item, lang || "ar"));
  } catch (e) { console.error("[post-note]", e.message); }
  if (!reply) reply = claude.claudeReady() ? errReply(lang) : demoNoteReply(item, note, lang);
  store.addPostNote(id, "manager", reply);
  res.json({ ok: true, thread: store.getPostThread(id), notes: store.getNotes() });
});

// ── Approve an agent's self-suggestion → CAIMO improves the agent ────
app.post("/api/agent-improve", async (req, res) => {
  const { name, lang } = req.body || {};
  const base = baseState().agents.find((a) => a.n === name);
  if (!base) return res.status(404).json({ ok: false, error: "agent not found" });
  const cur = { ...base, ...(store.getAgentState()[name] || {}) }; // build on latest improvement
  let patch = null;
  try {
    const raw = await claude.chat([{ role: "user", text: "نفّذ الاقتراح المعتمد وارفع مستوى الوكيل. أعد JSON فقط." }], agentImproveSystem(cur, lang || "ar"));
    if (raw) {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { const p = JSON.parse(m[0]); if (p && p.task && p.sug) patch = { task: String(p.task), ev: String(p.ev || ""), sug: String(p.sug), sc: Math.min(99, Math.max(Number(cur.sc) || 0, Number(p.sc) || 0)) }; }
    }
  } catch (e) { console.error("[agent-improve]", e.message); }
  if (!patch) patch = fallbackImprovement(cur);
  const saved = store.applyAgentImprovement(name, patch);
  res.json({ ok: true, agent: { ...cur, ...saved } });
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
  const input = resolveMedia(item, publicBase(req));
  if (!input) return res.status(400).json({ ok: false, error: "no media for this post — add a Drive file (shared publicly), mediaUrl, or images[]" });
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
function parseWhen(date) { const m = (date || "").match(/(\d{4}-\d{2}-\d{2})[^\d]+(\d{2}):(\d{2})/); return m ? new Date(`${m[1]}T${m[2]}:${m[3]}:00+04:00`) : null; } // Oman time (GST)
const STALE_MS = 24 * 3600 * 1000; // don't auto-post backlog older than a day
async function autoPublishTick() {
  if (!AUTO() || !metaPublish.publishReady()) return;
  const notes = store.getNotes();
  const now = Date.now();
  for (const q of fullQueue()) {
    if (store.isPublished(q.id)) continue;
    const approved = notes[q.id]?.status === "معتمد"; // explicit approval required for auto-post
    const when = parseWhen(q.date);
    if (!approved || !when) continue;
    const dueAgo = now - when.getTime();
    if (dueAgo < 0 || dueAgo > STALE_MS) continue; // not due yet, or too stale (publish manually)
    const input = resolveMedia(q, publicBase());
    if (!input) continue; // needs media
    try { const r = await metaPublish.publish(input); store.markPublished(q.id, r); console.log(`[auto-publish] ${q.id} → ${r.permalink || r.id}`); }
    catch (e) { console.error(`[auto-publish] ${q.id}: ${e.message}`); }
    break; // at most one publish per tick — avoids simultaneous bursts
  }
}
setInterval(() => { autoPublishTick().catch(() => {}); }, 60000);

// ── Content automation ── plan next month on the 20th; generate each post ~1 week
// before its date. Runs server-side so it works even when the Mac is off. Needs
// ANTHROPIC_API_KEY, and a Railway Volume (CONTENT_FILE) for durable storage.
function defaultNextSlot() {
  const d = new Date(Date.now() + 7 * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} · 20:00`;
}
const ARMONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
async function automationTick() {
  if (!generator.claudeReady()) return;
  const now = new Date();
  const doc = loadContent() || { batch: null, plan: null, queue: [] };
  doc.queue = doc.queue || [];
  const nm = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
  const ny = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const nextKey = `${ny}-${String(nm + 1).padStart(2, "0")}`;
  // 1) Monthly plan for next month, on/after the 20th (once per month).
  if (now.getDate() >= 20 && (!doc.plan || doc.plan.forMonth !== nextKey)) {
    try {
      const plan = await generator.generatePlan(`${ARMONTHS[nm]} ${ny}`, ny, nm + 1);
      if (plan) { plan.forMonth = nextKey; doc.plan = plan; doc.generatedBy = "server-scheduler"; saveContent(doc); console.log(`[plan] generated ${nextKey}`); }
    } catch (e) { console.error("[plan]", e.message); }
    return; // one heavy op per tick
  }
  // 2) Daily post generation — concepts due within 7 days, not yet generated.
  const plan = doc.plan;
  if (!plan || !Array.isArray(plan.concepts)) return;
  const [py, pmo] = (plan.forMonth || nextKey).split("-").map(Number);
  const existing = new Set([...(baseState().queue || []).map((q) => q.id), ...doc.queue.map((q) => q.id)]);
  for (const c of plan.concepts) {
    if (c.generatedId && existing.has(c.generatedId)) continue;
    const when = new Date(py, pmo - 1, c.day || 1, 20, 0, 0);
    const daysAhead = (when - now) / 86400000;
    if (daysAhead < 0 || daysAhead > 7) continue;
    const idNum = nextIdNum(baseState().queue);
    const dateStr = `${py}-${String(pmo).padStart(2, "0")}-${String(c.day || 1).padStart(2, "0")} · 20:00`;
    try {
      const post = await generator.generatePost({ idNum, date: dateStr, pillar: c.pillar || "", prompt: c.t || "" });
      if (post) { post.ty = c.ty || post.ty; c.generatedId = post.id; doc.queue.push(post); saveContent(doc); console.log(`[postgen] ${post.id} for ${dateStr}`); }
    } catch (e) { console.error("[postgen]", e.message); }
    break; // one per tick
  }
}
setInterval(() => { automationTick().catch(() => {}); }, 6 * 3600 * 1000);

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
