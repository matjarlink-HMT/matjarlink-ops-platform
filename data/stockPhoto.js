// Stock-photo integration (Pexels) — fetches a topic-relevant photo for a design
// background. Free API key: https://www.pexels.com/api/ → PEXELS_API_KEY.
// Returns an image Buffer, or null when no key / no match / any error (the design
// engine then falls back to the plain brand-gradient card).
const KEY = () => process.env.PEXELS_API_KEY || "";
export const photoReady = () => Boolean(KEY());

export async function fetchPhoto(query, orientation = "portrait") {
  const q = (query || "").trim();
  if (!KEY() || !q) return null;
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=${orientation}&per_page=8`;
    const r = await fetch(url, { headers: { Authorization: KEY() } });
    if (!r.ok) { console.error("[pexels]", r.status); return null; }
    const data = await r.json();
    const photos = (data && data.photos) || [];
    if (!photos.length) return null;
    // Deterministic pick (avoid Math.random) — varies by query.
    const pick = photos[q.length % photos.length];
    const src = pick.src.large2x || pick.src.large || pick.src.portrait || pick.src.original;
    const img = await fetch(src);
    if (!img.ok) return null;
    return Buffer.from(await img.arrayBuffer());
  } catch (e) { console.error("[pexels]", e.message); return null; }
}
