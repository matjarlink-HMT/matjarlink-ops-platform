// Real AI video (Google Veo / Gemini Omni via the same GEMINI_API_KEY). Used
// IMAGE-TO-VIDEO: each scene's approved photo is the first frame, so the cast,
// dress and shop stay exactly as approved and only motion is generated. Paid per
// second of output — the studio shows the estimate and the owner chooses the
// engine; nothing here runs on its own. The key travels only in a header.
import * as store from "../store.js";

const KEY = () => store.cfgGet("GEMINI_API_KEY");
const BASE = "https://generativelanguage.googleapis.com/v1beta";
export const veoReady = () => Boolean(KEY());

// USD per second of 720p output (ai.google.dev/gemini-api/docs/pricing, Oct 2026).
export const PRICES = { "veo-3.1-lite": 0.05, "veo-3.1-fast": 0.1, "veo-3.1": 0.4, "omni-flash": 0.1 };
export const priceFor = (model) => {
  const m = String(model || "");
  if (/omni/.test(m)) return PRICES["omni-flash"];
  if (/lite/.test(m)) return PRICES["veo-3.1-lite"];
  if (/fast/.test(m)) return PRICES["veo-3.1-fast"];
  return PRICES["veo-3.1"];
};

export async function videoModels() {
  const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": KEY() } });
  if (!r.ok) throw new Error(`gemini models ${r.status}`);
  const j = await r.json();
  return (j.models || []).filter((m) => /veo|omni/i.test(m.name)).map((m) => ({ id: m.name.replace(/^models\//, ""), methods: m.supportedGenerationMethods || [] }));
}

// Veo clip lengths are 4, 6 or 8 s — pick the shortest that covers the scene.
export const clipSeconds = (s) => (s <= 4 ? 4 : s <= 6 ? 6 : 8);

// One clip from a first-frame image. Returns an mp4 Buffer. Polls the long-running
// operation (Google: 11 s – 6 min) and downloads within the 2-day retention.
export async function generateClip({ model, prompt, image, mime = "image/jpeg", seconds = 4, onPoll } = {}) {
  if (!KEY()) throw new Error("GEMINI_API_KEY not set");
  // predictLongRunning takes the Vertex-style image ({bytesBase64Encoded, mimeType});
  // the inlineData shape is tried only if a model rejects that one. A rejected
  // request generates (and bills) nothing.
  const b64 = image.toString("base64");
  const shapes = [{ bytesBase64Encoded: b64, mimeType: mime }, { inlineData: { mimeType: mime, data: b64 } }];
  const h = { "x-goog-api-key": KEY(), "Content-Type": "application/json" };
  let op = null, lastErr = "";
  for (const img of shapes) {
    const body = { instances: [{ prompt, image: img }], parameters: { aspectRatio: "9:16", resolution: "720p", durationSeconds: clipSeconds(seconds), personGeneration: "allow_adult" } };
    const r = await fetch(`${BASE}/models/${model}:predictLongRunning`, { method: "POST", headers: h, body: JSON.stringify(body) });
    if (r.ok) { op = await r.json(); break; }
    let m = `${r.status}`; try { const j = await r.json(); m = j.error?.message || m; } catch (e) {}
    lastErr = m; if (r.status !== 400 || !/inlineData|bytesBase64Encoded|image/i.test(m)) break;
  }
  if (!op) throw new Error(`veo (${model}) ${lastErr}`); if (!op.name) throw new Error("veo: no operation returned");
  const t0 = Date.now();
  for (;;) {
    await new Promise((res) => setTimeout(res, 10000));
    const s = await fetch(`${BASE}/${op.name}`, { headers: { "x-goog-api-key": KEY() } }).then((x) => x.json());
    if (onPoll) try { onPoll((Date.now() - t0) / 1000); } catch (e) {}
    if (s.error) throw new Error(`veo: ${s.error.message || "generation failed"}`);
    if (s.done) {
      const resp = s.response?.generateVideoResponse || s.response || {};
      const uri = resp.generatedSamples?.[0]?.video?.uri || resp.generatedVideos?.[0]?.video?.uri;
      if (!uri) {
        const why = resp.raiMediaFilteredReasons?.[0] || (resp.raiMediaFilteredCount ? "blocked by the safety filter" : "no video in the response");
        throw new Error(`veo: ${why}`);
      }
      const v = await fetch(uri, { headers: { "x-goog-api-key": KEY() }, redirect: "follow" });
      if (!v.ok) throw new Error(`veo download ${v.status}`);
      return Buffer.from(await v.arrayBuffer());
    }
    if (Date.now() - t0 > 8 * 60 * 1000) throw new Error("veo: timed out after 8 minutes");
  }
}
