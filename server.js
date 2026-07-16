import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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
import * as live from "./data/live.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } })); // rawBody: webhook HMAC verification
app.use(express.urlencoded({ extended: true }));

const MODE = process.env.MODE || "mock";
const PORT = process.env.PORT || 8080;

// ── Optional password gate ──────────────────────────────────────────
const PW = process.env.DASHBOARD_PASSWORD || "";
if (PW) {
  app.use((req, res, next) => {
    if (req.path.startsWith("/webhook") || req.path.startsWith("/media") || req.path === "/api/pubcheck" || req.path === "/api/debug") return next(); // media must be public for Instagram to pull; pubcheck/debug are read-only audits
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
  // Short-TTL cache: /api/state is polled every 60s per open tab, and getComments
  // alone is ~9 sequential Graph calls — uncached this exhausts IG rate limits.
  const [comments, igMsgs, published, insights] = await Promise.all([
    settle(cached("comments", 240, () => meta.getComments()), []), settle(cached("igmsgs", 240, () => meta.getMessages()), []),
    settle(cached("published", 120, () => meta.getPublished()), []), settle(cached("insights", 600, () => windsor.getInsights()), null)
  ]);
  const waMsgs = wa.getMessages();
  if (comments.length) state.comments = comments;
  const merged = [...igMsgs, ...waMsgs];
  if (merged.length) state.messages = merged;
  // enrich each published post with reach/saved/shares (Insights edge), cached
  if (published.length) {
    const withInsights = await settle(cached("mediaInsights", 900, async () => {
      const capped = published.slice(0, 8);
      const ins = await Promise.all(capped.map((m) => meta.getMediaInsights(m.id).catch(() => null)));
      return published.map((m, i) => (i < ins.length && ins[i]) ? { ...m, reach: ins[i].reach ?? null, saved: ins[i].saved ?? 0, shares: ins[i].shares ?? 0 } : m);
    }), published);
    state.published = withInsights;
    state.topPosts = live.topPosts(withInsights, 5);
  }
  if (insights) state.insights = insights;
  // Ensure the Publish Verifier is always on the roster (added dynamically).
  if (!state.agents.some((a) => a.n === "Publish Verifier")) state.agents = [...state.agents, { ...live.PUBLISH_VERIFIER }];
  // Merge approved agent self-improvements (raised level, updated task/eval/suggestion + changelog).
  const agState = store.getAgentState();
  state.agents = state.agents.map((a) => {
    const o = agState[a.n];
    if (!o) return a;
    return { ...a, task: o.task || a.task, ev: o.ev || a.ev, sug: o.sug || a.sug, sc: o.sc ?? a.sc, improved: true, improvements: o.improvements || 0, changelog: o.changelog || [] };
  });
  state.notes = store.getNotes();
  state.publishReady = metaPublish.publishReady();
  state.autoPublish = (process.env.AUTO_PUBLISH || store.cfgGet("AUTO_PUBLISH")) === "on";
  state.publishedLog = store.getPublished();
  // Apply Claude-regenerated content overrides onto the queue.
  state.queue = state.queue.map(applyOverride);
  // Hide deleted posts.
  const removed = new Set(store.getRemoved());
  if (removed.size) state.queue = state.queue.filter((q) => !removed.has(q.id));
  state.plan = (loadContent() || {}).plan || state.plan || null;

  // ── live derivation: reconcile publishes, then derive needs + agent status ──
  const rec = live.reconcile(state.publishedLog, published); // published = real IG media
  rec.checkedAt = state.generatedAt;
  state.reconcile = rec;
  const liveCtx = { queue: state.queue, notes: state.notes, publishedLog: state.publishedLog, connectivity: conn, publishReady: state.publishReady, reconcile: rec, insights: state.insights, comments: state.comments || [], messages: state.messages || [], plan: state.plan };
  state.agents = live.deriveAgents(state.agents, liveCtx);
  // Needs = live auto-clearing tasks first, then any static forward-looking items
  // from the seed that aren't condition-based (e.g. future hires).
  const staticNeeds = (state.needs || []).filter((n) => /توظيف|مونتاج|جدولة/.test(n.ti || ""));
  state.needs = [...live.deriveNeeds(liveCtx), ...staticNeeds];
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
  // Reels get a REAL new video (motion reel); other posts get a fresh design image.
  const isReel = (item.ty || "").includes("ريل");
  let design = null, reelFailed = false;
  if (isReel) {
    try { design = await renderAndSaveReel(item, out); }
    catch (e) { console.error("[reel]", e.message); reelFailed = true; }
  } else {
    try { design = await renderAndSaveDesign(item, out); }
    catch (e) { console.error("[design]", e.message); }
  }
  const patch = { t: out.t, t2: out.t2 || "", cta: out.cta || "", cap: out.cap, brief: out.brief, photoQuery: out.photo || "", slides: out.slides || [] };
  if (design) { patch.mediaUrl = design.mediaUrl; patch.images = design.images || []; }
  else if (isReel) { patch.mediaUrl = null; patch.images = []; } // fall back to the original Drive video
  const saved = store.setOverride(id, patch);
  // Record CAIMO's action in the post thread so the owner sees it happened.
  const madeDesign = !!(design && design.mediaUrl);
  const what = isReel
    ? (madeDesign ? " — وصنعتُ فيديو ريل جديداً بهوية العلامة" : (reelFailed ? " — تعذّر توليد فيديو جديد فأبقيتُ الفيديو الأصلي" : ""))
    : (madeDesign ? " — وصمّمتُ صورة جديدة بهوية العلامة" : "");
  store.addPostNote(id, "manager", `♻️ أعدتُ توليد ${isReel ? "الريل" : "المنشور"} حسب ملاحظتك: «${out.t}»${what}.`);
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
  try {
    if ((post.ty || "").includes("ريل")) { const r = await renderAndSaveReel(post, post); post.mediaUrl = r.mediaUrl; }
    else { const d = await renderAndSaveDesign(post, post); post.mediaUrl = d.mediaUrl; if (d.images?.length) post.images = d.images; }
  } catch (e) { console.error("[design]", e.message); }
  appendPost(post);
  res.json({ ok: true, post });
});

// ── Content plan (خطة المحتوى) ── editable monthly plans → one-click apply ──
// Returns all stored month plans + a read-only schedule for the CURRENT month
// derived from the real queue (so the owner sees this month alongside next).
function currentMonthSchedule(req) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1, prefix = `${y}-${String(m).padStart(2, "0")}`;
  const base = publicBase(req);
  const items = fullQueue()
    .filter((q) => (q.date || "").startsWith(prefix))
    .map((q) => {
      const pub = store.getPublished()[q.id];
      const dm = (q.date || "").match(/-(\d{2})[^\d]+(\d{2}:\d{2})/);
      return { key: q.id, id: q.id, day: dm ? +dm[1] : 0, time: dm ? dm[2] : "", t: q.t, ty: q.ty, pillar: "", cap: q.cap || "", status: pub ? "published" : "scheduled", permalink: pub?.permalink || null, readonly: true };
    })
    .sort((a, b) => a.day - b.day);
  return items.length ? { label: `${ARMONTHS[m - 1]} ${y}`, year: y, month: m, goal: "المجدول هذا الشهر (من قائمة النشر)", pillars: [], items, current: true } : null;
}
app.get("/api/plan", (req, res) => res.json({ ok: true, plans: store.getPlans(), current: currentMonthSchedule(req) }));

// Generate a fresh draft plan for the next month (or a given year/month).
app.post("/api/plan/generate", async (req, res) => {
  if (!generator.claudeReady()) return res.status(400).json({ ok: false, error: "add ANTHROPIC_API_KEY to enable generation" });
  const now = new Date();
  let { year, month } = req.body || {}; // month: 1-12
  if (!year || !month) { const nm = (now.getMonth() + 1) % 12; year = now.getFullYear() + (nm === 0 ? 1 : 0); month = nm + 1; }
  const label = `${ARMONTHS[month - 1]} ${year}`;
  // self-learning: feed last month's real engagement into the planner
  let perf = "";
  try { const pub = await cached("published", 120, () => meta.getPublished()); perf = live.perfSummary(pub || []); } catch (e) {}
  let out;
  try { out = await generator.generatePlan(label, year, month, "ar", perf); }
  catch (e) { console.error("[plan]", e.message); return res.status(500).json({ ok: false, error: e.message }); }
  if (!out) return res.status(502).json({ ok: false, error: "plan generation failed" });
  const items = (out.concepts || []).slice(0, 16).map((c, i) => {
    const day = Math.min(Math.max(parseInt(c.day, 10) || (2 + i * 2), 1), 28);
    return { key: `${year}-${month}-${i}`, day, time: i % 2 ? "20:30" : "20:00", t: String(c.t || ""), ty: String(c.ty || "منشور علامة"), pillar: String(c.pillar || ""), hook: String(c.hook || ""), cap: String(c.cap || ""), status: "draft", id: null };
  });
  const plan = store.setPlan({ label, year, month, goal: String(out.goal || ""), pillars: (out.pillars || []).map(String).slice(0, 6), items, generatedAt: new Date().toISOString() });
  res.json({ ok: true, plan });
});

// Save owner edits to the draft plan (titles, types, days, pillars).
app.put("/api/plan", (req, res) => {
  const p = (req.body || {}).plan;
  if (!p || !Array.isArray(p.items) || !p.year) return res.status(400).json({ ok: false, error: "plan.items + year/month required" });
  const cur = store.getPlan(`${p.year}-${String(p.month).padStart(2, "0")}`) || {};
  // keep applied ids/status authoritative from the server side
  const byKey = Object.fromEntries((cur.items || []).map((i) => [i.key, i]));
  p.items = p.items.map((i) => ({ ...i, status: byKey[i.key]?.status === "applied" ? "applied" : "draft", id: byKey[i.key]?.id || null }));
  res.json({ ok: true, plan: store.setPlan({ ...cur, ...p }) });
});

// 💡 Idea inbox: expand a raw owner idea into a draft plan row (first free day).
app.post("/api/plan/idea", async (req, res) => {
  const { text: raw, month } = req.body || {};
  const text = (raw || "").trim();
  if (!text) return res.status(400).json({ ok: false, error: "text required" });
  if (!generator.claudeReady()) return res.status(400).json({ ok: false, error: "add ANTHROPIC_API_KEY to enable generation" });
  const plan = store.getPlan(month);
  if (!plan) return res.status(400).json({ ok: false, error: "no plan yet — generate one first" });
  let c;
  try { c = await generator.expandIdea(text); }
  catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  if (!c) return res.status(502).json({ ok: false, error: "expansion failed" });
  const taken = new Set(plan.items.map((i) => +i.day));
  let day = 2; while (taken.has(day) && day < 28) day++;
  plan.items.push({ key: `idea-${Date.now()}`, day, time: "20:00", t: c.t, ty: c.ty, pillar: c.pillar, status: "draft", id: null, fromIdea: text.slice(0, 120) });
  store.setPlan(plan);
  res.json({ ok: true, plan });
});

// Apply ONE plan item → generate the full post (copy + design/reel) into the queue.
app.post("/api/plan/apply-item", async (req, res) => {
  const { key } = req.body || {};
  if (!generator.claudeReady()) return res.status(400).json({ ok: false, error: "add ANTHROPIC_API_KEY to enable generation" });
  const plans = store.getPlans();
  const plan = Object.values(plans).find((p) => (p.items || []).some((i) => i.key === key));
  const item = plan?.items?.find((i) => i.key === key);
  if (!item) return res.status(404).json({ ok: false, error: "plan item not found" });
  if (item.status === "applied" && item.id) return res.json({ ok: true, plan, post: null, already: true });
  const idNum = nextIdNum(baseState().queue);
  const date = `${plan.year}-${String(plan.month).padStart(2, "0")}-${String(item.day).padStart(2, "0")} · ${item.time || "20:00"}`;
  let post;
  try { post = await generator.generatePost({ idNum, date, pillar: item.pillar, prompt: `نفّذ فكرة الخطة: «${item.t}» — النوع المطلوب حصراً: ${item.ty}` }, "ar"); }
  catch (e) { console.error("[plan-apply]", e.message); return res.status(500).json({ ok: false, error: e.message }); }
  if (!post) return res.status(502).json({ ok: false, error: "generation failed" });
  post.ty = item.ty; // the plan's type is authoritative
  try {
    if ((post.ty || "").includes("ريل")) { const r = await renderAndSaveReel(post, post); post.mediaUrl = r.mediaUrl; }
    else { const d = await renderAndSaveDesign(post, post); post.mediaUrl = d.mediaUrl; if (d.images?.length) post.images = d.images; }
  } catch (e) { console.error("[plan-apply design]", e.message); }
  appendPost(post);
  item.status = "applied"; item.id = post.id;
  store.setPlan(plan);
  res.json({ ok: true, plan, post });
});

// Delete (hide) a post from the queue.
app.post("/api/delete-post", (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, error: "id required" });
  store.removePost(id);
  res.json({ ok: true, removed: store.getRemoved() });
});

// Merge a queue item with its owner-approved regeneration override. Publishing
// MUST see the same merged item the dashboard shows — otherwise a regenerated
// post would silently publish its OLD copy/design.
function applyOverride(q) {
  const o = store.getOverrides()[q.id]; if (!o) return q;
  return { ...q, t: o.t ?? q.t, t2: o.t2 ?? q.t2, cta: o.cta ?? q.cta, cap: o.cap ?? q.cap, brief: o.brief ?? q.brief, ty: o.ty ?? q.ty, mediaUrl: o.mediaUrl ?? q.mediaUrl, images: (o.images && o.images.length) ? o.images : q.images, regenerated: true, regens: o.regens };
}

// Full queue = seed (July) + Claude-generated content (Aug+), override-merged,
// with deleted posts EXCLUDED — a deleted post must never publish.
function fullQueue() {
  const q = [...baseState().queue];
  const c = loadContent();
  if (c?.queue?.length) q.push(...c.queue);
  const removed = new Set(store.getRemoved());
  return q.filter((x) => !removed.has(x.id)).map(applyOverride);
}

// Public base URL for building absolute media links Instagram can fetch.
const FALLBACK_BASE = "https://matjarlink-ops-production.up.railway.app";
function publicBase(req) { return process.env.PUBLIC_BASE || (req ? `${req.protocol}://${req.get("host")}` : FALLBACK_BASE); }

// TTL memo for expensive upstream pulls (Graph API etc). One in-flight promise
// per key; result reused for ttlSec so polling tabs don't multiply API calls.
const _memo = {};
function cached(key, ttlSec, fn) {
  const now = Date.now(), m = _memo[key];
  if (m && now - m.at < ttlSec * 1000) return m.p;
  const p = Promise.resolve().then(fn);
  _memo[key] = { at: now, p };
  p.catch(() => { if (_memo[key]?.p === p) delete _memo[key]; }); // don't cache failures
  return p;
}

// Resolve a queue item to publish input. Priority: explicit images[]/mediaUrl,
// else proxy the Drive design through our public /media/drive/<id> URL.
function resolveMedia(q, base) {
  const isReel = (q.ty || "").includes("ريل");
  const cap = q.cap || q.t || "";
  // Original professional Drive carousels win — unless the owner regenerated
  // the post (fresh generated slides then represent their explicit request).
  const genImgs = q.images?.length ? q.images.map((u) => (u.startsWith("/") ? `${base}${u}` : u)) : null;
  if (q.regenerated && genImgs) return { images: genImgs, caption: cap, kind: genImgs.length > 1 ? "carousel" : "image" };
  if (q.driveSlides?.length) return { images: q.driveSlides.map((id) => `${base}/media/drive/${id}`), caption: cap, kind: q.driveSlides.length > 1 ? "carousel" : "image" };
  if (genImgs) return { images: genImgs, caption: cap, kind: genImgs.length > 1 ? "carousel" : "image" };
  if (q.mediaUrl) { const url = q.mediaUrl.startsWith("/") ? `${base}${q.mediaUrl}` : q.mediaUrl; const isVideo = q.mediaUrl.includes(".mp4"); const isDesign = q.mediaUrl.includes("/media/design/"); return { mediaUrl: url, caption: cap, kind: (isReel && (isVideo || !isDesign)) ? "reel" : "image" }; }
  if (q.drive) return { mediaUrl: `${base}/media/drive/${q.drive}?type=${isReel ? "video" : "image"}`, caption: cap, kind: isReel ? "reel" : "image" };
  return null;
}

// ── Live design engine ── render + serve on-brand post images (Volume-backed) ──
function designsDir() { const v = process.env.RAILWAY_VOLUME_MOUNT_PATH || (fs.existsSync("/data") ? "/data" : ""); return v ? path.join(v, "designs") : path.join(__dirname, "data", "designs"); }
const arDigits = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
async function renderAndSaveDesign(item, content = {}) {
  const { renderDesign } = await import("./data/designEngine.js");
  const dir = designsDir(); fs.mkdirSync(dir, { recursive: true });
  const headline = content.t || item.t || "", kicker = content.kicker || "";
  const headline2 = content.t2 || item.t2 || "", cta = content.cta || item.cta || "";
  const ts = Date.now();
  const save = (name, buf) => { const fd = fs.openSync(path.join(dir, name + ".png"), "w"); try { fs.writeSync(fd, buf); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } };
  // Topical photo (Pexels) — used when the owner asks for one or CAIMO deems it fitting.
  const query = content.photo || content.photoQuery || item.photoQuery || "";
  let photo = null;
  if (query) {
    try { const { fetchPhoto } = await import("./data/stockPhoto.js"); photo = await fetchPhoto(query); }
    catch (e) { console.error("[pexels]", e.message); }
  }
  const slides = content.slides || item.slides || [];
  const isCarousel = (item.ty || "").includes("كاروسيل") && slides.length;
  if (isCarousel) {
    const n = slides.length;
    const bufs = [await renderDesign({ role: "cover", headline, headline2, cta, kicker, carousel: true, photo })]; // cover
    for (let i = 0; i < n; i++) {
      const s = slides[i], isLast = i === n - 1;
      // the final slide renders as the inverted brand "reveal" (like the originals)
      bufs.push(isLast
        ? await renderDesign({ role: "reveal", headline: s.t, body: s.body, headline2: s.t2 || "", cta: s.cta || "" })
        : await renderDesign({ role: "slide", headline: s.t, body: s.body, index: i + 1, carousel: true }));
    }
    const images = [];
    for (let i = 0; i < bufs.length; i++) { save(`${item.id}-${i}`, bufs[i]); images.push(`/media/design/${item.id}-${i}?v=${ts}`); }
    return { mediaUrl: images[0], images };
  }
  save(item.id, await renderDesign({ role: "single", headline, headline2, cta, kicker, photo }));
  return { mediaUrl: `/media/design/${item.id}?v=${ts}`, images: [] };
}

// Generate a REAL new reel video (1080x1920 MP4) from CAIMO's scenes.
async function renderAndSaveReel(item, content = {}) {
  const { renderReel } = await import("./data/reelEngine.js");
  const dir = designsDir(); fs.mkdirSync(dir, { recursive: true });
  let scenes = content.scenes || [];
  if (scenes.length < 2) {
    // fallback: derive hook → value → CTA from the regenerated copy
    scenes = [
      { kind: "hook", kicker: item.ty || "", headline: content.t || item.t || "" },
      { kind: "body", headline: "", body: (content.cap || item.cap || "").slice(0, 160) },
      { kind: "cta", headline: "قريبًا" }
    ];
  }
  const out = path.join(dir, `${item.id}.mp4`);
  await renderReel(scenes, out);
  return { mediaUrl: `/media/design/${item.id}.mp4?v=${Date.now()}`, images: [] };
}
app.get("/media/design/:id", (req, res) => {
  const id = (req.params.id || "").replace(/[^A-Za-z0-9._-]/g, "").replace(/\.\.+/g, ".");
  const isVideo = id.endsWith(".mp4");
  const f = path.join(designsDir(), isVideo ? id : id + ".png");
  if (!id || !fs.existsSync(f)) return res.status(404).send("no design");
  res.setHeader("Cache-Control", "public, max-age=60");
  if (!isVideo) {
    res.setHeader("Content-Type", "image/png");
    return fs.createReadStream(f).pipe(res);
  }
  // MP4 with HTTP Range support (required by Safari + Instagram's fetcher)
  const size = fs.statSync(f).size;
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Accept-Ranges", "bytes");
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
    if (isNaN(start) || start >= size) start = 0;
    if (isNaN(end) || end >= size) end = size - 1;
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    res.setHeader("Content-Length", end - start + 1);
    return fs.createReadStream(f, { start, end }).pipe(res);
  }
  res.setHeader("Content-Length", size);
  fs.createReadStream(f).pipe(res);
});

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

// ── Persistence audit (public, read-only) ── diagnose Volume durability ──
app.get("/api/debug", (req, res) => {
  let mounts = "";
  try { mounts = fs.readFileSync("/proc/mounts", "utf8").split("\n").filter((l) => /data|volume|mnt|store/i.test(l)).join("\n"); } catch (e) {}
  res.json({
    uptimeSec: Math.round(process.uptime()),
    railwayVolumeMountPath: process.env.RAILWAY_VOLUME_MOUNT_PATH || null,
    dataExists: fs.existsSync("/data"),
    designsDir: designsDir(),
    volumeMounts: mounts,
    store: store.debug()
  });
});

// ── Publish audit (public, read-only) ── verify each post published once ──
app.get("/api/pubcheck", async (req, res) => {
  const log = store.getPublished();
  const record = Object.fromEntries(Object.entries(log).map(([k, v]) => [k, { at: v.at, permalink: v.permalink || null }]));
  let ig = [];
  try { ig = await meta.getPublished(); } catch (e) { /* not connected */ }
  res.json({
    now: new Date().toISOString(),
    published: record,                       // our internal log (one entry per post id)
    instagramCount: ig.length,               // real posts on the account
    instagramRecent: ig.slice(0, 10).map((m) => ({ title: m.t, when: m.d, url: m.url }))
  });
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
  patch.appliedFrom = cur.sug || ""; // remember which suggestion this resolved
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
  if (publishingNow.has(id)) return res.status(409).json({ ok: false, error: "publish already in progress for this post" });
  publishingNow.add(id);
  try {
    const result = await metaPublish.publish(input);
    store.markPublished(id, result);
    res.json({ ok: true, result });
  } catch (e) {
    console.error("[publish]", e.message);
    res.status(500).json({ ok: false, error: e.message });
  } finally { publishingNow.delete(id); }
});

// ── Re-publish ── clear a post's published flag so it can publish again ──
app.post("/api/republish", (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, error: "id required" });
  store.unpublish(id);
  res.json({ ok: true, published: store.getPublished() });
});

// ── Auto-publish scheduler ── OFF by default (AUTO_PUBLISH=on to enable). ──
// When on: every minute, publishes APPROVED posts whose scheduled time has passed
// and that have public media, then records them so they never double-post.
const AUTO = () => (process.env.AUTO_PUBLISH || store.cfgGet("AUTO_PUBLISH")) === "on";
function parseWhen(date) { const m = (date || "").match(/(\d{4}-\d{2}-\d{2})[^\d]+(\d{2}):(\d{2})/); return m ? new Date(`${m[1]}T${m[2]}:${m[3]}:00+04:00`) : null; } // Oman time (GST)
const STALE_MS = 24 * 3600 * 1000; // don't auto-post backlog older than a day
// Per-post in-flight lock shared by the scheduler AND manual publish — closes
// the double-publish race (a slow reel upload spans multiple ticks/clicks).
const publishingNow = new Set();
let autoBusy = false; // serialize ticks: a slow publish (reel) can outlast the 60s
// interval, and an overlapping tick would double-post before the first marks it.
async function autoPublishTick() {
  if (autoBusy || !AUTO() || !metaPublish.publishReady()) return;
  autoBusy = true;
  try {
  const notes = store.getNotes();
  const now = Date.now();
  for (const q of fullQueue()) {
    if (store.isPublished(q.id)) continue;
    // Silence = approval: publish at the scheduled time UNLESS there's an unresolved
    // objection (a note left without approval). Explicit approval also passes.
    const nt = notes[q.id] || {};
    const approved = nt.status === "معتمد";
    const held = !approved && !!(nt.note && nt.note.trim());
    // AI-generated posts (plan / ➕) need EXPLICIT approval — silence=consent
    // applies only to content the owner has already seen (the seeded batch).
    if (q.gen && !approved) continue;
    const when = parseWhen(q.date);
    if (held || !when) continue;
    const dueAgo = now - when.getTime();
    if (dueAgo < 0 || dueAgo > STALE_MS) continue; // not due yet, or too stale (publish manually)
    const input = resolveMedia(q, publicBase());
    if (!input) continue; // needs media
    if (publishingNow.has(q.id)) continue; // a manual publish is already in flight
    publishingNow.add(q.id);
    try { const r = await metaPublish.publish(input); store.markPublished(q.id, r); console.log(`[auto-publish] ${q.id} → ${r.permalink || r.id}`); }
    catch (e) { console.error(`[auto-publish] ${q.id}: ${e.message}`); }
    finally { publishingNow.delete(q.id); }
    break; // at most one publish per tick — avoids simultaneous bursts
  }
  } finally { autoBusy = false; }
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
app.post("/webhook/whatsapp", (req, res) => {
  // Verify Meta's HMAC signature when META_APP_SECRET is configured — otherwise
  // anyone could POST forged "customer messages" into the inbox.
  const secret = process.env.META_APP_SECRET || "";
  if (secret) {
    const sig = req.get("x-hub-signature-256") || "";
    const expect = "sha256=" + crypto.createHmac("sha256", secret).update(req.rawBody || Buffer.alloc(0)).digest("hex");
    const ok = sig.length === expect.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect));
    if (!ok) return res.sendStatus(403);
  }
  wa.ingestWebhook(req.body); res.sendStatus(200);
});

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
