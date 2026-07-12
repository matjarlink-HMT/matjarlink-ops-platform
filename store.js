// Shared notes/approvals store — persisted to a JSON file so all users/devices
// hitting this server see the same review state (Ibrahim + Marwa).
// Note: on Railway the filesystem resets on redeploy; attach a Volume mounted at
// /data and set NOTES_FILE=/data/notes.json for persistence across deploys.
import fs from "node:fs";

const FILE = process.env.NOTES_FILE || new URL("./data/notes.json", import.meta.url).pathname;
let mem = {};
try { mem = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { mem = {}; }

function persist() { try { fs.writeFileSync(FILE, JSON.stringify(mem)); } catch (e) { /* ephemeral fs */ } }

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
