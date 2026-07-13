// Shared notes/approvals store — persisted to a JSON file so all users/devices
// hitting this server see the same review state (Ibrahim + Marwa).
// Note: on Railway the filesystem resets on redeploy; attach a Volume mounted at
// /data and set NOTES_FILE=/data/notes.json for persistence across deploys.
import fs from "node:fs";

const FILE = process.env.NOTES_FILE || new URL("./data/notes.json", import.meta.url).pathname;
let mem = {};
try { mem = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { mem = {}; }

function persist() { try { fs.writeFileSync(FILE, JSON.stringify(mem)); } catch (e) { /* ephemeral fs */ } }

// ── Runtime integration config (API keys pasted via the Connections page) ──
// Persisted separately; on Railway attach a Volume for persistence across deploys.
const CFG_FILE = process.env.CONFIG_FILE || new URL("./data/config.json", import.meta.url).pathname;
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(CFG_FILE, "utf8")); } catch (e) { cfg = {}; }
function persistCfg() { try { fs.writeFileSync(CFG_FILE, JSON.stringify(cfg)); } catch (e) {} }
// Resolve a key: environment variable wins, then runtime config.
export function cfgGet(key) { return process.env[key] || cfg[key] || ""; }
export function cfgSet(map) { for (const k in map) { if (map[k] === "" || map[k] == null) delete cfg[k]; else cfg[k] = map[k]; } persistCfg(); }
export function cfgHas(key) { return Boolean(cfgGet(key)); }

// ── Manager chat history (CAIMO) ── persisted; capped to the last 60 turns.
const CHAT_FILE = process.env.CHAT_FILE || new URL("./data/chat.json", import.meta.url).pathname;
let chat = [];
try { chat = JSON.parse(fs.readFileSync(CHAT_FILE, "utf8")); } catch (e) { chat = []; }
function persistChat() { try { fs.writeFileSync(CHAT_FILE, JSON.stringify(chat)); } catch (e) {} }
export function getChat() { return chat; }
export function addChat(role, text) { chat.push({ role, text, at: new Date().toISOString() }); if (chat.length > 60) chat = chat.slice(-60); persistChat(); return chat; }
export function resetChat() { chat = []; persistChat(); return chat; }

export function getNotes() { return mem; }
export function setNote(id, value, status) {
  if (value && value.trim()) mem[id] = { note: value.trim(), status: status || "قيد التعديل", at: new Date().toISOString() };
  else delete mem[id];
  persist();
  return mem;
}
export function approve(id) {
  mem[id] = { note: "", status: "معتمد", at: new Date().toISOString() };
  persist();
  return mem;
}
