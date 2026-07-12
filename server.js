import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { baseState } from "./data/seed.js";
import { getAnalytics } from "./data/analytics.js";
import * as store from "./store.js";
import * as meta from "./integrations/meta.js";
import * as windsor from "./integrations/windsor.js";
import * as wa from "./integrations/whatsapp.js";

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
  state.mode = MODE;
  state.generatedAt = new Date().toISOString();
  state.connectivity = { meta: meta.metaReady(), whatsapp: wa.whatsappReady(), windsor: windsor.windsorReady() };

  if (MODE === "live") {
    const settle = async (p, fb) => { try { return await p; } catch (e) { console.error(e.message); return fb; } };
    const [comments, igMsgs, published, insights] = await Promise.all([
      settle(meta.getComments(), []),
      settle(meta.getMessages(), []),
      settle(meta.getPublished(), []),
      settle(windsor.getInsights(), null)
    ]);
    const waMsgs = wa.getMessages();
    if (comments.length) state.comments = comments;
    const merged = [...igMsgs, ...waMsgs];
    if (merged.length) state.messages = merged;
    if (published.length) state.published = published;
    state.insights = insights;
  }
  state.notes = store.getNotes();
  res.json(state);
});

// ── Per-platform analytics ──────────────────────────────────────────
app.get("/api/analytics", async (req, res) => {
  const range = req.query.range === "30d" ? "30d" : "7d";
  let windsorData = null;
  if (MODE === "live") { try { windsorData = await windsor.getInsights(); } catch (e) { /* fall back to mock */ } }
  res.json(getAnalytics(range, windsorData));
});

// ── Shared review notes / approvals ─────────────────────────────────
app.get("/api/notes", (req, res) => res.json(store.getNotes()));
app.post("/api/notes", (req, res) => {
  const { id, note, action } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, error: "id required" });
  if (action === "approve") return res.json({ ok: true, notes: store.approve(id) });
  res.json({ ok: true, notes: store.setNote(id, note || "") });
});

// ── Reply router ────────────────────────────────────────────────────
app.post("/api/reply", async (req, res) => {
  const { channel, target, message, kind } = req.body || {};
  if (!message || !target) return res.status(400).json({ ok: false, error: "target & message required" });
  if (MODE !== "live") return res.json({ ok: true, simulated: true });
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

// ── Static dashboard ────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`\n  MatjarLink Ops Platform`);
  console.log(`  ▸ http://localhost:${PORT}   (MODE=${MODE})`);
  console.log(`  ▸ Meta: ${meta.metaReady() ? "✓ ready" : "— add META_ACCESS_TOKEN"}`);
  console.log(`  ▸ WhatsApp: ${wa.whatsappReady() ? "✓ ready" : "— add WHATSAPP_TOKEN"}`);
  console.log(`  ▸ Windsor: ${windsor.windsorReady() ? "✓ ready" : "— add WINDSOR_API_KEY"}\n`);
});
