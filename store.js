// Shared notes/approvals store — persisted to JSON files so all users/devices
// hitting this server see the same review state (Ibrahim + Marwa).
// Persistence: attach a Railway Volume at /data; files are written under
// /data/store (a subdirectory — see note below). The old per-file *_FILE env
// vars are no longer used.
import fs from "node:fs";
import path from "node:path";

// All persistent stores live in one dir. On Railway use a SUBDIRECTORY of the
// Volume (/data/store) — direct file writes at the volume-mount root (/data/x)
// can silently fail, while subdirectories are reliably writable. mkdir ensures it.
const STORE_DIR = fs.existsSync("/data") ? "/data/store" : new URL("./data", import.meta.url).pathname;
try { fs.mkdirSync(STORE_DIR, { recursive: true }); } catch (e) {}
const sp = (name) => path.join(STORE_DIR, name);

const FILE = sp("notes.json");
let mem = {};
try { mem = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { mem = {}; }

function persist() { try { fs.writeFileSync(FILE, JSON.stringify(mem)); } catch (e) { /* ephemeral fs */ } }

// ── Runtime integration config (API keys pasted via the Connections page) ──
// Persisted separately; on Railway attach a Volume for persistence across deploys.
const CFG_FILE = sp("config.json");
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(CFG_FILE, "utf8")); } catch (e) { cfg = {}; }
function persistCfg() { try { fs.writeFileSync(CFG_FILE, JSON.stringify(cfg)); } catch (e) {} }
// Resolve a key: environment variable wins, then runtime config.
export function cfgGet(key) { return process.env[key] || cfg[key] || ""; }
export function cfgSet(map) { for (const k in map) { if (map[k] === "" || map[k] == null) delete cfg[k]; else cfg[k] = map[k]; } persistCfg(); }
export function cfgHas(key) { return Boolean(cfgGet(key)); }

// ── Manager chat history (CAIMO) ── persisted; capped to the last 60 turns.
const CHAT_FILE = sp("chat.json");
let chat = [];
try { chat = JSON.parse(fs.readFileSync(CHAT_FILE, "utf8")); } catch (e) { chat = []; }
function persistChat() { try { fs.writeFileSync(CHAT_FILE, JSON.stringify(chat)); } catch (e) {} }
export function getChat() { return chat; }
export function addChat(role, text) { chat.push({ role, text, at: new Date().toISOString() }); if (chat.length > 60) chat = chat.slice(-60); persistChat(); return chat; }
export function resetChat() { chat = []; persistChat(); return chat; }

// ── Published log ── which queue ids were pushed to Instagram (avoid double-post).
const PUB_FILE = sp("published.json");
let pub = {};
try { pub = JSON.parse(fs.readFileSync(PUB_FILE, "utf8")); } catch (e) { pub = {}; }
function persistPub() { try { fs.writeFileSync(PUB_FILE, JSON.stringify(pub)); } catch (e) {} }
export function getPublished() { return pub; }
export function isPublished(id) { return Boolean(pub[id]); }
export function markPublished(id, result) { pub[id] = { ...result, id, at: result?.at || new Date().toISOString() }; persistPub(); return pub; }
export function unpublish(id) { delete pub[id]; persistPub(); return pub; } // clear the published flag so a post can be re-published

export function getNotes() { return mem; }
export function setNote(id, value, status) {
  const v = value && value.trim();
  const cur = mem[id] || {};
  if (v) { cur.note = v; cur.status = status || cur.status || "قيد التعديل"; cur.at = new Date().toISOString(); mem[id] = cur; }
  else if (cur.thread?.length || cur.status === "معتمد") { cur.note = ""; mem[id] = cur; } // keep approval / thread
  else delete mem[id];
  persist();
  return mem;
}
export function approve(id) {
  const cur = mem[id] || {};
  cur.status = "معتمد"; cur.note = cur.note || ""; cur.at = new Date().toISOString();
  mem[id] = cur;
  persist();
  return mem;
}

// ── Per-post note thread ── owner ⇄ CAIMO conversation about a single post.
export function getPostThread(id) { return (mem[id] && mem[id].thread) || []; }
export function addPostNote(id, role, text) {
  const t = text && text.trim(); if (!t) return getPostThread(id);
  const cur = mem[id] || {};
  cur.thread = cur.thread || [];
  cur.thread.push({ role, text: t, at: new Date().toISOString() });
  if (cur.thread.length > 40) cur.thread = cur.thread.slice(-40);
  if (role === "user") { cur.note = t; cur.status = cur.status || "قيد التعديل"; }
  cur.at = new Date().toISOString();
  mem[id] = cur; persist();
  return cur.thread;
}

// ── Post content overrides ── Claude-regenerated title/caption/brief per post
// (applies to seed July posts too, which aren't in content.json). Volume-ready.
const OV_FILE = sp("overrides.json");
let ov = {};
try { ov = JSON.parse(fs.readFileSync(OV_FILE, "utf8")); } catch (e) { ov = {}; }
function persistOv() { try { fs.writeFileSync(OV_FILE, JSON.stringify(ov)); } catch (e) {} }
export function getOverrides() { return ov; }
export function setOverride(id, patch) {
  ov[id] = { ...(ov[id] || {}), ...patch, at: new Date().toISOString(), regens: ((ov[id] || {}).regens || 0) + 1 };
  persistOv();
  return ov[id];
}

// ── Removed posts ── ids hidden from the queue (delete button). Volume-backed.
const RM_FILE = sp("removed.json");
let rm = [];
try { rm = JSON.parse(fs.readFileSync(RM_FILE, "utf8")); } catch (e) { rm = []; }
function persistRm() { try { fs.writeFileSync(RM_FILE, JSON.stringify(rm)); } catch (e) {} }
export function getRemoved() { return rm; }
export function removePost(id) { if (id && !rm.includes(id)) rm.push(id); persistRm(); return rm; }
export function restorePost(id) { rm = rm.filter((x) => x !== id); persistRm(); return rm; }

// ── Agent self-improvement state ── approved suggestions raise the agent's level.
const AG_FILE = sp("agents_state.json");
let ag = {};
try { ag = JSON.parse(fs.readFileSync(AG_FILE, "utf8")); } catch (e) { ag = {}; }
function persistAg() { try { fs.writeFileSync(AG_FILE, JSON.stringify(ag)); } catch (e) {} }
export function getAgentState() { return ag; }
export function applyAgentImprovement(name, patch) {
  const cur = ag[name] || { improvements: 0 };
  ag[name] = { ...cur, ...patch, improvements: (cur.improvements || 0) + 1, at: new Date().toISOString() };
  persistAg();
  return ag[name];
}
