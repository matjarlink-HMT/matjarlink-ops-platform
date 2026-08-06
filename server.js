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
import * as charMod from "./data/characters.js";
import * as gemini from "./integrations/gemini.js";
import * as apify from "./integrations/apify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
// Never let one bad request/async rejection take the whole server down (Node
// exits on unhandledRejection/uncaughtException by default → Railway 502 loop).
process.on("unhandledRejection", (e) => console.error("[unhandledRejection]", (e && e.stack) || e));
process.on("uncaughtException", (e) => console.error("[uncaughtException]", (e && e.stack) || e));
app.use(express.json({ limit: "8mb", verify: (req, res, buf) => { req.rawBody = buf; } })); // 8mb: clothing-reference image uploads · rawBody: webhook HMAC verification
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
 try {
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
  // Never let a hanging external call (Meta/Windsor) stall /api/state — cap each
  // at 8s and fall back, so the dashboard always loads (a hang here 502'd it).
  const settle = (p, fb) => Promise.race([
    Promise.resolve(p).then((v) => v ?? fb).catch((e) => { console.error(e.message); return fb; }), // v ?? fb: a call that RESOLVES to undefined (e.g. Meta returns nothing) must still fall back, else `.length` throws
    new Promise((res) => setTimeout(() => res(fb), 8000)),
  ]);
  // Short-TTL cache: /api/state is polled every 60s per open tab, and getComments
  // alone is ~9 sequential Graph calls — uncached this exhausts IG rate limits.
  const [comments, igMsgs, published, insights] = await Promise.all([
    settle(cached("comments", 240, () => meta.getComments()), []), settle(cached("igmsgs", 240, () => meta.getMessages()), []),
    settle(cached("published", 120, () => meta.getPublished()), []), settle(cached("insights", 600, () => windsor.getInsights()), null)
  ]);
  const waMsgs = wa.getMessages() || [];
  if (comments?.length) state.comments = comments;
  const merged = [...(igMsgs || []), ...(waMsgs || [])];
  if (merged.length) state.messages = merged;
  if (published?.length) {
    const withInsights = await settle(enrichPublished(published), published);
    state.published = withInsights;
    state.topPosts = live.topPosts(withInsights, 5);
  }
  if (insights) state.insights = insights;
  // Ensure the Publish Verifier is always on the roster (added dynamically).
  if (!state.agents.some((a) => a.n === "Publish Verifier")) state.agents = [...state.agents, { ...live.PUBLISH_VERIFIER }];
  if (!state.agents.some((a) => a.n === "Video Editor")) state.agents = [...state.agents, { ...live.VIDEO_EDITOR }];
  // Merge approved agent self-improvements (raised level, updated task/eval/suggestion + changelog).
  const agState = store.getAgentState();
  state.agents = state.agents.map((a) => {
    const o = agState[a.n];
    if (!o) return a;
    return { ...a, task: o.task || a.task, ev: o.ev || a.ev, sug: o.sug || a.sug, sc: o.sc ?? a.sc, improved: true, improvements: o.improvements || 0, changelog: o.changelog || [] };
  });
  state.notes = store.getNotes();
  state.leads = store.getLeads();
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
 } catch (e) {
  console.error("[api/state]", (e && e.stack) || e);
  const where = String((e && e.stack) || e).split("\n").slice(0, 4).map((l) => l.trim()).join(" | ");
  try {
    const bs = baseState();
    res.json({ ...bs, agents: bs.agents || [], kpis: bs.kpis || [], queue: bs.queue || [], needs: bs.needs || [], accounts: bs.accounts || [], campaigns: bs.campaigns || [], comments: [], messages: [], mode: "mock", stateError: where });
  } catch (_) { res.status(200).json({ agents: [], kpis: [], queue: [], needs: [], accounts: [], campaigns: [], comments: [], messages: [] }); }
 }
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
  try { out = await generator.regeneratePost({ ...item, ...(store.getOverrides()[id] || {}) }, notes, lang || "ar", store.hookPrefLine()); }
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

// A/B hooks — propose 3 alternative titles for a post (owner picks one).
app.post("/api/alt-hooks", async (req, res) => {
  const { id } = req.body || {};
  if (!generator.claudeReady()) return res.status(400).json({ ok: false, error: "add ANTHROPIC_API_KEY to enable generation" });
  const item = fullQueue().find((q) => q.id === id);
  if (!item) return res.status(404).json({ ok: false, error: "post not found" });
  let hooks;
  try { hooks = await generator.altHooks(item, store.hookPrefLine()); }
  catch (e) { console.error("[alt-hooks]", e.message); return res.status(500).json({ ok: false, error: e.message }); }
  if (!hooks) return res.status(502).json({ ok: false, error: "generation failed" });
  res.json({ ok: true, hooks });
});

// Apply a chosen alternative title: sets the override title, re-renders the
// design (keeps reels as video), and records the pick to steer future writing.
app.post("/api/apply-hook", async (req, res) => {
  const { id, hook } = req.body || {};
  if (!id || !hook || !String(hook).trim()) return res.status(400).json({ ok: false, error: "id & hook required" });
  const item = fullQueue().find((q) => q.id === id);
  if (!item) return res.status(404).json({ ok: false, error: "post not found" });
  const merged = { ...item, t: String(hook).trim() };
  const isReel = (item.ty || "").includes("ريل");
  const hasPro = !!item.drive || (item.driveSlides && item.driveSlides.length); // professional July design
  const patch = { t: merged.t }; // ONLY the headline — never clobber the full caption (cap)
  try {
    // Only (re)render a generated design when there's no professional design to
    // preserve — a July post keeps its Drive artwork; we just update the copy.
    if (!isReel && !hasPro) { const d = await renderAndSaveDesign(merged, merged); patch.mediaUrl = d.mediaUrl; patch.images = d.images || []; }
  } catch (e) { console.error("[apply-hook design]", e.message); }
  store.addHookPref(merged.t); // learn the owner's taste
  const saved = store.setOverride(id, patch);
  res.json({ ok: true, override: saved, prefs: store.getHookPrefs().length });
});

// Restore a post to its original (clears the override — reverts title/design).
app.post("/api/restore-original", (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, error: "id required" });
  store.clearOverride(id);
  res.json({ ok: true });
});

// Generate a brand-new post from an optional free-form prompt.
app.post("/api/generate-post", async (req, res) => {
  const { prompt, date, lang } = req.body || {};
  if (!generator.claudeReady()) return res.status(400).json({ ok: false, error: "add ANTHROPIC_API_KEY to enable generation" });
  const idNum = nextIdNum(baseState().queue);
  const when = date || defaultNextSlot();
  let post;
  try { post = await generator.generatePost({ idNum, date: when, prompt: prompt || "", prefLine: store.hookPrefLine() }, lang || "ar"); }
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
  const notes = store.getNotes();
  const items = fullQueue()
    .filter((q) => (q.date || "").startsWith(prefix))
    .map((q) => {
      const pub = store.getPublished()[q.id];
      const nt = notes[q.id] || {};
      const dm = (q.date || "").match(/-(\d{2})[^\d]+(\d{2}:\d{2})/);
      const status = pub ? "published" : nt.status === "معتمد" ? "approved" : (nt.note || "").trim() ? "held" : "scheduled";
      return { key: q.id, id: q.id, day: dm ? +dm[1] : 0, time: dm ? dm[2] : "", t: q.t, ty: q.ty, pillar: "", cap: q.cap || "", brief: q.brief || "", drive: q.drive || null, status, permalink: pub?.permalink || null, readonly: true };
    })
    .sort((a, b) => a.day - b.day);
  return items.length ? { label: `${ARMONTHS[m - 1]} ${y}`, year: y, month: m, goal: "المجدول هذا الشهر (من قائمة النشر)", pillars: [], items, current: true } : null;
}
app.get("/api/plan", (req, res) => res.json({ ok: true, plans: store.getPlans(), current: currentMonthSchedule(req) }));

// Generate a fresh draft plan for the next month (or a given year/month).
// Titles already used (published or scheduled in the queue, plus every other
// month's plan) so the planner never re-proposes an idea that's already out.
function collectUsedTitles(excludeMonth) {
  const titles = new Set();
  try { for (const q of (baseState().queue || [])) if (q.t) titles.add(String(q.t).trim()); } catch (e) {}
  try { for (const [mk, pl] of Object.entries(store.getPlans() || {})) { if (mk === excludeMonth) continue; for (const it of (pl.items || [])) if (it.t) titles.add(String(it.t).trim()); } } catch (e) {}
  return [...titles].filter(Boolean);
}
app.post("/api/plan/generate", async (req, res) => {
  if (!generator.claudeReady()) return res.status(400).json({ ok: false, error: "add ANTHROPIC_API_KEY to enable generation" });
  const now = new Date();
  let { year, month } = req.body || {}; // month: 1-12
  if (!year || !month) { const nm = (now.getMonth() + 1) % 12; year = now.getFullYear() + (nm === 0 ? 1 : 0); month = nm + 1; }
  const label = `${ARMONTHS[month - 1]} ${year}`;
  // self-learning: feed last month's real engagement into the planner
  let perf = "";
  try { const pub = await enrichPublished(await cached("published", 120, () => meta.getPublished())); perf = live.perfSummary(pub || []); } catch (e) {}
  let out;
  const avoid = collectUsedTitles(`${year}-${String(month).padStart(2, "0")}`); // don't repeat published/scheduled ideas
  try { out = await generator.generatePlan(label, year, month, "ar", perf, avoid); }
  catch (e) { console.error("[plan]", e.message); return res.status(500).json({ ok: false, error: e.message }); }
  if (!out) return res.status(502).json({ ok: false, error: "plan generation failed" });
  // Re-sequence dates so they always start from the UPCOMING days (never the
  // past): tomorrow for the current month, day 1 for a future month — spaced
  // every 2 days and capped so items don't pile up at month end.
  const dim = new Date(year, month, 0).getDate();
  const mn = new Date(Date.now() + 4 * 3600 * 1000); // Muscat
  const isCur = year === mn.getUTCFullYear() && month === mn.getUTCMonth() + 1;
  const startDay = isCur ? Math.min(mn.getUTCDate() + 1, dim) : 1;
  const maxFit = Math.max(1, Math.floor((dim - startDay) / 2) + 1);
  // Fallback format rotation (biased to reels/carousels) when the model omits it.
  const FMT_ROT = ["ريل", "كاروسيل", "ريل", "منشور", "كاروسيل", "ريل", "كاروسيل", "منشور", "ريل", "كاروسيل", "ريل", "منشور"];
  const normFmt = (f) => { const s = String(f || ""); return s.includes("ريل") ? "ريل" : s.includes("كاروسيل") ? "كاروسيل" : s.includes("منشور") || s.includes("بوست") ? "منشور" : ""; };
  const items = (out.concepts || []).slice(0, Math.min(15, maxFit)).map((c, i) => {
    const day = Math.min(startDay + i * 2, dim);
    const format = normFmt(c.format) || FMT_ROT[i % FMT_ROT.length];
    return { key: `${year}-${month}-${i}`, day, time: i % 2 ? "20:30" : "20:00", t: String(c.t || ""), ty: String(c.ty || "توعية"), format, pillar: String(c.ty || c.pillar || ""), hook: String(c.hook || ""), desc: String(c.desc || ""), cta: String(c.cta || ""), points: Array.isArray(c.points) ? c.points.map(String).slice(0, 5) : [], cap: String(c.cap || ""), status: "draft", id: null };
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
  // Keep server-applied items authoritative; also allow the owner to LOCK an
  // already-done item (e.g. a post already published to Instagram) by sending
  // status:"applied" + designed:true — so the plan can reflect real history.
  p.items = p.items.map((i) => {
    const wasApplied = byKey[i.key]?.status === "applied";
    const ownerLock = i.status === "applied" && i.designed === true;
    return { ...i, status: wasApplied || ownerLock ? "applied" : "draft", id: byKey[i.key]?.id || i.id || null };
  });
  res.json({ ok: true, plan: store.setPlan({ ...cur, ...p }) });
});

// 🔧 Re-sequence an EXISTING plan's dates → start from the upcoming days only
// (tomorrow for the current month, day 1 for a future month), every 2 days;
// items that no longer fit the month are trimmed. Fixes plans generated before
// the date logic was corrected.
app.post("/api/plan/resequence", (req, res) => {
  const key = (req.body || {}).month;
  const plans = store.getPlans();
  const plan = key && plans[key];
  if (!plan) return res.status(404).json({ ok: false, error: "لا توجد خطة" });
  const dim = new Date(plan.year, plan.month, 0).getDate();
  const mn = new Date(Date.now() + 4 * 3600 * 1000);
  const isCur = plan.year === mn.getUTCFullYear() && plan.month === mn.getUTCMonth() + 1;
  const startDay = isCur ? Math.min(mn.getUTCDate() + 1, dim) : 1;
  const slots = []; for (let d = startDay; d <= dim; d += 2) slots.push(d);
  const kept = (plan.items || []).slice(0, slots.length).map((it, i) => ({ ...it, day: slots[i], time: i % 2 ? "20:30" : "20:00" }));
  const dropped = (plan.items || []).length - kept.length;
  plan.items = kept;
  store.setPlan(plan);
  res.json({ ok: true, plan, dropped });
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
  const dim = new Date(plan.year, plan.month, 0).getDate();
  let day = 2; while (taken.has(day) && day < dim) day++;
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

// Merge per-media Insights (reach/saved/shares) onto a FRESH published array.
// The insights map is cached by media id (900s); the published array itself is
// fresh (120s) — so a just-published post appears immediately (with its
// likes/comments) and gains reach/saved once its insights are fetched. This
// avoids the stale-snapshot bug of caching the whole merged array.
async function enrichPublished(published) {
  const byId = await (async () => {
    try {
      return await cached("mediaInsightsMap", 900, async () => {
        const capped = (published || []).slice(0, 8);
        const pairs = await Promise.all(capped.map((m) => meta.getMediaInsights(m.id).then((v) => [m.id, v]).catch(() => [m.id, null])));
        return Object.fromEntries(pairs);
      });
    } catch (e) { return {}; }
  })();
  return (published || []).map((m) => byId[m.id] ? { ...m, reach: byId[m.id].reach ?? null, saved: byId[m.id].saved ?? 0, shares: byId[m.id].shares ?? 0 } : m);
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
const DESIGN_TEMPLATES = ["classic", "luxe", "spotlight"];
// Brand-kit accent palette used to vary nightly template proposals (stays on-brand).
const ACCENTS = { orange: "#E8890F", magenta: "#9D1F60", plum: "#6E1444", gold: "#C8901F" };
const customTpl = (id) => store.getCustomTemplates().find((t) => t.id === id);
const isValidTemplate = (id) => DESIGN_TEMPLATES.includes(id) || Boolean(customTpl(id));
// Resolve a template id (builtin or custom) → { base, accent, character } the engine uses.
function resolveTemplate(id) {
  const c = customTpl(id);
  if (c) return { base: DESIGN_TEMPLATES.includes(c.base) ? c.base : "classic", accent: c.accent || ACCENTS.orange, character: c.character || "" };
  return { base: DESIGN_TEMPLATES.includes(id) ? id : "classic", accent: ACCENTS.orange, character: "" };
}
const activeTemplate = () => { const t = store.cfgGet("DESIGN_TEMPLATE"); return isValidTemplate(t) ? t : "classic"; };
// Resolve a character id to a file path: builtin (repo assets) or custom (Volume).
function charPathAny(id) {
  if (!id) return null;
  try { const p = charMod.characterPath(id); if (p) return p; } catch (e) {}
  const c = store.getCustomCharacters().find((x) => x.id === id);
  if (c) { const f = path.join(designsDir(), c.file); return fs.existsSync(f) ? f : null; }
  return null;
}
// Active brand character used as the hero photo when a design has no topical photo.
const activeCharacterPath = () => charPathAny(store.cfgGet("BRAND_CHARACTER"));
async function renderAndSaveDesign(item, content = {}, opts = {}) {
  const { renderDesign } = await import("./data/designEngine.js");
  const dir = designsDir(); fs.mkdirSync(dir, { recursive: true });
  const headline = content.t || item.t || "", kicker = content.kicker || "";
  const headline2 = content.t2 || item.t2 || "", cta = content.cta || item.cta || "";
  const tid = (opts.template && isValidTemplate(opts.template)) ? opts.template : activeTemplate();
  const tconf = resolveTemplate(tid);
  const template = tconf.base, accent = tconf.accent;
  const ts = Date.now();
  const save = (name, buf) => { const fd = fs.openSync(path.join(dir, name + ".png"), "w"); try { fs.writeSync(fd, buf); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } };
  // Topical photo (Pexels) — used when the owner asks for one or CAIMO deems it fitting.
  const query = content.photo || content.photoQuery || item.photoQuery || "";
  let photo = null;
  if (query) {
    try { const { fetchPhoto } = await import("./data/stockPhoto.js"); photo = await fetchPhoto(query); }
    catch (e) { console.error("[pexels]", e.message); }
  }
  // No explicit topical photo → use a brand character (authentic Omani person).
  // Priority: per-request (Studio) → the template's own character → globally adopted.
  if (!photo && opts.characterId) { const cp = charPathAny(opts.characterId); if (cp) photo = cp; }
  if (!photo && tconf.character) { const cp = charPathAny(tconf.character); if (cp) photo = cp; }
  if (!photo && !opts.noCharacter && activeCharacterPath()) photo = activeCharacterPath();
  const slides = content.slides || item.slides || [];
  const isCarousel = (item.ty || "").includes("كاروسيل") && slides.length;
  if (isCarousel) {
    const n = slides.length;
    const bufs = [await renderDesign({ role: "cover", headline, headline2, cta, kicker, carousel: true, photo, template, accent })]; // cover
    for (let i = 0; i < n; i++) {
      const s = slides[i], isLast = i === n - 1;
      // the final slide renders as the inverted brand "reveal" (like the originals)
      bufs.push(isLast
        ? await renderDesign({ role: "reveal", headline: s.t, body: s.body, headline2: s.t2 || "", cta: s.cta || "", accent })
        : await renderDesign({ role: "slide", headline: s.t, body: s.body, index: i + 1, carousel: true, template, accent }));
    }
    const images = [];
    for (let i = 0; i < bufs.length; i++) { save(`${item.id}-${i}`, bufs[i]); images.push(`/media/design/${item.id}-${i}?v=${ts}`); }
    return { mediaUrl: images[0], images };
  }
  save(item.id, await renderDesign({ role: "single", headline, headline2, cta, kicker, photo, template, accent }));
  return { mediaUrl: `/media/design/${item.id}?v=${ts}`, images: [] };
}

// ── Design templates ── list / select / sample-preview ──────────────────────
app.get("/api/templates", (req, res) => res.json({
  ok: true, templates: DESIGN_TEMPLATES, active: activeTemplate(),
  custom: store.getCustomTemplates().filter((t) => !store.isHidden("template", t.id)).map((t) => ({ id: t.id, name: t.name, base: t.base, accent: t.accent })),
}));
// Soft-delete (hide) an approved template or character; the editorial templates
// 6/7 (house style) and the base builtins cannot be hidden.
app.post("/api/design/delete", (req, res) => {
  const { kind, id } = req.body || {};
  if (!["template", "character"].includes(kind) || !id) return res.status(400).json({ ok: false, error: "bad request" });
  if (kind === "template" && (isEditorial(id) || DESIGN_TEMPLATES.includes(id))) return res.status(400).json({ ok: false, error: "لا يمكن حذف القوالب الأساسية" });
  store.hideItem(kind, id);
  if (kind === "template") store.removeCustomTemplate(id); else store.removeCustomCharacter(id);
  res.json({ ok: true });
});
// Brand data (business info inserted into designs).
app.get("/api/branddata", (req, res) => res.json({ ok: true, data: store.getBrandData() }));
app.post("/api/branddata", (req, res) => {
  const b = req.body || {}; const map = {};
  if ("instagram" in b) map.BIZ_IG = String(b.instagram || "").replace(/^@/, "").trim();
  if ("phone" in b) map.BIZ_PHONE = String(b.phone || "").trim();
  if ("email" in b) map.BIZ_EMAIL = String(b.email || "").trim();
  if ("website" in b) map.BIZ_WEB = String(b.website || "").trim();
  if ("whatsapp" in b) map.BIZ_WA = String(b.whatsapp || "").trim();
  store.cfgSet(map);
  res.json({ ok: true, data: store.getBrandData() });
});
app.post("/api/templates/set", (req, res) => {
  const t = (req.body || {}).template;
  if (!isValidTemplate(t)) return res.status(400).json({ ok: false, error: "unknown template" });
  store.cfgSet({ DESIGN_TEMPLATE: t });
  res.json({ ok: true, active: t });
});
// Sample preview for any template id (builtin or custom), rendered once + cached.
app.get("/media/template/:tpl/:kind", async (req, res) => {
  const tid = isValidTemplate(req.params.tpl) ? req.params.tpl : "classic";
  const tconf = resolveTemplate(tid);
  const kind = req.params.kind === "slide" ? "slide" : "cover";
  const dir = designsDir(); fs.mkdirSync(dir, { recursive: true });
  const charSuffix = tconf.base === "spotlight" ? `-${(tconf.character || store.cfgGet("BRAND_CHARACTER")) || "stock"}` : "";
  const f = path.join(dir, `_sample-${tid}${charSuffix}-${kind}.png`);
  try {
    if (!fs.existsSync(f)) {
      const { renderDesign } = await import("./data/designEngine.js");
      let photo = null;
      const cp = tconf.character ? charPathAny(tconf.character) : activeCharacterPath();
      if (tconf.base === "spotlight") {
        if (cp) photo = cp;
        else { try { const { fetchPhoto } = await import("./data/stockPhoto.js"); photo = await fetchPhoto("omani merchant store"); } catch (e) {} }
      } else if (cp) photo = cp;
      const buf = kind === "cover"
        ? await renderDesign({ role: "cover", headline: "٥ أخطاء", headline2: "تقتل مبيعاتك", cta: "احفظها قبل لا تبدأ", kicker: "قبل ما تفتح متجرك", carousel: true, template: tconf.base, accent: tconf.accent, photo })
        : await renderDesign({ role: "slide", headline: "يبدأ بدون خطة للشحن", body: "العميل يشتري.. وبعدها تبدأ الفوضى: مين يوصل؟ بكم؟ متى؟", index: 1, carousel: true, template: tconf.base, accent: tconf.accent });
      const fd = fs.openSync(f, "w"); try { fs.writeSync(fd, buf); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    }
    res.setHeader("Content-Type", "image/png"); res.setHeader("Cache-Control", "public, max-age=300");
    fs.createReadStream(f).pipe(res);
  } catch (e) { console.error("[template-sample]", e.message); res.status(500).send("sample failed"); }
});

// ── Brand characters ── authentic Omani people (builtin + nightly-approved) ──
const allCharacters = () => [...charMod.CHARACTERS, ...store.getCustomCharacters()].filter((c) => !store.isHidden("character", c.id));
app.get("/api/characters", (req, res) => res.json({
  ok: true,
  active: store.cfgGet("BRAND_CHARACTER") || "",
  characters: allCharacters().map((c) => ({ id: c.id, label: c.label, dress: c.dress, thumb: `/media/character/${c.id}`, sample: `/media/template/spotlight/cover` })),
}));
app.post("/api/characters/set", (req, res) => {
  const id = ((req.body || {}).character || "").trim();
  if (id && !allCharacters().find((c) => c.id === id)) return res.status(400).json({ ok: false, error: "unknown character" });
  store.cfgSet({ BRAND_CHARACTER: id }); // "" clears → spotlight falls back to stock photo
  res.json({ ok: true, active: id });
});
// Generate a NEW brand character (realistic face portrait) and add it to the
// roster — so designs vary between an Omani man, an Omani woman, and an Arab
// person instead of repeating one face. Realistic, non-artificial features.
const CHARACTER_PROMPTS = {
  "omani-woman": { label: "تاجرة عُمانية", dress: "سيدة عُمانية بعباية وحجاب أسود (تاجرة/بائعة)", prompt: "Photorealistic vertical portrait of an authentic Omani WOMAN shop owner in a modern boutique, wearing a plain elegant black abaya and a black hijab head covering (solid black, no patterns, face fully visible, NOT niqab). Warm natural editorial light, real skin texture with pores and natural human features — shot on a real camera, NOT AI, NOT plastic or airbrushed. Chest-up, clean empty space top and bottom. Muscat, Oman. No text, no logo." },
  "arab-man": { label: "موظف عربي (مصري)", dress: "شاب عربي (مصري) بقميص كاجوال أنيق (ليس زياً خليجياً)", prompt: "Photorealistic vertical portrait of a friendly young ARAB (Egyptian) man employee in a modern office, wearing a smart casual buttoned shirt (NOT Gulf dishdasha/ghutra). Warm editorial light, real skin texture with pores and natural human features — shot on a real camera, NOT AI, NOT plastic or airbrushed. Chest-up, clean empty space top and bottom. No text, no logo." },
  "omani-man": { label: "تاجر عُماني", dress: "تاجر عُماني بالكمة/المصر ودشداشة بيضاء", prompt: "Photorealistic vertical portrait of an authentic Omani MAN merchant in a modern shop, wearing a white Omani dishdasha and an embroidered Omani kummah cap (NOT a Gulf ghutra/egal). Warm editorial light, real skin texture with pores and natural human features — shot on a real camera, NOT AI, NOT plastic or airbrushed. Chest-up, clean empty space top and bottom. Muscat, Oman. No text, no logo." },
};
app.post("/api/characters/generate", async (req, res) => {
  if (!gemini.geminiReady()) return res.status(400).json({ ok: false, error: "يحتاج ربط Gemini أولاً" });
  const { kind, label } = req.body || {};
  const spec = CHARACTER_PROMPTS[kind] || CHARACTER_PROMPTS["omani-woman"];
  try {
    const { buffer } = await gemini.generateImage(spec.prompt);
    const dir = designsDir(); fs.mkdirSync(dir, { recursive: true });
    const id = "char-" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    const file = `_char-${id}.png`;
    const fd = fs.openSync(path.join(dir, file), "w"); try { fs.writeSync(fd, buffer); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    const item = store.addCustomCharacter({ id, label: (label && label.trim()) || spec.label, dress: spec.dress, file, gen: true });
    res.json({ ok: true, item: { id, label: (label && label.trim()) || spec.label, thumb: `/media/character/${id}?v=${Date.now()}` } });
  } catch (e) { console.error("[char/gen]", e.message); res.status(500).json({ ok: false, error: e.message }); }
});
// Public thumbnail of a character asset (auth-exempt like other /media routes).
app.get("/media/character/:id", (req, res) => {
  const p = charPathAny(req.params.id);
  if (!p) return res.status(404).send("no character");
  res.setHeader("Content-Type", "image/png"); res.setHeader("Cache-Control", "public, max-age=86400");
  fs.createReadStream(p).pipe(res);
});

// ── Clothing references ── upload Omani garments (massar/kummah/abaya…) that
// condition the nightly character generation so heroes wear the real dress.
const CLOTHING_TYPES = ["massar", "kummah", "dishdasha", "furakha", "abaya", "hijab"];
app.get("/api/clothing", (req, res) => res.json({ ok: true, clothing: store.getClothing().map((c) => ({ id: c.id, type: c.type, label: c.label, thumb: `/media/clothing/${c.id}` })) }));
app.post("/api/clothing", (req, res) => {
  const { type, label, dataUrl } = req.body || {};
  if (!dataUrl || !/^data:image\//.test(dataUrl)) return res.status(400).json({ ok: false, error: "image required" });
  const b64 = dataUrl.split(",")[1] || "";
  const buf = Buffer.from(b64, "base64");
  if (!buf.length || buf.length > 8 * 1024 * 1024) return res.status(400).json({ ok: false, error: "bad image size" });
  const dir = designsDir(); fs.mkdirSync(dir, { recursive: true });
  const id = "cl-" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  const file = `_cloth-${id}.png`;
  const fd = fs.openSync(path.join(dir, file), "w"); try { fs.writeSync(fd, buf); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const item = store.addClothing({ id, type: CLOTHING_TYPES.includes(type) ? type : "", label, file });
  res.json({ ok: true, item: { id: item.id, type: item.type, label: item.label, thumb: `/media/clothing/${item.id}` } });
});
// Generate a NEW garment (product shot, no person/face) into the wardrobe so the
// owner has fresh, varied clothing to dress designs with — without hunting for a
// photo to upload. Each garment is an on-brand Omani/neutral piece.
const GARMENT_PROMPTS = {
  dishdasha: "A single pristine white Omani men's dishdasha (thobe) with the traditional furakha tassel at the collar, neatly displayed flat, professional catalog product photography, sharp realistic fabric detail and texture, plain soft neutral studio background. NO person, NO face, NO mannequin, no text, no logo.",
  kummah: "A single finely embroidered Omani men's kummah cap (traditional Omani embroidered cap — NOT a Gulf ghutra/egal), professional catalog product photography, sharp realistic embroidery detail, plain soft neutral studio background. NO person, NO face, no text.",
  massar: "A single Omani massar (finely wrapped Kashmiri-paisley wool turban — NOT a Gulf ghutra/egal), presented neatly, professional catalog product photography, realistic fabric detail, plain soft neutral studio background. NO person, NO face, no text.",
  furakha: "A white Omani dishdasha collar showing the furakha tassel detail clearly, professional catalog product photography, realistic thread and fabric detail, plain soft neutral studio background. NO person, NO face, no text.",
  abaya: "A single elegant plain BLACK women's abaya (solid black, no colourful patterns), elegantly displayed, professional fashion catalog product photography, sharp realistic fabric detail, plain soft neutral studio background. NO person, NO face, NO mannequin head, no text.",
  hijab: "A single plain BLACK women's hijab head-scarf (solid black, no patterns), neatly displayed folded, professional catalog product photography, realistic fabric detail, plain soft neutral studio background. NO person, NO face, no text.",
};
app.post("/api/clothing/generate", async (req, res) => {
  if (!gemini.geminiReady()) return res.status(400).json({ ok: false, error: "يحتاج ربط Gemini أولاً" });
  const { type, label } = req.body || {};
  const ty = CLOTHING_TYPES.includes(type) ? type : "dishdasha";
  try {
    const { buffer } = await gemini.generateImage(GARMENT_PROMPTS[ty] || GARMENT_PROMPTS.dishdasha);
    const dir = designsDir(); fs.mkdirSync(dir, { recursive: true });
    const id = "cl-" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    const file = `_cloth-${id}.png`;
    const fd = fs.openSync(path.join(dir, file), "w"); try { fs.writeSync(fd, buffer); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    const item = store.addClothing({ id, type: ty, label: (label && label.trim()) || "", file, gen: true });
    res.json({ ok: true, item: { id: item.id, type: item.type, label: item.label, thumb: `/media/clothing/${item.id}?v=${Date.now()}` } });
  } catch (e) { console.error("[clothing/gen]", e.message); res.status(500).json({ ok: false, error: e.message }); }
});
app.delete("/api/clothing/:id", (req, res) => {
  const c = store.getClothing().find((x) => x.id === req.params.id);
  if (c) { try { fs.unlinkSync(path.join(designsDir(), c.file)); } catch (e) {} store.removeClothing(c.id); }
  res.json({ ok: true });
});
app.get("/media/clothing/:id", (req, res) => {
  const c = store.getClothing().find((x) => x.id === req.params.id);
  if (!c) return res.status(404).send("no clothing");
  const f = path.join(designsDir(), c.file);
  if (!fs.existsSync(f)) return res.status(404).send("no file");
  res.setHeader("Content-Type", "image/png"); res.setHeader("Cache-Control", "public, max-age=86400");
  fs.createReadStream(f).pipe(res);
});
// The wardrobe (خزانة الملابس): owner-uploaded Omani garments drawn into EVERY
// design that features an Omani person, so characters always wear the real dress.
// Returns inline base64 refs + a prompt clause instructing exact-match dress.
// Skips non-person scenes (device/card/shop) and the Egyptian (non-Omani dress).
const isPersonText = (t) => /\bman\b|woman|person|owner|employee|merchant|shopkeeper|portrait|dishdasha|kummah|massar|abaya|hijab|رجل|امرأة|سيدة|تاجر|تاجرة|بائع|موظف|شخص/i.test(String(t || ""));
const isWomanText = (t) => /woman|abaya|hijab|سيدة|تاجرة|امرأة|بائعة|ابدئي/i.test(String(t || ""));
const isEgyptianText = (t) => /Egyptian|مصري|buttoned shirt/i.test(String(t || ""));
const hashInt = (s) => { let h = 0; s = String(s || ""); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
// One shared persona decision so the PROMPT, the FACE reference and the GARMENT
// all agree on who appears — and so GENERIC person scenes rotate (man ⇄ woman)
// by a stable topic hash for variety, instead of always the same man.
function personaFor(text) {
  const t = String(text || "");
  if (isEgyptianText(t)) return { woman: false, egyptian: true };
  if (isWomanText(t)) return { woman: true, egyptian: false };
  if (/\bman\b|رجل|شاب|أبو|صاحب/i.test(t)) return { woman: false, egyptian: false };
  return { woman: hashInt(t) % 3 === 0, egyptian: false }; // generic → ~1/3 woman for variety
}
// GARMENTS ONLY from the wardrobe: take just the clothing from the reference image,
// never its face/person. Owner uploads a garment and its type; we use that type.
function clothingRefsFor(text) {
  const list = store.getClothing(); if (!list.length) return { refs: [], note: "" };
  const t = String(text || "");
  if (isEgyptianText(t) || !isPersonText(t)) return { refs: [], note: "" };
  const { woman: isWoman } = personaFor(t);
  const want = isWoman ? ["abaya", "hijab"] : ["massar", "kummah", "dishdasha", "furakha"];
  let picks = list.filter((c) => want.includes(c.type));
  if (!picks.length) picks = list;
  // rotate which garment(s) are used (by topic hash) so outfits vary between designs
  if (picks.length > 2) { const off = hashInt(t) % picks.length; picks = [...picks.slice(off), ...picks.slice(0, off)]; }
  picks = picks.slice(0, 2);
  const refs = [];
  for (const c of picks) { try { refs.push({ data: fs.readFileSync(path.join(designsDir(), c.file)).toString("base64"), mime: "image/png" }); } catch (e) {} }
  const note = refs.length ? " GARMENT REFERENCE: the person must wear EXACTLY the Omani garment shown in the attached garment image(s) — copy ONLY the clothing (its fabric, colour, pattern and how it is worn). Do NOT copy the face or the person from the garment image; that image is for the clothing only." : "";
  return { refs, note };
}
// FACE/FEATURES from the characters list: pick an approved character matching the
// gender and use its portrait so the generated person looks like a chosen character.
function characterFaceRef(text) {
  const t = String(text || "");
  if (!isPersonText(t)) return { refs: [], note: "" };
  const { woman, egyptian } = personaFor(t);
  const chars = allCharacters();
  const isWomanChar = (c) => /امرأة|سيدة|تاجرة|woman|عباية|abaya|حجاب|hijab/i.test(`${c.label} ${c.dress || ""}`);
  const isArabChar = (c) => /مصري|عربي|arab|egyptian/i.test(`${c.label} ${c.dress || ""}`);
  // Match the face pool to the chosen persona (Arab / woman / Omani man). No
  // matching face → return empty so the person is generated fresh from the prompt.
  const pool = egyptian ? chars.filter(isArabChar)
    : woman ? chars.filter((c) => isWomanChar(c) && !isArabChar(c))
      : chars.filter((c) => !isWomanChar(c) && !isArabChar(c));
  if (!pool.length) return { refs: [], note: "" };
  // rotate the face by a stable topic hash so people VARY between designs
  const pick = pool[hashInt(t) % pool.length];
  if (!pick) return { refs: [], note: "" };
  const p = charPathAny(pick.id);
  if (!p) return { refs: [], note: "" };
  try { return { refs: [{ data: fs.readFileSync(p).toString("base64"), mime: "image/png" }], note: " FACE REFERENCE: the person's FACE and features (face shape, skin tone, features) must match the attached reference person image — same person's face." }; }
  catch (e) { return { refs: [], note: "" }; }
}
// Combined hero references for a design: character FACE (from the characters list)
// + wardrobe GARMENT (from the clothing list). Empty for non-person scenes.
function heroRefs(text) {
  if (!isPersonText(text)) return { refs: [], note: "" };
  const face = characterFaceRef(text), garment = clothingRefsFor(text);
  const refs = [...(face.refs || []), ...(garment.refs || [])];
  const hasFace = (face.refs || []).length, hasGarment = (garment.refs || []).length;
  let note = "";
  if (hasFace && hasGarment) {
    // Face + base outfit from the character portrait; the specific piece from the
    // wardrobe garment. Nothing is invented.
    note = " CRITICAL: recreate the person's FACE and their overall outfit from the FIRST reference image, then dress them in the exact Omani garment shown in the SUBSEQUENT garment reference image(s) — the clothing must come ONLY from these references. Do NOT invent, add or change any clothing.";
  } else if (hasFace) {
    // No wardrobe garment chosen → use the character's OWN outfit from its portrait,
    // so the clothing is never invented (matches the selected character exactly).
    note = " CRITICAL: recreate the SAME person as the reference image — the EXACT same face AND the EXACT same clothing/outfit shown in the reference. Do NOT invent, change or add any clothing; the dress must match the reference person exactly.";
  } else if (hasGarment) {
    note = " CRITICAL: the person MUST wear EXACTLY the Omani garment shown in the reference image(s) — copy only the clothing. Do NOT invent different clothing.";
  }
  return { refs, note };
}
// Turn the owner's idea DESCRIPTION into VISUAL-only scene guidance so the
// background is coherent with the headline. Strips quoted phrases + digits so no
// text/number leaks into the render (the description briefs the design, it is
// NEVER drawn as text). Returns "" when there's nothing usable.
function sceneGuidance(desc) {
  let s = String(desc || "")
    .replace(/[«»“”"'‘’‹›].*?[«»“”"'‘’‹›]/g, " ")   // drop anything quoted (likely intended text)
    .replace(/[0-9٠-٩٪%]+/g, " ")            // drop digits/percent
    .replace(/\s+/g, " ").trim();
  if (s.length < 6) return "";
  return ` The BACKGROUND scene must visually match this idea: «${s.slice(0, 220)}». It is a background only — render absolutely NO text, words, letters, numbers or logos.`;
}

// ── Nightly invention ── 01:00–05:00 Asia/Muscat: propose new brand-kit templates
// (server-side variations) + new authentic-Omani characters (Gemini), for approval.
const TPL_BASE_NAME = { classic: "الأبيض", luxe: "الفخم", spotlight: "الحضور" };
const ACCENT_NAME = { orange: "برتقالي", magenta: "أرجواني", plum: "خمري", gold: "ذهبي" };
// Approved dress rules: Omani man = white dishdasha + furakha + kummah/massar (NOT
// ghutra/egal); Omani woman = plain BLACK abaya + BLACK hijab (face visible, NOT
// niqab, no colourful patterns); occasional Arab (Egyptian) man = shirt + trousers.
const NIGHTLY_CHAR_PROMPTS = [
  { label: "تاجرة عُمانية · أزياء", text: "Photorealistic vertical portrait of an authentic Omani woman shop owner in a modern fashion boutique, wearing a plain elegant BLACK abaya and a BLACK hijab head covering (solid black, no colourful patterns, face fully visible, NOT niqab), holding a tablet. Warm natural light, premium editorial photography, real skin texture, clean empty space top and bottom for text. Muscat, Oman." },
  { label: "تاجر عُماني · مقهى مختص", text: "Photorealistic vertical portrait of an authentic Omani man owner in a specialty coffee shop, wearing a white Omani dishdasha with the furakha tassel and an embroidered Omani kummah cap (NOT a Gulf ghutra or egal). Warm light, real photography, space for text. Muscat, Oman." },
  { label: "تاجر عُماني · تمور وحلوى", text: "Photorealistic vertical portrait of an authentic Omani man selling dates and Omani halwa in a traditional shop, wearing a white Omani dishdasha and an Omani massar (wrapped Kashmiri-paisley turban, NOT a Gulf ghutra/egal). Warm light, editorial photography, space for text. Oman." },
  { label: "تاجرة عُمانية · عطور", text: "Photorealistic vertical portrait of an authentic Omani woman perfumer in an Omani perfume and bukhoor shop, wearing a plain elegant BLACK abaya and a BLACK hijab (solid black, no patterns, face visible, NOT niqab), holding a bottle of Omani perfume. Warm light, premium photography, space for text. Muscat, Oman." },
  { label: "موظف عربي (مصري) · دعم", text: "Photorealistic vertical portrait of an Arab (Egyptian) man customer-support employee in a modern office, wearing a smart casual buttoned shirt and trousers (NOT Gulf dress), friendly, holding a headset. Warm light, editorial photography, space for text." },
  { label: "تاجر عُماني · إلكترونيات", text: "Photorealistic vertical portrait of a young authentic Omani man in a modern electronics and phone shop, wearing a white Omani dishdasha and Omani kummah, holding a smartphone. Warm light, real photography, space for text. Muscat, Oman. Authentic Omani, not Gulf ghutra/egal." },
];
let nightlyBusy = false, charPromptCursor = 0;
async function makeTemplateProposal({ base, accent, accentName }) {
  const { renderDesign } = await import("./data/designEngine.js");
  const dir = designsDir(); fs.mkdirSync(dir, { recursive: true });
  const id = "tpl-" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  const cp = activeCharacterPath() || charPathAny(charMod.CHARACTERS[0]?.id);
  const buf = await renderDesign({ role: "cover", kicker: "متجرلينك", headline: "تجارتك كلها", headline2: "في مكان واحد", cta: "قريبًا في عُمان", carousel: true, template: base, accent, photo: cp });
  const name = `_prop-${id}`; // /media/design/:id appends .png, so the URL omits it
  const fd = fs.openSync(path.join(dir, name + ".png"), "w"); try { fs.writeSync(fd, buf); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  store.saveProposal({ id, kind: "template", base, accent, name: `${TPL_BASE_NAME[base]} · ${ACCENT_NAME[accentName]}`, previewUrl: `/media/design/${name}?v=${Date.now()}` });
}
async function makeCharacterProposal() {
  const p = NIGHTLY_CHAR_PROMPTS[charPromptCursor % NIGHTLY_CHAR_PROMPTS.length]; charPromptCursor++;
  const dir = designsDir(); fs.mkdirSync(dir, { recursive: true });
  const id = "char-" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  const { refs, note } = clothingRefsFor(p.text);   // owner-uploaded garments condition the dress
  const { buffer } = await gemini.generateImage(p.text + note, refs);
  const name = `_propchar-${id}`, file = `${name}.png`; // file (with .png) is what charPathAny reads
  const fd = fs.openSync(path.join(dir, file), "w"); try { fs.writeSync(fd, buffer); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  store.saveProposal({ id, kind: "character", label: p.label, dress: p.label, prompt: p.text, file, previewUrl: `/media/design/${name}?v=${Date.now()}` });
}
// Ready editorial POSTS the owner wakes up to (adopted templates 6/7), alternating
// dark/white, with a content-matched hero/place chosen from the headline.
const NIGHTLY_POSTS = [
  { headline: "تجارتك كلها في مكان واحد", pop: "بدون تعقيد", cta: "قريبًا في عُمان" },
  { headline: "نقطة بيع ذكية", pop: "بلمسة واحدة", cta: "قريبًا في عُمان" },
  { headline: "مدفوعاتك ومحاسبتك", pop: "تلقائياً", cta: "سجّل اهتمامك" },
  { headline: "بِع في كل الأسواق", pop: "من نظام واحد", cta: "سجّل اهتمامك" },
  { headline: "متجرك مفتوح دائماً", pop: "٢٤ ساعة", cta: "قريبًا في عُمان" },
  { headline: "متجرك الإلكتروني", pop: "بدقائق", cta: "قريبًا في عُمان" },
  { headline: "وصّل لكل عُمان", pop: "بسهولة", cta: "قريبًا في عُمان" },
  { headline: "حساباتك تتحسب تلقائياً", pop: "وأنت مرتاح", cta: "سجّل اهتمامك" },
  { headline: "كل تجارتك بجيبك", pop: "أينما كنت", cta: "سجّل اهتمامك" },
  { headline: "ابدئي تجارتك بثقة", pop: "احنا معك", cta: "قريبًا في عُمان" },
];
let nightlyPostCursor = 0;
async function makeEditorialPostProposal() {
  const c = NIGHTLY_POSTS[nightlyPostCursor % NIGHTLY_POSTS.length]; nightlyPostCursor++;
  const light = nightlyPostCursor % 2 === 0;              // alternate white (7) / dark (6)
  const template = light ? "editorial-white" : "editorial-dark";
  const id = "post-" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  const sc = editorialScene(c.headline, light);
  const ed = await makeEditorial({ light, layout: sc.layout, kicker: "متجرلينك", headline: c.headline, pop: c.pop, cta: c.cta, prompt: sc.prompt, id });
  store.saveProposal({ id, kind: "post", template, t: c.headline, t2: c.pop, cta: c.cta, name: c.headline, previewUrl: ed.url });
}
async function generateNightlyBatch(n = { post: 4, char: 2 }) {
  if (nightlyBusy) return { skipped: "busy" };
  nightlyBusy = true;
  const out = { posts: 0, characters: 0, errors: [] };
  try {
    if (!gemini.geminiReady()) { out.errors.push("gemini key not set"); return out; }
    for (let i = 0; i < n.post; i++) { try { await makeEditorialPostProposal(); out.posts++; } catch (e) { out.errors.push("post:" + e.message); } }
    for (let i = 0; i < n.char; i++) { try { await makeCharacterProposal(); out.characters++; } catch (e) { out.errors.push("char:" + e.message); } }
  } finally { nightlyBusy = false; }
  return out;
}
function muscatDateHour() { const m = new Date(Date.now() + 4 * 3600 * 1000); return { date: m.toISOString().slice(0, 10), hour: m.getUTCHours() }; }
async function nightlyTick() {
  const { date, hour } = muscatDateHour();
  if (hour < 1 || hour >= 5) return;
  if (store.nightlyRanOn() === date) return;
  store.markNightlyRan(date); // set before running → once per night even across restarts
  console.log(`[nightly] ${date} inventing characters (designs come from the approved plan)`);
  // Random editorial POSTS are no longer auto-generated — designs come exclusively
  // from the owner-approved content plan. Nightly keeps inventing characters only.
  try { const r = await generateNightlyBatch({ post: 0, char: 2 }); console.log("[nightly] done", r); } catch (e) { console.error("[nightly]", e.message); }
}
setInterval(nightlyTick, 15 * 60 * 1000);
nightlyTick();

// ── Daily market research ── scrape relevant IG accounts via Apify, distill the
// trends (top hashtags + best-performing captions) for the content plan. ~06:00 Muscat.
async function runResearch() {
  const accounts = store.getResearch().accounts || [];
  if (!apify.apifyReady()) throw new Error("Apify غير مربوط — أضف APIFY_TOKEN من الإعدادات");
  if (!accounts.length) throw new Error("أضِف حسابات مستهدفة أولاً");
  const items = await apify.scrapeAccounts(accounts, 6);
  const tags = {}, caps = [];
  for (const p of items) {
    (p.hashtags || []).forEach((h) => { const t = String(h).replace(/^#/, ""); if (t) tags[t] = (tags[t] || 0) + 1; });
    const first = String(p.caption || "").split("\n").find((l) => l.trim());
    if (first) caps.push({ text: first.slice(0, 140), likes: p.likesCount || 0, comments: p.commentsCount || 0, acc: p.ownerUsername || "" });
  }
  const topTags = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([tag, n]) => ({ tag, n }));
  const insights = caps.sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments)).slice(0, 10);
  const { date } = muscatDateHour();
  return store.saveResearch({ topTags, insights, lastRun: date, count: items.length });
}
let researchBusy = false;
async function researchTick() {
  const { date, hour } = muscatDateHour();
  if (hour < 5 || hour >= 9) return;
  if (store.researchRanOn() === date) return;
  if (!apify.apifyReady() || !(store.getResearch().accounts || []).length) return;
  store.saveResearch({ lastRun: date }); // guard: once per day even across restarts
  console.log(`[research] ${date} scanning ${store.getResearch().accounts.length} accounts`);
  try { await runResearch(); console.log("[research] done"); } catch (e) { console.error("[research]", e.message); }
}
setInterval(researchTick, 30 * 60 * 1000);
researchTick();
app.get("/api/research", (req, res) => { const r = store.getResearch(); res.json({ ok: true, ...r, apifyReady: apify.apifyReady() }); });
app.post("/api/research/accounts", (req, res) => {
  const list = Array.isArray((req.body || {}).accounts) ? req.body.accounts : String((req.body || {}).accounts || "").split(/[\n,،]/);
  res.json({ ok: true, ...store.setResearchAccounts(list) });
});
app.post("/api/research/run", async (req, res) => {
  if (researchBusy) return res.json({ ok: false, error: "قيد التشغيل" });
  researchBusy = true;
  try { const r = await runResearch(); res.json({ ok: true, ...r }); }
  catch (e) { res.status(400).json({ ok: false, error: e.message }); }
  finally { researchBusy = false; }
});

// ── Proposals ── list / approve / reject + manual "run now" (for testing) ──
app.get("/api/proposals", (req, res) => {
  const all = Object.values(store.getProposals()).filter((p) => p.status === "pending").sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  res.json({ ok: true, posts: all.filter((p) => p.kind === "post"), templates: all.filter((p) => p.kind === "template"), characters: all.filter((p) => p.kind === "character"), geminiReady: gemini.geminiReady(), lastRun: store.nightlyRanOn() });
});
app.post("/api/proposals/approve", (req, res) => {
  const p = store.getProposals()[(req.body || {}).id];
  if (!p || p.status !== "pending") return res.status(404).json({ ok: false, error: "proposal not found" });
  let routedTo = "";
  if (p.kind === "template") { store.addCustomTemplate({ id: p.id, name: p.name, base: p.base, accent: p.accent }); routedTo = "templates"; }
  else if (p.kind === "post") {
    // Approved design → drop it into the publish queue (قائمة النشر), marked
    // approved (owner explicitly approved it here) so it's ready to publish.
    const idNum = nextIdNum(baseState().queue);
    const qid = "MJ-" + String(idNum).padStart(3, "0");
    const media = (p.previewUrl || "").split("?")[0];  // /media/design/<id> (serves <id>.png or .mp4)
    const { date: today } = muscatDateHour();
    const fmt = p.format || "";
    const isReel = fmt.includes("ريل") || /\.mp4/.test(p.previewUrl || "") || (p.ty || "").includes("ريل");
    const isCar = fmt.includes("كاروسيل") || (p.images && p.images.length > 1);
    const qty = p.qty || (isReel ? "ريل نوعي" : isCar ? "كاروسيل توعوي" : "منشور علامة");
    appendPost({
      id: qid, t: p.t, t2: p.t2 || "", cta: p.cta || "",
      cap: `${p.t}${p.t2 ? " · " + p.t2 : ""}${p.cta ? "\n\n" + p.cta : ""}`,
      ty: qty, ch: "IG", tyc: "#6E1444",
      date: p.date || `${today} · 20:00`,
      mediaUrl: media, images: (p.images || []).map((u) => u.split("?")[0]), gen: true, template: p.template, regenerated: isCar,
    });
    store.approve(qid);   // status «معتمد» → shows approved & publish-ready in the queue
    routedTo = "pipeline";
    // Reflect the approval on the SOURCE plan item so «خطة المحتوى» shows it as
    // designed + approved (locked) — not a re-designable «مسودة» as if untouched.
    if (p.planMonth && p.planItemKey) {
      const plan = store.getPlans()[p.planMonth];
      const it = plan && (plan.items || []).find((i) => i.key === p.planItemKey);
      if (it) { it.designed = true; it.status = "applied"; it.queueId = qid; store.setPlan(plan); }
    }
  }
  else { store.addCustomCharacter({ id: p.id, label: p.label, dress: p.dress, file: p.file }); routedTo = "characters"; }
  store.setProposalStatus(p.id, "approved");
  res.json({ ok: true, routedTo });
});
app.post("/api/proposals/reject", (req, res) => {
  const id = (req.body || {}).id;
  const p = store.getProposals()[id];
  store.setProposalStatus(id, "rejected");
  // If this design came from a plan item, revert that item to draft so it shows
  // «مسودة» and can be re-designed (otherwise it's stuck on «صُمّم» with no proposal).
  if (p && p.planMonth && p.planItemKey) {
    const plan = store.getPlans()[p.planMonth];
    const it = plan && (plan.items || []).find((i) => i.key === p.planItemKey);
    if (it && it.status !== "applied") { it.designed = false; delete it.proposalId; store.setPlan(plan); }
  }
  res.json({ ok: true });
});
// Regenerate a pending proposal with the reviewer's note (edit-and-retry).
app.post("/api/proposals/regenerate", async (req, res) => {
  const b = req.body || {}; const p = store.getProposals()[b.id];
  if (!p || p.status !== "pending") return res.status(404).json({ ok: false, error: "proposal not found" });
  if (!gemini.geminiReady()) return res.status(400).json({ ok: false, error: "يحتاج ربط Gemini" });
  const note = (b.note || "").trim();
  try {
    if (p.kind === "post") {
      // Regenerate in the SAME format as the proposal (reel stays a reel, etc.).
      const light = p.template === "editorial-white";
      const fmt = p.format || (p.images && p.images.length > 1 ? "كاروسيل" : /\.mp4/.test(p.previewUrl || "") ? "ريل" : "منشور");
      const cta = p.cta || "قريبًا في عُمان";
      // A note re-writes the on-design COPY: a stronger, realistic HOOK (cover /
      // headline) + coherent carousel slides — tied to the topic, honoring the
      // note (e.g. "make the hook stronger" or "add a closing solution slide").
      let headline = p.t, slides = p.points || [];
      try {
        const copy = await generator.strongCopy({ title: p.t, ty: p.ty, desc: p.desc, cap: p.cap, format: fmt, note });
        if (copy) { if (copy.hook) headline = copy.hook; if (copy.slides && copy.slides.length) slides = copy.slides; }
      } catch (e) { console.error("[strongCopy]", e.message); }
      const hint = sceneGuidance(p.desc);
      let ed, images = [];
      if (fmt.includes("ريل")) { ed = await makeEditorialReel({ id: p.id, light, headline, pop: p.t2 || "", cta, valueLine: "متجر · كاشير · محاسبة", sceneHint: hint }); }
      else if (fmt.includes("كاروسيل")) {
        if (slides.length > 4) slides = [...slides.slice(0, 3), slides[slides.length - 1]]; // ≤4 content slides; keep the closing/solution last
        const c = await makeEditorialCarousel({ id: p.id, light, headline, cta, points: slides, sceneHint: hint }); ed = { url: c.url }; images = c.images;
      }
      else { const sc = editorialScene(headline, light); ed = await makeEditorial({ light, layout: sc.layout, kicker: "متجرلينك", headline, pop: p.t2 || "", cta, prompt: sc.prompt + hint, id: p.id }); }
      store.saveProposal({ ...p, t: headline, points: slides, previewUrl: ed.url, images });
    } else if (p.kind === "character") {
      const dir = designsDir(); fs.mkdirSync(dir, { recursive: true });
      const { refs, note: cnote } = clothingRefsFor(p.prompt);
      const { buffer } = await gemini.generateImage(p.prompt + (note ? ` ${note}.` : "") + cnote, refs);
      const name = `_propchar-${p.id}`, file = `${name}.png`;
      const fd = fs.openSync(path.join(dir, file), "w"); try { fs.writeSync(fd, buffer); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      store.saveProposal({ ...p, file, previewUrl: `/media/design/${name}?v=${Date.now()}` });
    } else return res.status(400).json({ ok: false, error: "لا يدعم إعادة توليد القوالب" });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── «المونتير» ── Senior Creative Video Editor: analyzes a reel and applies a
// commercial-grade re-render (brand colour grade + vignette + film grain +
// micro-sharpen) to the finished mp4. Grading always runs from a pristine
// «.orig» backup, so repeated reviews never compound the grade.
let editorBusy = false;
app.post("/api/reel/review", async (req, res) => {
  const p = store.getProposals()[(req.body || {}).id];
  if (!p || p.status !== "pending") return res.status(404).json({ ok: false, error: "proposal not found" });
  const isReel = /\.mp4/.test(p.previewUrl || "") || (p.format || "").includes("ريل");
  if (!isReel) return res.status(400).json({ ok: false, error: "أداة المونتير للريلز فقط" });
  if (editorBusy) return res.status(429).json({ ok: false, error: "المونتير مشغول بريل آخر — انتظر ثوانٍ" });
  editorBusy = true;
  try {
    const report = await generator.reviewReel({ t: p.t, t2: p.t2, cta: p.cta, ty: p.ty, desc: p.desc });
    if (!report) return res.status(502).json({ ok: false, error: "تعذّر تحليل المونتير — تحقق من ربط Claude" });
    let graded = false;
    const dir = designsDir();
    const src = path.join(dir, `${p.id}.mp4`);
    if (fs.existsSync(src)) {
      const orig = path.join(dir, `${p.id}.orig.mp4`);
      if (!fs.existsSync(orig)) fs.copyFileSync(src, orig); // pristine source, graded once
      const { renderProReel } = await import("./data/reelEngine.js");
      const tmp = path.join(dir, `${p.id}.pro.mp4`);
      await renderProReel(orig, tmp, { light: p.template === "editorial-white", grade: report.colorMood });
      fs.renameSync(tmp, src);
      const fd = fs.openSync(src, "r+"); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      graded = true;
    }
    const previewUrl = `/media/design/${p.id}.mp4?v=${Date.now()}`;
    store.saveProposal({ ...p, previewUrl, editorReport: report, editorGraded: graded });
    res.json({ ok: true, report, graded, previewUrl });
  } catch (e) { console.error("[montير]", e.message); res.status(500).json({ ok: false, error: e.message }); }
  finally { editorBusy = false; }
});
// ── Editorial style (adopted templates 6 = dark, 7 = white) ──────────────────
// Gemini generates a content-matched premium SCENE (person/device/card/place),
// our engine overlays crisp Arabic text. Dynamic layout (side/center) + a hero
// chosen from the headline so the imagery expresses the message.
const EDITORIAL_TEMPLATES = ["editorial-dark", "editorial-white"];
const isEditorial = (t) => EDITORIAL_TEMPLATES.includes(t);
function editorialScene(text, light) {
  const t = String(text || "");
  const grade = light
    ? "bright airy, clean white and warm-orange tones (brand colors #F5821F and #2D081E, NOT purple, NOT violet), subtle flowing orange glassmorphism accents"
    : "deep AUBERGINE-PLUM and warm-ORANGE cinematic color grade (brand colors #2D081E and #F5821F, NOT purple, NOT violet), subtle flowing orange glassmorphism accents";
  const rm = " Shot on a real camera, candid documentary editorial photograph — natural authentic HUMAN features, real skin texture with pores and subtle imperfections, natural asymmetry, realistic catchlights in the eyes. NOT 3D render, NOT AI illustration, NOT a plastic/waxy/over-smoothed/airbrushed face, NOT a beauty filter. No text, no words, no logos.";
  const side = "on the FAR RIGHT third, large clean negative space on the LEFT for a headline.";
  const has = (arr) => arr.some((w) => t.includes(w));
  if (has(["كاشير", "نقطة بيع", "نقطة البيع"])) return { layout: "side", prompt: `A sleek modern POS cashier terminal with a glowing touchscreen showing a sale, ${light ? "soft studio spotlight and gentle reflection" : "dramatic cinematic spotlight and rim light"}, ${grade}, the device ${side}${rm}` };
  if (has(["مدفوعات", "بطاقة", "الدفع", "محفظة", "فيزا"])) return { layout: "side", prompt: `A realistic premium ${light ? "light cream" : "matte dark"} bank payment card with a visible embossed card number and a small "MatjarLink" logo printed on it, floating at a dynamic angle with ${light ? "soft studio lighting and warm reflection" : "dramatic rim lighting and warm orange glow"}, ${grade}, the card ${side}${rm}` };
  if (has(["محاسبة", "حسابات", "حساباتك", "تقارير", "أرباح"])) return { layout: "center", prompt: `A glowing modern accounting and finance dashboard on a laptop and tablet with charts on a premium ${light ? "bright" : "dark"} desk, focused lighting, ${grade}, clean empty area at the TOP for a headline.${rm}` };
  if (has(["سوق", "أسواق", "وصّل", "توصيل", "كل مكان", "كل عُمان", "كل عمان"])) return { layout: "center", prompt: `A ${light ? "bright vibrant Omani marketplace / modern retail street with daylight and colorful shopfronts" : "warm cinematic Omani souq marketplace with lanterns and rich stalls"}, atmospheric depth, ${grade}, clean empty area at the TOP for a headline.${rm}` };
  if (has(["محل", "المحل", "مفتوح", "متجرك", "فرع"])) return { layout: "center", prompt: `A beautiful modern premium Omani retail shop interior with elegant shelves and ${light ? "big windows, soft natural daylight, airy and clean" : "warm illuminated shelves at night, cinematic atmosphere"}, ${grade}, clean empty area at the TOP for a headline.${rm}` };
  if (has(["جوال", "بجيبك", "تطبيق", "أينما", "موبايل"])) return { layout: "center", prompt: `A modern smartphone held in hand clearly showing a realistic, believable online store app UI with real-looking product photos and prices, ${light ? "clean bright white background, soft warm light" : "dramatic spotlight on the phone, dark background"}, ${grade}, clean empty area at the TOP for a headline.${rm}` };
  if (has(["هدية", "هدايا", "توزيعات", "ورد", "مناسبة"])) return { layout: "side", prompt: `An elegant premium gift box and a branded shopping bag with a ribbon, ${light ? "soft bright studio light" : "dramatic warm light, dark"}, ${grade}, the objects ${side}${rm}` };
  if (has(["منتج", "منتجات", "بضاعة", "مخزون", "طلب", "شحن", "طرد", "تغليف"])) return { layout: "center", prompt: `Neatly arranged premium product boxes and a branded delivery package ready to ship on a clean surface, ${light ? "bright soft light" : "warm dramatic light"}, ${grade}, clean empty area at the TOP for a headline.${rm}` };
  if (has(["رقم", "أرقام", "إحصائ", "%", "٪", "نسبة", "ضِعف", "ضعف", "أكثر", "نمو", "زيادة"])) return { layout: "center", prompt: `A bold minimalist premium composition with abstract 3D shapes, rising bars and glowing accents suggesting growth — render NO readable text or numbers, ${grade}, large clean empty area for a big headline.${rm}` };
  // Person heroes ONLY when the text explicitly implies a person — otherwise a
  // product/device is the hero (varied, and always tied to the message).
  const person = has(["تاجر", "تاجرة", "سيدة", "بائع", "بائعة", "ابدئي", "موظف", "شخص", "رجل", "صاحب", "عميل", "دعم"]);
  if (person) {
    const { woman, egyptian } = personaFor(t);   // shared decision → matches face + garment; rotates for variety
    // Clothing is defined by the reference images (character portrait / wardrobe
    // garment) — the prompt gives only identity, no specific dress, so it never
    // competes with or overrides the chosen garment.
    const who = woman
      ? "an authentic Omani woman shop owner (modest, face fully visible, NOT niqab)"
      : egyptian
        ? "an Arab (Egyptian) man employee in a smart casual buttoned shirt and trousers (NOT Gulf dress)"
        : "an authentic Omani man merchant";
    return { layout: "side", prompt: `${who} holding a smartphone showing an online store app, ${light ? "clean bright WHITE studio background, soft studio light with gentle separation" : "dramatic spotlight and rim light separating them from the background"}, ${grade}, the subject ${side}${rm}` };
  }
  // Default (no explicit person keyword) → a product/device hero, NOT a person.
  return { layout: "side", prompt: `A modern smartphone showing a realistic MatjarLink online store app with real product photos, beside a subtle branded shopping bag and a product box, ${light ? "clean bright studio, soft warm light" : "dramatic spotlight, dark cinematic"}, ${grade}, the objects ${side}${rm}` };
}
// Render an editorial design to /media/design/<id>. Returns { url }.
async function makeEditorial({ light, layout, kicker, headline, pop, cta, prompt, id }) {
  const { refs, note } = heroRefs(prompt);   // character FACE + wardrobe GARMENT when the scene has a person
  const { buffer } = await gemini.generateImage(prompt + note, refs);
  const dir = designsDir(); fs.mkdirSync(dir, { recursive: true });
  const bgFile = path.join(dir, `_edbg-${id}.png`);
  const fd0 = fs.openSync(bgFile, "w"); try { fs.writeSync(fd0, buffer); fs.fsyncSync(fd0); } finally { fs.closeSync(fd0); }
  const eng = await import("./data/designEngine.js");
  const png = await eng.renderEditorial({ bg: bgFile, kicker: kicker || "متجرلينك", headline: headline || "", pop: pop || "", cta: cta || "", light: !!light, layout: layout === "center" ? "center" : "side", biz: store.getBrandData() });
  const fd = fs.openSync(path.join(dir, id + ".png"), "w"); try { fs.writeSync(fd, png); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  return { url: `/media/design/${id}?v=${Date.now()}` };
}
// Editorial REEL: 3 vertical (9:16) Gemini cinematic scenes + our text, animated
// (Ken Burns per scene, lossless concat). Returns { url } (.mp4).
async function makeEditorialReel({ id, light = false, headline, pop, cta, valueLine, sceneHint = "" }) {
  if (!gemini.geminiReady()) throw new Error("قالب «الإعلاني» يحتاج ربط Gemini أولاً");
  const dir = designsDir(); fs.mkdirSync(dir, { recursive: true });
  const eng = await import("./data/designEngine.js");
  const { renderReelFromFrames } = await import("./data/reelEngine.js");
  const grade = light ? "bright airy, clean white and warm-orange tones (brand colors #F5821F and #2D081E, NOT purple)" : "deep AUBERGINE-PLUM and warm-ORANGE cinematic color grade (brand colors #2D081E and #F5821F, NOT purple)";
  const rm = " Shot on a real camera, cinematic vertical composition — natural authentic HUMAN features, real skin texture with pores and subtle imperfections, natural asymmetry, realistic eye catchlights. NOT 3D render, NOT AI illustration, NOT a plastic/waxy/over-smoothed/airbrushed face, NOT a beauty filter. No text, no words, no logos.";
  // Vary the opening person (man / Omani woman / Arab) by the reel topic — no
  // longer hardcoded to the same Omani man. Identity only; clothing comes from
  // the face/garment references (never invented).
  const rp = personaFor(headline || "");
  const rWho = rp.woman ? "an authentic Omani woman shop owner (modest, face fully visible, NOT niqab)"
    : rp.egyptian ? "an Arab (Egyptian) man shop employee in a smart casual buttoned shirt and trousers (NOT Gulf dress)"
      : "an authentic Omani man merchant";
  const scenePrompts = [
    `Cinematic VERTICAL 9:16 portrait of ${rWho} in an elegant modern shop, dramatic warm rim lighting, ${grade}. Frame from the chest up with the FACE at the VERTICAL CENTRE of the frame — leave a large clean EMPTY area in the TOP THIRD for a headline and empty space at the BOTTOM; do NOT place the head or face in the top third.${rm}`,
    `Cinematic VERTICAL 9:16 close-up of a modern smartphone and a glowing POS cashier screen showing an online store and a sale, dramatic focused lighting, ${grade}, the device in the lower-centre with a large clean EMPTY area in the TOP THIRD for a headline.${rm}`,
    `Cinematic VERTICAL 9:16 wide shot of a premium modern Omani shop or marketplace with warm inviting light, atmospheric depth, ${grade}, clean empty space in the CENTER for a call to action.${rm}`,
  ];
  const texts = [
    { kicker: "متجرلينك", headline, pop },
    { kicker: "", headline: valueLine || "متجر · كاشير · محاسبة", pop: "" },
    { kicker: "متجرلينك", headline: cta || "قريبًا في عُمان", pop: "" },
  ];
  const frames = [], junk = [];
  try {
    for (let i = 0; i < 3; i++) {
      const { refs, note } = heroRefs(scenePrompts[i]);   // character FACE + wardrobe GARMENT on the person scene
      const { buffer } = await gemini.generateImage(scenePrompts[i] + note + (i === 0 ? sceneHint : ""), refs);
      const bgFile = path.join(dir, `_rlbg-${id}-${i}.png`); junk.push(bgFile);
      let fd0 = fs.openSync(bgFile, "w"); try { fs.writeSync(fd0, buffer); fs.fsyncSync(fd0); } finally { fs.closeSync(fd0); }
      const png = await eng.renderEditorial({ bg: bgFile, h: 1920, layout: "center", light, kicker: texts[i].kicker || "متجرلينك", headline: texts[i].headline, pop: texts[i].pop, cta: "", biz: store.getBrandData() });
      const fr = path.join(dir, `_rlfr-${id}-${i}.png`); junk.push(fr);
      let fd = fs.openSync(fr, "w"); try { fs.writeSync(fd, png); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      frames.push(fr);
    }
    const out = path.join(dir, `${id}.mp4`);
    await renderReelFromFrames(frames, out);
    return { url: `/media/design/${id}.mp4?v=${Date.now()}` };
  } finally { for (const f of junk) { try { fs.unlinkSync(f); } catch (e) {} } }
}
// Editorial CAROUSEL: a cover + content slides, each its own editorial scene.
// Returns { url (cover), images: [cover, slide1, …] } for the carousel queue post.
async function makeEditorialCarousel({ id, light = false, headline, cta, points = [], sceneHint = "" }) {
  if (!gemini.geminiReady()) throw new Error("قالب «الإعلاني» يحتاج ربط Gemini أولاً");
  const dir = designsDir(); fs.mkdirSync(dir, { recursive: true });
  const eng = await import("./data/designEngine.js");
  const biz = store.getBrandData();
  const writePng = (name, buf) => { const fd = fs.openSync(path.join(dir, name + ".png"), "w"); try { fs.writeSync(fd, buf); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } };
  const renderSlide = async (slug, hl, kicker, isLight) => {
    const sc = editorialScene(hl, isLight);
    const { refs, note } = heroRefs(sc.prompt);
    const { buffer } = await gemini.generateImage(sc.prompt + note + sceneHint, refs);
    const bg = path.join(dir, `_cbg-${slug}.png`);
    const fd0 = fs.openSync(bg, "w"); try { fs.writeSync(fd0, buffer); fs.fsyncSync(fd0); } finally { fs.closeSync(fd0); }
    const png = await eng.renderEditorial({ bg, kicker, headline: hl, pop: "", cta: "", light: isLight, layout: sc.layout, biz });
    try { fs.unlinkSync(bg); } catch (e) {}
    return png;
  };
  // Keep the slide count small — each slide is a full Skia render + Gemini image,
  // and the container is memory-constrained (too many in a row OOM-kills it).
  const slidePoints = (points && points.length ? points : ["متجر إلكتروني احترافي", "كاشير ذكي يربط كل شي", "محاسبة وتقارير تلقائية"]).slice(0, 4);
  const urls = [];
  let cover = await renderSlide(`${id}-c`, headline, "متجرلينك", light);
  writePng(id, cover); cover = null; urls.push(`/media/design/${id}`);
  for (let i = 0; i < slidePoints.length; i++) {
    let png = await renderSlide(`${id}-${i + 1}`, slidePoints[i], i === slidePoints.length - 1 ? (cta || "قريبًا") : "", light);
    writePng(`${id}-${i + 1}`, png); png = null; urls.push(`/media/design/${id}-${i + 1}`);
    if (global.gc) { try { global.gc(); } catch (e) {} }   // release Skia/native memory between slides when exposed
  }
  return { url: `/media/design/${id}?v=${Date.now()}`, images: urls };
}

// Hybrid design: Gemini generates a premium branded SCENE/background (no text),
// then our engine overlays crisp Arabic headline + brand furniture on top.
app.post("/api/hybrid-sample", async (req, res) => {
  try {
    const b = req.body || {};
    if (!gemini.geminiReady()) return res.status(400).json({ ok: false, error: "gemini not connected" });
    const { buffer } = await gemini.generateImage(b.prompt || "premium abstract brand background, plum and orange, empty center, no text");
    const dir = designsDir(); fs.mkdirSync(dir, { recursive: true });
    const id = "hyb-" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    const bgFile = path.join(dir, `_hybbg-${id}.png`);
    const fd0 = fs.openSync(bgFile, "w"); try { fs.writeSync(fd0, buffer); fs.fsyncSync(fd0); } finally { fs.closeSync(fd0); }
    const eng = await import("./data/designEngine.js");
    let png;
    if ((b.style || "editorial") === "editorial") {
      png = await eng.renderEditorial({ bg: bgFile, kicker: b.kicker || "متجرلينك", headline: b.headline || "", pop: b.pop || b.headline2 || "", cta: b.cta || "", light: !!b.light, layout: b.layout === "center" ? "center" : "side", motif: !!b.motif, biz: store.getBrandData() });
    } else {
      png = await eng.renderDesign({ role: "single", kicker: b.kicker || "متجرلينك", headline: b.headline || "", headline2: b.headline2 || "", cta: b.cta || "", template: "spotlight", photo: bgFile });
    }
    const name = `_hyb-${id}`;
    const fd = fs.openSync(path.join(dir, name + ".png"), "w"); try { fs.writeSync(fd, png); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    res.json({ ok: true, url: `/media/design/${name}?v=${Date.now()}`, bg: `/media/design/_hybbg-${id}?v=${Date.now()}` });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});
app.post("/api/proposals/run-now", async (req, res) => { const r = await generateNightlyBatch(); res.json({ ok: true, ...r }); });
// Fresh start: wipe plans/drafts/proposals/overrides/notes (new-identity rebuild).
app.post("/api/admin/reset", (req, res) => { res.json(store.resetForFreshStart()); });
// Design ONE plan item → an editorial proposal in «الاعتماد», using the item's
// OWN owner-editable title + caption + type (no per-item Claude call → fast, and
// it honours the exact copy the owner wrote/edited in the plan). Alternates
// white/dark by the item's position, carries the plan's date+time.
const CTA_FOR = (ty) => (ty === "تشويق" ? "قريبًا في عُمان" : ty === "إحصائيات" ? "الرقم يتكلم" : "سجّل اهتمامك");
async function designPlanItem(plan, it) {
  const idx = Math.max(0, (plan.items || []).indexOf(it));
  // Template: owner's per-item choice wins; otherwise auto-alternate white/dark.
  const chosen = (it.template === "editorial-white" || it.template === "editorial-dark") ? it.template : null;
  const template = chosen || (idx % 2 === 0 ? "editorial-white" : "editorial-dark");
  const light = template === "editorial-white";
  const dateStr = `${plan.year}-${String(plan.month).padStart(2, "0")}-${String(it.day).padStart(2, "0")} · ${it.time || "20:00"}`;
  const cta = (it.cta && it.cta.trim()) || CTA_FOR(it.ty);
  const pid = "post-" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  const planMonth = `${plan.year}-${String(plan.month).padStart(2, "0")}`;
  const fmt = it.format || "منشور";
  const hint = sceneGuidance(it.desc);   // background follows the idea; text is coherent with the visuals
  // A senior copywriter writes the on-design HOOK (never the bare topic title)
  // + coherent carousel slides. Falls back to the title/points if Claude is down.
  let copy = null;
  try { copy = await generator.strongCopy({ title: it.t, ty: it.ty, desc: it.desc, cap: it.cap, format: fmt }); } catch (e) { console.error("[strongCopy]", e.message); }
  const headline = (copy && copy.hook) || it.t || "متجرلينك";
  const slides = (copy && copy.slides && copy.slides.length) ? copy.slides : (it.points || []);
  let previewUrl, images = [], qty;
  if (fmt.includes("ريل")) {
    // valueLine is the reel's short on-screen middle line — a product value prop,
    // NEVER the idea description (that only briefs the design, it is never text).
    const ed = await makeEditorialReel({ id: pid, light, headline, pop: "", cta, valueLine: "متجر · كاشير · محاسبة", sceneHint: hint });
    previewUrl = ed.url; qty = "ريل نوعي";
  } else if (fmt.includes("كاروسيل")) {
    const ed = await makeEditorialCarousel({ id: pid, light, headline, cta, points: slides, sceneHint: hint });
    previewUrl = ed.url; images = ed.images; qty = "كاروسيل توعوي";
  } else {
    const sc = editorialScene(headline, light);
    const ed = await makeEditorial({ light, layout: sc.layout, kicker: "متجرلينك", headline, pop: "", cta, prompt: sc.prompt + hint, id: pid });
    previewUrl = ed.url; qty = "منشور علامة";
  }
  store.saveProposal({ id: pid, kind: "post", template, t: headline, t2: "", cta, cap: it.cap || "", ty: it.ty, format: fmt, desc: it.desc || "", points: slides, qty, images, name: `${headline} · ${dateStr.split(" · ")[0]}`, date: dateStr, previewUrl, planMonth, planItemKey: it.key });
  it.designed = true; it.proposalId = pid;
  return pid;
}
// Serialize heavy design generation — only ONE at a time, so overlapping
// reel/carousel renders can't stack up and OOM the memory-constrained container.
let designBusy = false;
// Design a single plan item on demand (owner clicks 🎨 on the row).
app.post("/api/plan/design-item", async (req, res) => {
  if (!gemini.geminiReady()) return res.status(400).json({ ok: false, error: "يحتاج ربط Gemini أولاً" });
  if (designBusy) return res.status(429).json({ ok: false, error: "جارٍ توليد تصميم آخر — انتظر ثوانٍ ثم أعد المحاولة" });
  const { month, key } = req.body || {};
  const plans = store.getPlans();
  const plan = (month && plans[month]) || Object.values(plans).find((p) => (p.items || []).some((i) => i.key === key));
  const it = plan && (plan.items || []).find((i) => i.key === key);
  if (!it) return res.status(404).json({ ok: false, error: "عنصر غير موجود" });
  designBusy = true;
  try { const pid = await designPlanItem(plan, it); store.setPlan(plan); res.json({ ok: true, proposalId: pid }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  finally { designBusy = false; }
});
// Reject + regenerate ONE plan idea (owner clicks 🔄 on the row) — replaces just
// that slot with a fresh idea, avoiding published/scheduled ideas and its plan
// siblings so it never duplicates. Keeps the slot's key/day/time; resets design.
app.post("/api/plan/regenerate-item", async (req, res) => {
  if (!generator.claudeReady()) return res.status(400).json({ ok: false, error: "add ANTHROPIC_API_KEY to enable generation" });
  const { month, key, note } = req.body || {};
  const plans = store.getPlans();
  const plan = (month && plans[month]) || Object.values(plans).find((p) => (p.items || []).some((i) => i.key === key));
  const it = plan && (plan.items || []).find((i) => i.key === key);
  if (!it) return res.status(404).json({ ok: false, error: "عنصر غير موجود" });
  if (it.status === "applied") return res.status(400).json({ ok: false, error: "لا يمكن استبدال فكرة معتمدة/منشورة" });
  const mk = `${plan.year}-${String(plan.month).padStart(2, "0")}`;
  const siblings = (plan.items || []).filter((i) => i.key !== key && i.t).map((i) => i.t.trim());
  const avoid = [...new Set([...collectUsedTitles(mk), ...siblings, it.t].filter(Boolean))];
  let c;
  try { c = await generator.regeneratePlanIdea({ monthLabel: plan.label || mk, ty: it.ty, format: it.format, avoid, note: (note || "").trim() }); }
  catch (e) { console.error("[regen-item]", e.message); return res.status(500).json({ ok: false, error: e.message }); }
  if (!c) return res.status(502).json({ ok: false, error: "تعذّر توليد فكرة بديلة" });
  const normFmt = (f) => { const s = String(f || ""); return s.includes("ريل") ? "ريل" : s.includes("كاروسيل") ? "كاروسيل" : s.includes("منشور") || s.includes("بوست") ? "منشور" : it.format; };
  // Replace the idea in place; keep scheduling (key/day/time); reset design state.
  it.t = String(c.t || it.t); it.ty = String(c.ty || it.ty); it.pillar = it.ty;
  it.format = normFmt(c.format); it.hook = String(c.hook || ""); it.desc = String(c.desc || "");
  it.cta = String(c.cta || ""); it.points = Array.isArray(c.points) ? c.points.map(String).slice(0, 5) : [];
  it.cap = String(c.cap || ""); it.designed = false; it.status = "draft"; delete it.proposalId;
  store.setPlan(plan);
  res.json({ ok: true, item: it });
});
// Approve the whole plan → design ALL not-yet-designed FUTURE items at once,
// each → «الاعتماد» carrying its plan date+time for individual approval.
app.post("/api/plan/approve", async (req, res) => {
  if (!gemini.geminiReady()) return res.status(400).json({ ok: false, error: "يحتاج ربط Gemini أولاً" });
  if (designBusy) return res.status(429).json({ ok: false, error: "جارٍ توليد تصميم — انتظر ثوانٍ ثم أعد المحاولة" });
  const key = (req.body || {}).month;
  const plans = store.getPlans();
  const plan = (key && plans[key]) || Object.values(plans).sort((a, b) => (b.generatedAt || "").localeCompare(a.generatedAt || ""))[0];
  if (!plan) return res.status(404).json({ ok: false, error: "لا توجد خطة لاعتمادها" });
  const mn = new Date(Date.now() + 4 * 3600 * 1000);
  const today0 = Date.UTC(mn.getUTCFullYear(), mn.getUTCMonth(), mn.getUTCDate());
  const items = (plan.items || []).filter((it) => Date.UTC(plan.year, plan.month - 1, it.day) >= today0 && !it.designed);
  const out = { generated: 0, errors: [] };
  designBusy = true;
  try { for (const it of items) { try { await designPlanItem(plan, it); out.generated++; } catch (e) { out.errors.push(e.message); } } }
  finally { designBusy = false; }
  plan.approved = true; plan.approvedAt = new Date().toISOString();
  store.setPlan(plan);
  res.json({ ok: true, ...out });
});
app.post("/api/plan/regenerate", async (req, res) => {
  if (!gemini.geminiReady()) return res.status(400).json({ ok: false, error: "قالب «الإعلاني» يحتاج ربط Gemini أولاً" });
  const m = new Date(Date.now() + 4 * 3600 * 1000);            // Muscat now
  const start = new Date(m); start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 7));
  const dates = [];
  for (const d = new Date(start); d <= end && dates.length < 10; d.setUTCDate(d.getUTCDate() + 2)) dates.push(new Date(d));
  const out = { posts: 0, errors: [] };
  for (let i = 0; i < dates.length; i++) {
    try {
      const c = NIGHTLY_POSTS[i % NIGHTLY_POSTS.length];
      const light = i % 2 === 0;
      const template = light ? "editorial-white" : "editorial-dark";
      const id = "post-" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
      const sc = editorialScene(c.headline, light);
      const ed = await makeEditorial({ light, layout: sc.layout, kicker: "متجرلينك", headline: c.headline, pop: c.pop, cta: c.cta, prompt: sc.prompt, id });
      const dstr = dates[i].toISOString().slice(0, 10);
      store.saveProposal({ id, kind: "post", template, t: c.headline, t2: c.pop, cta: c.cta, name: `${c.headline} · ${dstr}`, date: dstr, previewUrl: ed.url });
      out.posts++;
    } catch (e) { out.errors.push(e.message); }
  }
  res.json({ ok: true, ...out });
});

// ── Studio ── instant design creation: pick type/template/character/idea →
// render on the spot → preview → publish now / schedule / download. Drafts live
// outside the queue until the owner acts, so regenerating never clutters it.
const STUDIO_TYPES = { post: "منشور", carousel: "كاروسيل", reel: "ريل", story: "ستوري" };
// Convert a studio draft into a real queue post (keeps the id so its already-
// rendered media at /media/design/<id> resolves). regenerated=true so publishing
// uses the freshly generated media rather than any Drive original.
function studioToPost(d, date) {
  return { id: d.id, t: d.t, t2: d.t2 || "", cta: d.cta || "", cap: d.cap || d.description || "", ty: d.ty, date, mediaUrl: d.mediaUrl, images: d.images || [], regenerated: true, studio: true };
}
app.get("/api/studio/drafts", (req, res) => {
  const drafts = Object.values(store.getStudioDrafts()).sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  // Use the LIVE character set (builtin ∪ approved − hidden) so Studio stays in
  // sync with the Characters page (deletions/additions reflect immediately).
  res.json({ ok: true, drafts, types: STUDIO_TYPES, templates: [...EDITORIAL_TEMPLATES, ...store.getCustomTemplates().map((t) => t.id)], characters: allCharacters().map((c) => ({ id: c.id, label: c.label })) });
});
app.post("/api/studio/generate", async (req, res) => {
  const b = req.body || {};
  const type = STUDIO_TYPES[b.type] ? b.type : "post";
  const template = (DESIGN_TEMPLATES.includes(b.template) || isEditorial(b.template)) ? b.template : activeTemplate();
  const character = b.character && charMod.characterById(b.character) ? b.character : "";
  const lang = b.lang || "ar";
  const idea = (b.idea || "").trim();
  const description = (b.description || "").trim();
  const id = (b.draftId && store.getStudioDraft(b.draftId)) ? b.draftId : "STU-" + Date.now().toString(36).toUpperCase();
  const notes = (b.notes || "").trim();
  const content = { t: (b.headline || "").trim(), t2: (b.subheadline || "").trim(), cta: (b.cta || "").trim(), cap: description, kicker: (b.kicker || "").trim() };
  let scenes = null;
  // Derive copy from the idea when the owner didn't type a headline (AI optional).
  // Regenerate-with-notes always re-runs the model, feeding the owner's edit notes.
  if ((!content.t || notes) && generator.claudeReady() && (idea || description || notes)) {
    try {
      const prompt = [idea, description, notes ? `ملاحظات المالك للتعديل (طبّقها): ${notes}` : ""].filter(Boolean).join("\n");
      const g = await generator.generatePost({ idNum: 0, date: "", prompt, prefLine: store.hookPrefLine() }, lang);
      if (g) { content.t = notes ? (g.t || content.t) : (content.t || g.t || ""); content.t2 = g.t2 || content.t2 || ""; content.cta = content.cta || g.cta || ""; content.cap = g.cap || content.cap || ""; scenes = g.scenes || null; }
    } catch (e) { console.error("[studio gen]", e.message); }
  }
  if (!content.t) content.t = idea || description || "منشور جديد";
  if (!content.cta) content.cta = "قريبًا في عُمان";
  const ty = STUDIO_TYPES[type];
  const item = { id, t: content.t, t2: content.t2, cta: content.cta, cap: content.cap, ty };
  try {
    if (isEditorial(template) && (type === "post" || type === "reel")) {
      if (!gemini.geminiReady()) throw new Error("قالب «الإعلاني» يحتاج ربط Gemini أولاً");
      const light = template === "editorial-white";
      if (type === "reel") {
        const r = await makeEditorialReel({ id, light, headline: content.t, pop: content.t2 || "قريبًا", cta: content.cta, valueLine: "متجر · كاشير · محاسبة" });
        item.mediaUrl = r.url; item.images = [];
      } else {
        const sc = editorialScene([content.t, idea, description].join(" "), light);
        const ed = await makeEditorial({ light, layout: sc.layout, kicker: content.kicker || "متجرلينك", headline: content.t, pop: content.t2 || "", cta: content.cta, prompt: sc.prompt, id });
        item.mediaUrl = ed.url; item.images = [];
      }
    } else if (type === "reel") {
      const r = await renderAndSaveReel(item, { ...content, scenes: scenes || content.scenes }, { template });
      item.mediaUrl = r.mediaUrl; item.images = [];
    } else if (type === "story") {
      const { renderStory } = await import("./data/designEngine.js");
      const dir = designsDir(); fs.mkdirSync(dir, { recursive: true });
      const buf = await renderStory({ title: content.t, badge: content.cta });
      const fd = fs.openSync(path.join(dir, id + ".png"), "w"); try { fs.writeSync(fd, buf); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      item.mediaUrl = `/media/design/${id}?v=${Date.now()}`; item.images = [];
    } else {
      const cnt = { ...content };
      if (type === "carousel" && scenes && scenes.length) cnt.slides = scenes.map((s) => ({ t: s.headline || s.t || "", body: s.body || "" }));
      const d = await renderAndSaveDesign({ ...item, ty }, cnt, { template, characterId: character });
      item.mediaUrl = d.mediaUrl; item.images = d.images || [];
    }
  } catch (e) { console.error("[studio render]", e.message); return res.status(500).json({ ok: false, error: e.message }); }
  const draft = store.saveStudioDraft({ ...item, type, template, character, platform: b.platform || "instagram", idea, description, notes, approved: false });
  res.json({ ok: true, draft });
});
// Approve a studio draft → it graduates to the "recent designs" list where it can
// be published, scheduled or downloaded.
app.post("/api/studio/approve", (req, res) => {
  const d = store.getStudioDraft((req.body || {}).id);
  if (!d) return res.status(404).json({ ok: false, error: "draft not found" });
  store.saveStudioDraft({ ...d, approved: true });
  res.json({ ok: true });
});
app.post("/api/studio/publish", async (req, res) => {
  const d = store.getStudioDraft((req.body || {}).id);
  if (!d) return res.status(404).json({ ok: false, error: "draft not found" });
  if (!metaPublish.publishReady()) return res.status(400).json({ ok: false, error: "Meta publishing not configured (add META_ACCESS_TOKEN + META_IG_USER_ID)" });
  const post = studioToPost(d, d.date || defaultNextSlot());
  appendPost(post);
  const input = resolveMedia(post, publicBase(req));
  if (!input) return res.status(400).json({ ok: false, error: "no media for this draft" });
  if (publishingNow.has(post.id)) return res.status(409).json({ ok: false, error: "publish already in progress" });
  publishingNow.add(post.id);
  try {
    const result = await metaPublish.publish(input);
    store.markPublished(post.id, result);
    store.deleteStudioDraft(d.id);
    res.json({ ok: true, result });
    publishCompanionStory(post, input.kind, publicBase(req)); // fire-and-forget
  } catch (e) { console.error("[studio publish]", e.message); res.status(500).json({ ok: false, error: e.message }); }
  finally { publishingNow.delete(post.id); }
});
app.post("/api/studio/schedule", (req, res) => {
  const b = req.body || {};
  const d = store.getStudioDraft(b.id);
  if (!d) return res.status(404).json({ ok: false, error: "draft not found" });
  if (!b.date || !parseWhen(b.date)) return res.status(400).json({ ok: false, error: "valid date required (YYYY-MM-DD HH:mm)" });
  const post = studioToPost(d, b.date);
  appendPost(post);
  store.approve(post.id); // approved → auto-publish scheduler will post it at its time
  store.deleteStudioDraft(d.id);
  res.json({ ok: true, id: post.id, date: post.date });
});
app.post("/api/studio/delete", (req, res) => { store.deleteStudioDraft((req.body || {}).id); res.json({ ok: true }); });

// After a feed post publishes, optionally publish a branded companion Story
// ("جديد في البروفايل ↑") — doubles daily presence with zero owner effort.
// Toggle with AUTO_STORY. Never throws into the publish path.
async function publishCompanionStory(item, kind, base) {
  try {
    if ((process.env.AUTO_STORY || store.cfgGet("AUTO_STORY")) !== "on") return;
    if (kind === "reel") return; // stories accompany feed image/carousel posts
    const { renderStory } = await import("./data/designEngine.js");
    const dir = designsDir(); fs.mkdirSync(dir, { recursive: true });
    const buf = await renderStory({ title: item.t || item.cap || "منشور جديد" });
    const name = `${item.id}-story`;
    const fd = fs.openSync(path.join(dir, name + ".png"), "w"); try { fs.writeSync(fd, buf); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    const url = `${base}/media/design/${name}?v=${Date.now()}`;
    await metaPublish.publishStory(url);
    console.log(`[story] companion story for ${item.id}`);
  } catch (e) { console.error("[story]", e.message); }
}

// Notify the owner on WhatsApp (best-effort; needs OWNER_WHATSAPP + WA config).
async function notifyOwner(text) {
  try {
    const to = process.env.OWNER_WHATSAPP || store.cfgGet("OWNER_WHATSAPP");
    if (!to || !wa.whatsappReady()) return false;
    await wa.sendMessage(to, text); return true;
  } catch (e) { console.error("[notifyOwner]", e.message); return false; }
}

// Generate a REAL new reel video (1080x1920 MP4) from CAIMO's scenes.
async function renderAndSaveReel(item, content = {}, opts = {}) {
  const { renderReel } = await import("./data/reelEngine.js");
  const dir = designsDir(); fs.mkdirSync(dir, { recursive: true });
  let scenes = content.scenes || [];
  if (scenes.length < 2) {
    // fallback: derive hook → value → CTA from the regenerated copy
    scenes = [
      { kind: "hook", kicker: item.ty || "", headline: content.t || item.t || "" },
      { kind: "body", headline: "", body: (content.cap || item.cap || "").slice(0, 160) },
      { kind: "cta", headline: content.cta || "قريبًا" }
    ];
  }
  const out = path.join(dir, `${item.id}.mp4`);
  const tid = (opts.template && isValidTemplate(opts.template)) ? opts.template : activeTemplate();
  await renderReel(scenes, out, resolveTemplate(tid).base);
  return { mediaUrl: `/media/design/${item.id}.mp4?v=${Date.now()}`, images: [] };
}

// LIVE-ACTION: wrap the owner's filmed footage with a branded intro + outro.
// Body: { id, footageUrl, hook?, cta?, ctaBody? } → produces a branded reel and
// sets it as the post's video. The owner films (real people); we brand it.
app.post("/api/live-reel", async (req, res) => {
  const { id, footageUrl, hook, cta, ctaBody } = req.body || {};
  if (!id || !footageUrl || !/^https?:\/\//.test(footageUrl)) return res.status(400).json({ ok: false, error: "id + public footageUrl required" });
  const item = fullQueue().find((q) => q.id === id);
  if (!item) return res.status(404).json({ ok: false, error: "post not found" });
  try {
    const { renderLiveReel } = await import("./data/reelEngine.js");
    const dir = designsDir(); fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `${id}-live.mp4`);
    await renderLiveReel(footageUrl, { hook: hook || item.t || "", cta: cta || "قريبًا", ctaBody: ctaBody || "" }, out, activeTemplate());
    const mediaUrl = `/media/design/${id}-live.mp4?v=${Date.now()}`;
    const saved = store.setOverride(id, { mediaUrl, images: [] });
    store.addPostNote(id, "manager", `🎬 لفّيتُ فيديوك الحقيقي بمقدّمة وخاتمة مُبرندة — صار ريل لايف-أكشن جاهز للنشر.`);
    res.json({ ok: true, mediaUrl, override: saved });
  } catch (e) { console.error("[live-reel]", e.message); res.status(500).json({ ok: false, error: e.message }); }
});
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

// Instagram account-level insights (native IG Insights: reach, profile views,
// interactions, follower demographics…). Cached 10 min (IG rate limits).
app.get("/api/analytics/instagram", async (req, res) => {
  if (!meta.metaReady()) return res.json({ ok: false, error: "اربط Instagram (Meta) لعرض الإحصائيات" });
  const ttl = req.query.fresh ? 0 : 90; // near-live; refresh button bypasses cache
  let data = null;
  try { data = await cached("igAccountInsights", ttl, () => meta.getAccountInsights()); } catch (e) { return res.json({ ok: false, error: e.message }); }
  res.json({ ok: true, insights: data, at: new Date().toISOString() });
});

// Per-post analytics — real Instagram metrics for every published post.
app.get("/api/analytics/posts", async (req, res) => {
  const ttl = req.query.fresh ? 0 : 90;
  let pub = [];
  try { pub = await enrichPublished(await cached("published", ttl, () => meta.getPublished())) || []; } catch (e) {}
  const posts = pub.map((m) => {
    const eng = (m.likes || 0) + (m.comments || 0) + (m.saved || 0) + (m.shares || 0);
    const type = m.type === "VIDEO" ? "ريل" : m.type === "CAROUSEL_ALBUM" ? "كاروسيل" : "منشور";
    const rate = m.reach ? +((eng / m.reach) * 100).toFixed(1) : null;
    return { id: m.id, t: m.t || "", type, reach: m.reach ?? null, likes: m.likes || 0, comments: m.comments || 0, saved: m.saved || 0, shares: m.shares || 0, eng, engRate: rate, permalink: m.permalink || m.url || "", thumb: m.thumbnail || m.media_url || "", at: m.timestamp || m.at || "" };
  }).sort((a, b) => b.eng - a.eng);
  res.json({ ok: true, posts, live: meta.metaReady() });
});

// AI performance analysis → actionable recommendations from the real numbers.
app.get("/api/analytics/advice", async (req, res) => {
  if (!claude.claudeReady()) return res.json({ ok: false, error: "يحتاج ربط Claude (المدير الذكي) لتحليل الأرقام" });
  let pub = [];
  try { pub = await enrichPublished(await cached("published", 120, () => meta.getPublished())) || []; } catch (e) {}
  if (!pub.length) return res.json({ ok: true, advice: [{ title: "لا بيانات نشر بعد", detail: "بعد نشر أول منشورات الإطلاق ستظهر هنا توصيات مبنية على أرقامك الحقيقية (الوصول، التفاعل، الحفظ، أفضل الصيغ والمواضيع).", action: "ابدأ النشر من قائمة النشر" }] });
  const rows = pub.slice(0, 20).map((m) => {
    const eng = (m.likes || 0) + (m.comments || 0) + (m.saved || 0) + (m.shares || 0);
    const type = m.type === "VIDEO" ? "ريل" : m.type === "CAROUSEL_ALBUM" ? "كاروسيل" : "منشور";
    const rate = m.reach ? ((eng / m.reach) * 100).toFixed(1) : "?";
    return `${type} | «${(m.t || "").slice(0, 45)}» | وصول ${m.reach ?? "?"} | ❤${m.likes || 0} 💬${m.comments || 0} 🔖${m.saved || 0} ↗${m.shares || 0} | تفاعل ${eng} | معدل التفاعل ${rate}%`;
  }).join("\n");
  const system = `أنت محلل أداء إنستغرام لعلامة «متجرلينك» (منصة عُمانية للتجار قبل الإطلاق). ستُعطى أرقام منشورات حقيقية. حلّلها بعمق وأعطِ توصيات عملية دقيقة: أي الصيغ/المواضيع تنجح أكثر، ماذا نكرّر، ماذا نحسّن أو نتجنّب، وأفكار محددة للخطة القادمة. باللهجة العُمانية، عملي ومختصر.
أعد **JSON فقط**: {"advice":[{"title":"<توصية قصيرة>","detail":"<شرح عملي مبني على الأرقام>","action":"<خطوة قابلة للتنفيذ>"}, ... 4-6 عناصر]}`;
  try {
    const raw = await claude.chat([{ role: "user", text: `الأرقام:\n${rows}\n\nحلّل وأعطِ التوصيات. JSON فقط.` }], system, { maxTokens: 2000 });
    let out = null; try { const mm = String(raw || "").match(/\{[\s\S]*\}/); if (mm) out = JSON.parse(mm[0]); } catch (e) {}
    res.json({ ok: true, advice: (out && Array.isArray(out.advice)) ? out.advice : [] });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
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
      fields: [f("WHATSAPP_TOKEN", "Access Token", true), f("WHATSAPP_PHONE_ID", "Phone Number ID")] },
    { key: "gemini", name: "Gemini — توليد الشخصيات (Nano Banana)", icon: "GM", connected: gemini.geminiReady(),
      help: "https://aistudio.google.com/apikey", desc: "توليد شخصيات عُمانية أصيلة تلقائياً كل ليلة (١–٥ص) لصفحة القوالب.",
      fields: [f("GEMINI_API_KEY", "API Key", true)] },
    { key: "apify", name: "Apify — بحث السوق", icon: "AP", connected: apify.apifyReady(),
      help: "https://console.apify.com/account/integrations", desc: "بحث يومي عن ترندات التجارة الإلكترونية من حسابات منافسة لتغذية خطة المحتوى.",
      fields: [f("APIFY_TOKEN", "API Token", true)] }
  ]});
});
app.post("/api/connections", (req, res) => {
  const allowed = ["META_ACCESS_TOKEN", "META_IG_USER_ID", "META_PAGE_ID", "WINDSOR_API_KEY", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "META_GRAPH_VERSION", "AUTO_PUBLISH", "GEMINI_API_KEY", "GEMINI_IMAGE_MODEL", "APIFY_TOKEN", "APIFY_ACTOR"];
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
    publishCompanionStory(item, input.kind, publicBase(req)); // fire-and-forget
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
    // Management approves every design explicitly (silence=consent is OFF). Nothing
    // publishes without an explicit «معتمد» — approved posts then auto-publish at
    // their scheduled plan time.
    if (!approved) continue;
    const when = parseWhen(q.date);
    if (!when) continue;
    const dueAgo = now - when.getTime();
    const input = resolveMedia(q, publicBase());
    if (!input) continue; // needs media (also: don't alert about a post that can't publish)
    // 10-minute heads-up: as a publishable post enters its final window, alert the
    // owner on WhatsApp ONCE so they always have ~10 min to hit ⏸. Only mark it
    // announced if the alert actually SENT — otherwise retry next tick.
    if (dueAgo < 0 && dueAgo > -10 * 60000 && !store.wasAnnounced(q.id)) {
      const mins = Math.max(1, Math.ceil(-dueAgo / 60000));
      const sent = await notifyOwner(`⏰ متجرلينك: «${q.t}» سيُنشر تلقائياً خلال ~${mins} دقيقة. لإيقافه افتح اللوحة واضغط ⏸ على المنشور.`);
      if (sent) store.markAnnounced(q.id);
    }
    if (dueAgo < 0 || dueAgo > STALE_MS) continue; // not due yet, or too stale (publish manually)
    if (publishingNow.has(q.id)) continue; // a manual publish is already in flight
    publishingNow.add(q.id);
    try { const r = await metaPublish.publish(input); store.markPublished(q.id, r); console.log(`[auto-publish] ${q.id} → ${r.permalink || r.id}`); publishCompanionStory(q, input.kind, publicBase()); }
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

// ── Leads CRM ── search · import · auto-classify · WhatsApp/DM outreach ──
const LEAD_SECTORS = [
  ["مطاعم وكافيهات", /مطعم|كافيه|قهوة|مقهى|حلوي|حلا|أكل|مأكولات|food|cafe|restaurant|coffee/i],
  ["أزياء وملابس", /ملابس|أزياء|عباية|دشداشة|بشوت|خياط|فساتين|fashion|cloth|abaya|boutique/i],
  ["إلكترونيات", /جوال|إلكترون|كمبيوتر|لابتوب|هاتف|أجهزة|phone|electro|gadget|laptop/i],
  ["تجميل وعناية", /تجميل|عطور|مكياج|عناية|بشرة|صالون|beauty|perfume|cosmet|salon|spa/i],
  ["هدايا وورود", /هدايا|ورد|زهور|توزيعات|gift|flower|bouquet/i],
  ["بقالة وتموين", /بقالة|تموين|سوبرماركت|market|grocery/i],
  ["خدمات", /خدمة|خدمات|تصميم|تسويق|استشار|صيانة|service|marketing|consult/i],
];
function classifyLead(l) {
  const hay = `${l.name || ""} ${l.note || ""} ${l.field || ""} ${l.source || ""}`;
  let field = (l.field || "").trim();
  if (!field) { const m = LEAD_SECTORS.find(([, rx]) => rx.test(hay)); field = m ? m[0] : "عام"; }
  let activity = "متوسط";
  if (["عميل", "تفاوض"].includes(l.stage)) activity = "نشِط";
  else if (l.stage === "معلّق") activity = "خامل";
  else if ((l.outreach || []).length >= 2) activity = "نشِط";
  return { field, activity };
}
app.get("/api/leads", (req, res) => {
  const { q, stage, source, field } = req.query || {};
  let items = store.getLeads();
  if (q) { const s = String(q).toLowerCase(); items = items.filter((l) => `${l.name} ${l.contact} ${l.note} ${l.field} ${l.source}`.toLowerCase().includes(s)); }
  if (stage && stage !== "all") items = items.filter((l) => l.stage === stage);
  if (source && source !== "all") items = items.filter((l) => l.source === source);
  if (field && field !== "all") items = items.filter((l) => l.field === field);
  res.json({ ok: true, leads: items, total: store.getLeads().length });
});
app.post("/api/leads", (req, res) => {
  const b = req.body || {};
  if (!b.name && !b.contact) return res.status(400).json({ ok: false, error: "name or contact required" });
  const lead = store.addLead({ ...b, ...classifyLead(b) });
  res.json({ ok: true, lead });
});
// Bulk import: accepts {leads:[...]} or {text:"name,contact,note\n..."} (CSV-ish or one-per-line).
app.post("/api/leads/import", (req, res) => {
  const b = req.body || {};
  let rows = Array.isArray(b.leads) ? b.leads : [];
  if (!rows.length && b.text) {
    rows = String(b.text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const parts = line.split(/[,،\t]/).map((s) => s.trim());
      return { name: parts[0] || "", contact: parts[1] || "", note: parts.slice(2).join(" ") || "", source: b.source || "استيراد" };
    });
  }
  if (!rows.length) return res.status(400).json({ ok: false, error: "no rows" });
  const prepared = rows.map((r) => ({ ...r, source: r.source || b.source || "استيراد", ...classifyLead(r) }));
  const added = store.addLeadsBulk(prepared);
  res.json({ ok: true, added: added.length, leads: added });
});
app.put("/api/leads/:id", (req, res) => {
  const patch = req.body || {};
  if (patch.field !== undefined || patch.stage !== undefined) Object.assign(patch, classifyLead({ ...store.getLeads().find((x) => x.id === req.params.id), ...patch }));
  const lead = store.updateLead(req.params.id, patch);
  if (!lead) return res.status(404).json({ ok: false, error: "not found" });
  res.json({ ok: true, lead });
});
app.delete("/api/leads/:id", (req, res) => { store.deleteLead(req.params.id); res.json({ ok: true }); });
// Re-classify every lead (activity + field) in one pass.
app.post("/api/leads/classify", (req, res) => {
  store.getLeads().forEach((l) => store.updateLead(l.id, classifyLead(l)));
  res.json({ ok: true, leads: store.getLeads() });
});
// Outreach: send a WhatsApp message or IG DM to a lead and log it on the record.
app.post("/api/leads/:id/outreach", async (req, res) => {
  const lead = store.getLeads().find((x) => x.id === req.params.id);
  if (!lead) return res.status(404).json({ ok: false, error: "not found" });
  const { message, channel } = req.body || {};
  if (!message) return res.status(400).json({ ok: false, error: "message required" });
  const ch = channel || lead.ch || "whatsapp";
  const isWA = /wa|whats/i.test(ch);
  const ready = isWA ? wa.whatsappReady() : meta.metaReady();
  let simulated = false, result = null, error = null;
  if (!ready) simulated = true;
  else {
    try { result = isWA ? await wa.sendMessage(lead.contact, message) : await meta.sendMessage(lead.contact, message); }
    catch (e) { error = e.message; }
  }
  store.addLeadOutreach(lead.id, { channel: ch, message, simulated, error });
  if (error) return res.status(500).json({ ok: false, error, lead: store.getLeads().find((x) => x.id === lead.id) });
  res.json({ ok: true, simulated, lead: store.getLeads().find((x) => x.id === lead.id) });
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
// Per-deploy build stamp → the app.js/i18n.js URLs get a fresh ?v= on every
// deploy, so browsers (and the network-first SW) never serve a stale bundle.
const BUILD = Date.now().toString(36);
function sendIndex(req, res) {
  let html;
  try { html = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8"); }
  catch (e) { return res.status(500).send("index missing"); }
  html = html.replace('src="/app.js"', `src="/app.js?v=${BUILD}"`);
  res.set("Cache-Control", "no-store");
  res.type("html").send(html);
}
app.use(express.static(path.join(__dirname, "public"), { index: false })); // "/" handled below (with version injection)
app.get("*", sendIndex);

app.listen(PORT, () => {
  console.log(`\n  MatjarLink Ops Platform`);
  console.log(`  ▸ http://localhost:${PORT}   (MODE=${MODE})`);
  console.log(`  ▸ Meta: ${meta.metaReady() ? "✓ ready" : "— add META_ACCESS_TOKEN"}`);
  console.log(`  ▸ WhatsApp: ${wa.whatsappReady() ? "✓ ready" : "— add WHATSAPP_TOKEN"}`);
  console.log(`  ▸ Windsor: ${windsor.windsorReady() ? "✓ ready" : "— add WINDSOR_API_KEY"}`);
  console.log(`  ▸ Publish: ${metaPublish.publishReady() ? `✓ ready (auto-publish ${AUTO() ? "ON" : "off"})` : "— needs Meta token"}\n`);
});
