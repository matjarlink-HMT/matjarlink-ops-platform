// Content engine bridge — Claude (this session, the dashboard buttons, or the
// server schedulers) generates the plan + posts and writes them here. The
// dashboard reads this file and merges generated items into the queue, so new
// content appears automatically without touching the seed.
//
// Persistence: reads/writes CONTENT_FILE (set it to a path on a Railway Volume,
// e.g. /data/content.json, so platform-generated content survives redeploys).
// If CONTENT_FILE doesn't exist yet, we fall back to the committed repo copy so
// a fresh Volume starts from the checked-in baseline.
import fs from "node:fs";

const REPO_FILE = new URL("./content.json", import.meta.url).pathname;
const FILE = process.env.CONTENT_FILE || REPO_FILE;

function readFrom(path) { try { return JSON.parse(fs.readFileSync(path, "utf8")); } catch (e) { return null; } }

export function loadContent() {
  return readFrom(FILE) || (FILE !== REPO_FILE ? readFrom(REPO_FILE) : null);
}

export function saveContent(data) {
  try { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); return true; }
  catch (e) { console.error("[content] save failed:", e.message); return false; }
}

// Append a generated post to the queue (dedup by id). Returns the saved doc.
export function appendPost(post) {
  const doc = loadContent() || { batch: null, generatedAt: null, plan: null, queue: [] };
  doc.queue = doc.queue || [];
  if (!doc.queue.some(q => q.id === post.id)) doc.queue.push(post);
  doc.generatedAt = post.date || doc.generatedAt;
  saveContent(doc);
  return doc;
}

// Highest MJ-### number across seed + generated content (for the next id).
export function nextIdNum(seedQueue = []) {
  const doc = loadContent();
  const ids = [...(seedQueue || []), ...((doc && doc.queue) || [])].map(q => parseInt((q.id || "").replace(/\D/g, ""), 10)).filter(n => !isNaN(n));
  return (ids.length ? Math.max(...ids) : 0) + 1;
}
