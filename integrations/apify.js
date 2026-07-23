// Apify integration — daily market research. Scrapes a handful of recent posts
// from owner-chosen competitor/relevant Instagram accounts so the content plan
// can be informed by what's actually working in the Omani e-commerce space.
// The owner pastes an Apify API token as APIFY_TOKEN (Connections page).
import * as store from "../store.js";

const TOKEN = () => store.cfgGet("APIFY_TOKEN");
// Default IG scraper actor; override with APIFY_ACTOR if desired (user~actor form).
export const defaultActor = () => store.cfgGet("APIFY_ACTOR") || "apify/instagram-scraper";
export const apifyReady = () => Boolean(TOKEN());

// Run an actor synchronously and return its dataset items (array). Throws on error.
export async function runActor(input, actorId) {
  const token = TOKEN();
  if (!token) throw new Error("APIFY_TOKEN not set");
  const act = (actorId || defaultActor()).replace("/", "~");
  const url = `https://api.apify.com/v2/acts/${act}/run-sync-get-dataset-items?token=${token}`;
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!r.ok) {
    let msg = `${r.status}`;
    try { const j = await r.json(); msg = j.error?.message || msg; } catch (e) {}
    throw new Error(`apify ${msg}`);
  }
  return await r.json();
}

// Scrape recent posts from the given IG usernames (no @). Returns raw items.
export async function scrapeAccounts(usernames, perAccount = 6) {
  const urls = (usernames || []).map((u) => `https://www.instagram.com/${String(u).replace(/^@/, "").trim()}/`);
  if (!urls.length) return [];
  return runActor({ directUrls: urls, resultsType: "posts", resultsLimit: perAccount, addParentData: false });
}
