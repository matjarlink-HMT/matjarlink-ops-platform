// Content engine bridge — Claude (this session or a scheduled routine) generates
// the plan + captions and writes them to content.json. The dashboard reads this
// file and merges the generated items into the queue/prep, so new content appears
// automatically without touching the seed. Designs stay with the design agent
// (each item carries a `brief` for them; `drive` is filled once the visual is ready).
import fs from "node:fs";

const FILE = process.env.CONTENT_FILE || new URL("./content.json", import.meta.url).pathname;

export function loadContent() {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { return null; }
}
