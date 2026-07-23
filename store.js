// Shared notes/approvals store — persisted to JSON files so all users/devices
// hitting this server see the same review state (الإدارة).
// Persistence: attach a Railway Volume at /data; files are written under
// /data/store (a subdirectory — see note below). The old per-file *_FILE env
// vars are no longer used.
import fs from "node:fs";
import path from "node:path";

// All persistent stores live in one dir, under the Railway Volume. Railway sets
// RAILWAY_VOLUME_MOUNT_PATH to where the volume is actually mounted — use it
// verbatim (a hardcoded /data can be the wrong path, making writes ephemeral).
// Write to a SUBDIRECTORY (…/store) since some mounts reject root-level files.
export const VOL_BASE = process.env.RAILWAY_VOLUME_MOUNT_PATH || (fs.existsSync("/data") ? "/data" : "");
const STORE_DIR = VOL_BASE ? path.join(VOL_BASE, "store") : new URL("./data", import.meta.url).pathname;
try { fs.mkdirSync(STORE_DIR, { recursive: true }); } catch (e) {}
const sp = (name) => path.join(STORE_DIR, name);

// Durable write: writeFileSync alone leaves data in the page cache, which a
// Railway redeploy (container kill) can drop before it reaches the Volume.
// fsync forces it to disk so approvals / overrides survive redeploys.
function writeDurable(file, str) {
  const fd = fs.openSync(file, "w");
  try { fs.writeSync(fd, str); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

const FILE = sp("notes.json");
let mem = {};
try { mem = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { mem = {}; }

function persist() { try { writeDurable(FILE, JSON.stringify(mem)); } catch (e) { /* ephemeral fs */ } }

// ── Runtime integration config (API keys pasted via the Connections page) ──
// Persisted separately; on Railway attach a Volume for persistence across deploys.
const CFG_FILE = sp("config.json");
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(CFG_FILE, "utf8")); } catch (e) { cfg = {}; }
function persistCfg() { try { writeDurable(CFG_FILE, JSON.stringify(cfg)); } catch (e) {} }
// Resolve a key: environment variable wins, then runtime config.
export function cfgGet(key) { return process.env[key] || cfg[key] || ""; }
export function cfgSet(map) { for (const k in map) { if (map[k] === "" || map[k] == null) delete cfg[k]; else cfg[k] = map[k]; } persistCfg(); }
export function cfgHas(key) { return Boolean(cfgGet(key)); }

// ── Manager chat history (CAIMO) ── persisted; capped to the last 60 turns.
const CHAT_FILE = sp("chat.json");
let chat = [];
try { chat = JSON.parse(fs.readFileSync(CHAT_FILE, "utf8")); } catch (e) { chat = []; }
function persistChat() { try { writeDurable(CHAT_FILE, JSON.stringify(chat)); } catch (e) {} }
export function getChat() { return chat; }
export function addChat(role, text) { chat.push({ role, text, at: new Date().toISOString() }); if (chat.length > 60) chat = chat.slice(-60); persistChat(); return chat; }
export function resetChat() { chat = []; persistChat(); return chat; }

// ── Published log ── which queue ids were pushed to Instagram (avoid double-post).
const PUB_FILE = sp("published.json");
let pub = {};
try { pub = JSON.parse(fs.readFileSync(PUB_FILE, "utf8")); } catch (e) { pub = {}; }
function persistPub() { try { writeDurable(PUB_FILE, JSON.stringify(pub)); } catch (e) {} }
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
function persistOv() { try { writeDurable(OV_FILE, JSON.stringify(ov)); } catch (e) {} }
export function getOverrides() { return ov; }
export function setOverride(id, patch) {
  ov[id] = { ...(ov[id] || {}), ...patch, at: new Date().toISOString(), regens: ((ov[id] || {}).regens || 0) + 1 };
  persistOv();
  return ov[id];
}
export function clearOverride(id) { if (ov[id]) { delete ov[id]; persistOv(); } return true; }

// ── Hook preferences ── titles the owner picked (A/B), to steer future writing.
const PREF_FILE = sp("hookprefs.json");
let prefs = [];
try { prefs = JSON.parse(fs.readFileSync(PREF_FILE, "utf8")); } catch (e) { prefs = []; }
export function getHookPrefs() { return prefs; }
export function addHookPref(text) {
  const t = String(text || "").trim(); if (!t) return prefs;
  prefs = [t, ...prefs.filter((x) => x !== t)].slice(0, 12); // most-recent first, dedup
  try { writeDurable(PREF_FILE, JSON.stringify(prefs)); } catch (e) {}
  return prefs;
}
// A short line for generation prompts so writing leans toward the owner's taste.
export function hookPrefLine() {
  return prefs.length ? `أمثلة عناوين فضّلها المالك سابقاً (حاكِ أسلوبها وإيقاعها لا نصّها): ${prefs.slice(0, 6).map((p) => `«${p}»`).join(" · ")}.` : "";
}

// ── Pre-publish announcements ── ids the owner was already alerted about (T-10m).
const ANN_FILE = sp("announced.json");
let announced = {};
try { announced = JSON.parse(fs.readFileSync(ANN_FILE, "utf8")); } catch (e) { announced = {}; }
export function wasAnnounced(id) { return Boolean(announced[id]); }
export function markAnnounced(id) { announced[id] = new Date().toISOString(); try { writeDurable(ANN_FILE, JSON.stringify(announced)); } catch (e) {} }

// ── Content plans ── editable monthly plans keyed by "YYYY-MM". Volume-backed.
// Migrates the old single plan.json into the keyed map on first load.
const PLANS_FILE = sp("plans.json");
let plans = {};
try { plans = JSON.parse(fs.readFileSync(PLANS_FILE, "utf8")); } catch (e) {
  try { const old = JSON.parse(fs.readFileSync(sp("plan.json"), "utf8")); if (old && old.year) plans[`${old.year}-${String(old.month).padStart(2, "0")}`] = old; } catch (e2) {}
}
function persistPlans() { try { writeDurable(PLANS_FILE, JSON.stringify(plans)); } catch (e) {} }
const planKey = (p) => `${p.year}-${String(p.month).padStart(2, "0")}`;
export function getPlans() { return plans; }
export function getPlan(key) {
  if (key) { const m = String(key).match(/^(\d{4})-(\d{1,2})$/); const norm = m ? `${m[1]}-${m[2].padStart(2, "0")}` : key; return plans[norm] || plans[key] || null; }
  const keys = Object.keys(plans).sort(); // no key → latest month
  return keys.length ? plans[keys[keys.length - 1]] : null;
}
export function setPlan(p) { if (!p || !p.year) return p; plans[planKey(p)] = p; persistPlans(); return p; }

// ── Removed posts ── ids hidden from the queue (delete button). Volume-backed.
const RM_FILE = sp("removed.json");
let rm = [];
try { rm = JSON.parse(fs.readFileSync(RM_FILE, "utf8")); } catch (e) { rm = []; }
function persistRm() { try { writeDurable(RM_FILE, JSON.stringify(rm)); } catch (e) {} }
export function getRemoved() { return rm; }
export function removePost(id) { if (id && !rm.includes(id)) rm.push(id); persistRm(); return rm; }
export function restorePost(id) { rm = rm.filter((x) => x !== id); persistRm(); return rm; }

// ── Studio drafts ── instantly-designed posts awaiting publish/schedule/download.
// Kept out of the main queue so regenerating doesn't clutter it; committed to the
// queue only when the owner publishes or schedules. Capped to the last 40.
const STU_FILE = sp("studio.json");
let stu = {};
try { stu = JSON.parse(fs.readFileSync(STU_FILE, "utf8")); } catch (e) { stu = {}; }
function persistStu() { try { writeDurable(STU_FILE, JSON.stringify(stu)); } catch (e) {} }
export function getStudioDrafts() { return stu; }
export function getStudioDraft(id) { return stu[id] || null; }
export function saveStudioDraft(d) {
  if (!d || !d.id) return d;
  stu[d.id] = { ...d, at: d.at || new Date().toISOString() };
  const ids = Object.keys(stu);
  if (ids.length > 40) { ids.sort((a, b) => (stu[a].at || "").localeCompare(stu[b].at || "")); for (const id of ids.slice(0, ids.length - 40)) delete stu[id]; }
  persistStu(); return stu[d.id];
}
export function deleteStudioDraft(id) { if (stu[id]) { delete stu[id]; persistStu(); } return true; }

// ── Nightly proposals ── template + character ideas invented 1–5AM for approval.
// A proposal: { id, kind:'template'|'character', status:'pending'|'approved'|'rejected',
//   createdAt, previewUrl, ...(template: base,accent,name) | (character: label,dress,prompt,file) }
const PROP_FILE = sp("proposals.json");
let props = {};
try { props = JSON.parse(fs.readFileSync(PROP_FILE, "utf8")); } catch (e) { props = {}; }
function persistProps() { try { writeDurable(PROP_FILE, JSON.stringify(props)); } catch (e) {} }
export function getProposals() { return props; }
export function saveProposal(p) {
  if (!p || !p.id) return p;
  props[p.id] = { status: "pending", createdAt: new Date().toISOString(), ...props[p.id], ...p };
  // keep only the last 60 to bound the file
  const ids = Object.keys(props);
  if (ids.length > 60) { ids.sort((a, b) => (props[a].createdAt || "").localeCompare(props[b].createdAt || "")); for (const id of ids.slice(0, ids.length - 60)) delete props[id]; }
  persistProps(); return props[p.id];
}
export function setProposalStatus(id, status) { if (props[id]) { props[id].status = status; persistProps(); } return props[id]; }

// ── Hidden items ── soft-delete for approved templates/characters (builtin or
// custom). A deleted id is hidden from the lists but kept for undo. cfg-backed.
export function getHidden(kind) { return String(cfgGet("HIDDEN_" + kind) || "").split(",").filter(Boolean); }
export function isHidden(kind, id) { return getHidden(kind).includes(id); }
export function hideItem(kind, id) { const s = new Set(getHidden(kind)); s.add(id); cfgSet({ ["HIDDEN_" + kind]: [...s].join(",") }); }
export function unhideItem(kind, id) { const s = new Set(getHidden(kind)); s.delete(id); cfgSet({ ["HIDDEN_" + kind]: [...s].join(",") }); }
export function removeCustomTemplate(id) { const i = ctpl.findIndex((t) => t.id === id); if (i >= 0) { ctpl.splice(i, 1); persistCtpl(); } }
export function removeCustomCharacter(id) { const i = cchar.findIndex((c) => c.id === id); if (i >= 0) { cchar.splice(i, 1); persistCchar(); } }

// ── Brand data ── business info inserted into designs (footer). cfg-backed.
export function getBrandData() {
  return {
    instagram: cfgGet("BIZ_IG") || "matjarlink",
    phone: cfgGet("BIZ_PHONE") || "97426620",
    email: cfgGet("BIZ_EMAIL") || "",
    website: cfgGet("BIZ_WEB") || "",
    whatsapp: cfgGet("BIZ_WA") || "",
  };
}

// ── Fresh start ── wipe content-state (plans, studio drafts, proposals, content
// overrides, review notes) for a clean rebuild under a new identity. Keeps cfg
// (API keys), characters, custom templates, and the published log.
export function resetForFreshStart() {
  plans = {}; persistPlans();
  stu = {}; persistStu();
  props = {}; persistProps();
  ov = {}; persistOv();
  mem = {}; persist();
  return { ok: true };
}
export function nightlyRanOn() { return cfgGet("NIGHTLY_LAST") || ""; }
export function markNightlyRan(dateStr) { cfgSet({ NIGHTLY_LAST: dateStr }); }

// ── Custom (approved) templates & characters ── data-driven, layered on the builtins.
const CTPL_FILE = sp("custom_templates.json");
let ctpl = [];
try { ctpl = JSON.parse(fs.readFileSync(CTPL_FILE, "utf8")); } catch (e) { ctpl = []; }
function persistCtpl() { try { writeDurable(CTPL_FILE, JSON.stringify(ctpl)); } catch (e) {} }
export function getCustomTemplates() { return ctpl; }
export function addCustomTemplate(t) { if (t && t.id && !ctpl.find((x) => x.id === t.id)) { ctpl.push(t); persistCtpl(); } return ctpl; }

const CCHAR_FILE = sp("custom_characters.json");
let cchar = [];
try { cchar = JSON.parse(fs.readFileSync(CCHAR_FILE, "utf8")); } catch (e) { cchar = []; }
function persistCchar() { try { writeDurable(CCHAR_FILE, JSON.stringify(cchar)); } catch (e) {} }
export function getCustomCharacters() { return cchar; }
export function addCustomCharacter(c) { if (c && c.id && !cchar.find((x) => x.id === c.id)) { cchar.push(c); persistCchar(); } return cchar; }

// ── Leads (CRM) ── searchable, importable, auto-classified, with an outreach log.
// Real customer data → survives resetForFreshStart (not wiped on a fresh identity).
const LEADS_FILE = sp("leads.json");
let leads = [];
try { leads = JSON.parse(fs.readFileSync(LEADS_FILE, "utf8")); } catch (e) { leads = []; }
function persistLeads() { try { writeDurable(LEADS_FILE, JSON.stringify(leads)); } catch (e) {} }
const newLeadId = () => "LD-" + Math.random().toString(36).slice(2, 8).toUpperCase();
function normLead(l) {
  return {
    id: l.id || newLeadId(),
    name: (l.name || "").trim(), ch: l.ch || "whatsapp", contact: (l.contact || "").trim(),
    stage: l.stage || "جديد", field: (l.field || "").trim(), activity: l.activity || "",
    source: (l.source || "").trim(), note: (l.note || "").trim(), tm: l.tm || "",
    createdAt: l.createdAt || new Date().toISOString(), outreach: l.outreach || [],
  };
}
export function getLeads() { return leads; }
export function addLead(l) { const lead = normLead(l); leads.unshift(lead); persistLeads(); return lead; }
export function addLeadsBulk(arr) { const added = (arr || []).map(normLead); leads = [...added, ...leads]; persistLeads(); return added; }
export function updateLead(id, patch) { const l = leads.find((x) => x.id === id); if (!l) return null; Object.assign(l, patch); persistLeads(); return l; }
export function deleteLead(id) { leads = leads.filter((x) => x.id !== id); persistLeads(); return true; }
export function addLeadOutreach(id, entry) { const l = leads.find((x) => x.id === id); if (!l) return null; (l.outreach = l.outreach || []).unshift({ ...entry, at: new Date().toISOString() }); persistLeads(); return l; }

// ── Agent self-improvement state ── approved suggestions raise the agent's level.
const AG_FILE = sp("agents_state.json");
let ag = {};
try { ag = JSON.parse(fs.readFileSync(AG_FILE, "utf8")); } catch (e) { ag = {}; }
function persistAg() { try { writeDurable(AG_FILE, JSON.stringify(ag)); } catch (e) {} }
export function getAgentState() { return ag; }
export function applyAgentImprovement(name, patch) {
  const cur = ag[name] || { improvements: 0, changelog: [] };
  const at = new Date().toISOString();
  // Record what was actually applied so approval visibly changes state and the
  // same suggestion is never re-requested (the changelog is the memory).
  const changelog = [{ at, applied: patch.appliedFrom || cur.sug || "", became: patch.task || "" }, ...(cur.changelog || [])].slice(0, 12);
  const { appliedFrom, ...clean } = patch;
  ag[name] = { ...cur, ...clean, improvements: (cur.improvements || 0) + 1, at, changelog };
  persistAg();
  return ag[name];
}

// Diagnostics for the persistence audit endpoint.
export function debug() {
  let files = [];
  try { files = fs.readdirSync(STORE_DIR).map((f) => { const st = fs.statSync(path.join(STORE_DIR, f)); return `${f} · ${st.size}b · ${st.mtime.toISOString().slice(5, 19)}`; }); }
  catch (e) { files = ["<readdir failed: " + e.message + ">"]; }
  return { storeDir: STORE_DIR, files, counts: { notes: Object.keys(mem).length, overrides: Object.keys(ov).length, published: Object.keys(pub).length, removed: rm.length } };
}
