// Stock-photo integration (Pexels) — fetches a topic-relevant photo for the
// design's rounded photo window. Free API key: https://www.pexels.com/api/ →
// PEXELS_API_KEY. Returns an image Buffer, or null (design falls back to the
// text-only brand card).
//
// Quality upgrades (overnight research, verified against the Pexels docs):
// - orientation=landscape — the design's photo window is ~2:1 landscape; the
//   old portrait fetch cropped ~60% of every image (usually the subject).
// - size=large (≥24MP source) + per_page=20 for real choice.
// - Brand-fit scoring instead of a blind pick: avg_color warmth (plum/orange
//   world) scores up, green/cyan clashes score down, alt-text keyword match
//   scores up, tiny images are excluded. Deterministic pick from the top 3.
// - Curated query fallbacks: Claude's niche queries (e.g. "omani merchant
//   store") often have zero Pexels coverage — a keyword-mapped dictionary of
//   proven queries kicks in, then a generic retail default. The design should
//   only lose its photo by decision, not by a dry search.
const KEY = () => process.env.PEXELS_API_KEY || "";
export const photoReady = () => Boolean(KEY());

const CURATED = [
  [/oman|muscat|mutrah|nizwa|عمان|مسقط/i, ["muscat oman city", "oman architecture", "arabian souk market"]],
  [/merchant|shop owner|store owner|vendor|تاجر/i, ["arab shop owner", "small business owner store", "middle eastern market vendor"]],
  [/cashier|pos|point of sale|كاشير/i, ["card payment terminal", "cashier register store", "contactless payment shop"]],
  [/delivery|shipping|courier|packag|شحن|توصيل/i, ["courier delivering package", "delivery boxes doorstep", "online order packaging"]],
  [/online|ecommerce|shopping|متجر إلكتروني/i, ["online shopping smartphone", "ecommerce laptop shopping", "small business owner laptop"]],
  [/accounting|finance|محاسبة/i, ["business accounting calculator", "small business finances desk"]],
  [/perfume|عطور/i, ["perfume bottles shop", "luxury perfume store"]],
  [/coffee|قهوة/i, ["arabic coffee shop", "coffee shop counter"]],
];
const DEFAULTS = ["modern retail store interior", "online shopping flat lay", "small business owner smiling"];

async function search(q) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=landscape&size=large&per_page=20&locale=en-US`;
  const r = await fetch(url, { headers: { Authorization: KEY() } });
  if (!r.ok) { console.error("[pexels]", r.status, q); return []; }
  return ((await r.json()).photos) || [];
}

// Brand-fit score: warm/neutral avg_color up, green/cyan down, alt match up.
function score(p, q) {
  let s = 0;
  if ((p.width || 0) < 1200) return -99;
  const hex = (p.avg_color || "").replace("#", "");
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; }
    const sat = mx ? d / mx : 0;
    if (sat < 0.15) s += 1;                       // near-neutral sits well on white
    else if (h >= 15 && h <= 55) s += 2;          // warm amber/orange world
    else if (h >= 70 && h <= 200) s -= 2;         // green/cyan clashes with plum
  }
  const alt = (p.alt || "").toLowerCase();
  if (q.toLowerCase().split(/\s+/).some((w) => w.length > 3 && alt.includes(w))) s += 1;
  return s;
}

async function pickAndFetch(q) {
  const photos = (await search(q)).map((p) => ({ p, s: score(p, q) })).filter((x) => x.s > -99);
  if (!photos.length) return null;
  photos.sort((a, b) => b.s - a.s);
  const top = photos.slice(0, 3);
  const pick = top[q.length % top.length].p; // deterministic variety, no Math.random
  // large2x (~1880px) fits the 840px-wide window with retina headroom; landscape crop as fallback
  const src = pick.src.large2x || pick.src.large || pick.src.landscape || pick.src.original;
  const img = await fetch(src);
  if (!img.ok) return null;
  return Buffer.from(await img.arrayBuffer());
}

export async function fetchPhoto(query) {
  const q = (query || "").trim();
  if (!KEY() || !q) return null;
  try {
    // 1) Claude's query as-is → 2) curated equivalents → 3) generic default
    let buf = await pickAndFetch(q);
    if (buf) return buf;
    for (const [re, alts] of CURATED) {
      if (re.test(q)) {
        for (const alt of alts) { buf = await pickAndFetch(alt); if (buf) return buf; }
        break;
      }
    }
    return await pickAndFetch(DEFAULTS[q.length % DEFAULTS.length]);
  } catch (e) { console.error("[pexels]", e.message); return null; }
}
