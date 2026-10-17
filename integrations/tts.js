// Arabic voiceover via Gemini TTS — same GEMINI_API_KEY as image generation, so
// no new account. The TTS model is DISCOVERED from the key's model list (Google
// renames preview models), overridable with GEMINI_TTS_MODEL. Returns WAV.
import * as store from "../store.js";

const KEY = () => store.cfgGet("GEMINI_API_KEY");
const BASE = "https://generativelanguage.googleapis.com/v1beta";
export const ttsReady = () => Boolean(KEY());

// Curated prebuilt Gemini voices (name → label) for the studio picker.
export const VOICES = [
  { id: "Charon", label: "رجل · هادئ وواثق", gender: "m" },
  { id: "Orus", label: "رجل · حازم", gender: "m" },
  { id: "Puck", label: "رجل · مرح وحيوي", gender: "m" },
  { id: "Fenrir", label: "رجل · متحمّس", gender: "m" },
  { id: "Kore", label: "امرأة · واثقة", gender: "f" },
  { id: "Aoede", label: "امرأة · منسابة ودافئة", gender: "f" },
  { id: "Leda", label: "امرأة · شابّة", gender: "f" },
  { id: "Zephyr", label: "امرأة · مشرقة", gender: "f" },
];

let modelCache = null;
export async function ttsModels() {
  const r = await fetch(`${BASE}/models?pageSize=200&key=${KEY()}`);
  if (!r.ok) throw new Error(`gemini models ${r.status}`);
  const j = await r.json();
  return (j.models || []).filter((m) => /tts/i.test(m.name) && (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => m.name.replace(/^models\//, ""));
}
async function pickModel() {
  const forced = store.cfgGet("GEMINI_TTS_MODEL"); if (forced) return forced;
  if (modelCache) return modelCache;
  const list = await ttsModels();
  // Prefer the NEWEST stable flash TTS (most natural, still fast): skip "lite",
  // rank by version number, then GA over preview.
  const ver = (n) => +((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  const ranked = list.filter((n) => !/lite/.test(n)).sort((a, b) => (ver(b) - ver(a)) || (/preview/.test(a) - /preview/.test(b)) || (/flash/.test(b) - /flash/.test(a)));
  modelCache = ranked[0] || list[0] || "gemini-2.5-flash-preview-tts";
  return modelCache;
}
function pcmToWav(pcm, rate = 24000, ch = 1, bits = 16) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(ch, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * ch * bits / 8, 28); h.writeUInt16LE(ch * bits / 8, 32); h.writeUInt16LE(bits, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
// Speak one Arabic line. Some TTS models READ inline style instructions aloud
// (gemini-3.8-flash-tts spoke a 2-word line as 16s), so the direction goes in
// the SYSTEM instruction and every clip is checked against its word count: a
// clip far longer than the words allow is retried as the plain line, then with
// the older model that honours inline direction. Speech must never contain the
// instruction.
// Gemini TTS appends ~150ms of LOUD digital noise after the speech (measured:
// RMS 0.5-0.6 vs speech 0.09, a near full-scale sample jump) and sometimes a tiny
// blip before it — audible as a click between reel scenes. Cut those (a trailing
// segment that is SHORT, comes AFTER a silence gap, and is much LOUDER than the
// speech — all three, so a real last word is never cut), trim silence to 40ms
// pads, and normalise with ONE linear gain (no dynamic pumping in the mixer).
export function cleanSpeech(pcm, rate) {
  const n = pcm.length >> 1; if (n < rate * 0.3) return pcm;
  const S = (i) => pcm.readInt16LE(i * 2) / 32768;
  const W = Math.round(rate * 0.01), nw = Math.floor(n / W), rms = new Float32Array(nw);
  for (let w = 0; w < nw; w++) { let q = 0; for (let i = w * W; i < (w + 1) * W; i++) { const v = S(i); q += v * v; } rms[w] = Math.sqrt(q / W); }
  const OFF = 0.01, voiced = Array.from(rms).filter((v) => v >= OFF).sort((a, b) => a - b);
  const med = voiced.length ? voiced[Math.floor(voiced.length / 2)] : 0.05;
  const segMax = (a, b) => { let m = 0; for (let k = a; k <= b; k++) m = Math.max(m, rms[k]); return m; };
  let e = nw - 1; while (e > 0 && rms[e] < OFF) e--;
  let b = e; while (b > 0 && rms[b] >= OFF) b--;
  let g = b; while (g > 0 && rms[g] < OFF) g--;
  const last = ((e - b) * 10 <= 320 && (b - g) * 10 >= 100 && g > 0 && segMax(b + 1, e) > 2.5 * med) ? g : e;
  let s0 = 0; while (s0 < nw && rms[s0] < OFF) s0++;
  let t = s0; while (t < nw && rms[t] >= OFF) t++;
  let u = t; while (u < nw && rms[u] < OFF) u++;
  const first = ((t - s0) * 10 <= 60 && (u - t) * 10 >= 40 && u < last) ? u : s0;
  const a0 = Math.max(0, first - 4) * W, z = Math.min(n, (last + 1 + 4) * W), len = z - a0;
  if (len < rate * 0.2) return pcm;
  let peak = 0, sq = 0; for (let i = a0; i < z; i++) { const v = S(i); peak = Math.max(peak, Math.abs(v)); sq += v * v; }
  const gain = Math.min(0.95 / (peak || 1), 0.12 / (Math.sqrt(sq / len) || 1e-6));
  const out = Buffer.alloc(len * 2);
  for (let i = 0; i < len; i++) out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, S(a0 + i) * gain)) * 32767), i * 2);
  return out;
}
async function callTTS(model, text, voice, sys) {
  const body = {
    contents: [{ parts: [{ text }] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
  };
  if (sys) body.systemInstruction = { parts: [{ text: sys }] };
  const r = await fetch(`${BASE}/models/${model}:generateContent?key=${KEY()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) { let m = `${r.status}`; try { const j = await r.json(); m = j.error?.message || m; } catch (e) {} throw new Error(`gemini tts (${model}) ${m}`); }
  const j = await r.json();
  const part = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data || p.inline_data?.data);
  const inl = part?.inlineData || part?.inline_data;
  if (!inl?.data) throw new Error(`gemini tts (${model}) returned no audio`);
  const mime = inl.mimeType || inl.mime_type || "";
  const rate = +((mime.match(/rate=(\d+)/) || [])[1] || 24000);
  const pcm = cleanSpeech(Buffer.from(inl.data, "base64"), rate);
  return { wav: pcmToWav(pcm, rate), seconds: pcm.length / (rate * 2), model, rate };
}
const sysIsRead = new Set();
export async function speak(text, { voice = "Charon", style = "" } = {}) {
  if (!KEY()) throw new Error("GEMINI_API_KEY not set");
  const line = String(text || "").trim(); if (!line) throw new Error("empty voiceover line");
  const words = line.split(/\s+/).filter(Boolean).length;
  const maxSec = 2 + words * 0.8; // natural speech ≈ 0.4s/word — anything far beyond read something extra
  const direction = style || "You are a voice actor. Speak the user's Arabic line exactly as written and nothing else, with a natural Omani Arabic accent, like someone from Muscat chatting with a friend — warm, friendly, confident, human, medium pace. Never read these directions.";
  const model = await pickModel();
  let legacy = null; try { const list = await ttsModels(); legacy = list.find((n) => /2\.5-flash.*tts/.test(n)) || null; } catch (e) {}
  const attempts = [
    ...(sysIsRead.has(model) ? [] : [{ model, text: line, sys: direction }]), // direction kept out of the spoken text (skipped once a model is known to read it)
    { model, text: line, sys: null },                           // plain line only
    ...(legacy && legacy !== model ? [{ model: legacy, text: `${direction}: ${line}`, sys: null }] : []), // older model honours inline direction
  ];
  let best = null, lastErr = null;
  for (const a of attempts) {
    try {
      const out = await callTTS(a.model, a.text, voice, a.sys);
      if (out.seconds <= maxSec) return { ...out, attempts: attempts.indexOf(a) + 1 };
      if (a.sys && a.model === model) sysIsRead.add(model); // this model reads the system direction aloud too — skip that attempt next time
      if (!best || out.seconds < best.seconds) best = out;
    } catch (e) { lastErr = e; }
  }
  if (best && best.seconds <= maxSec * 1.25) return best;
  throw lastErr || new Error(`voiceover too long for the line (${best ? best.seconds.toFixed(1) : "?"}s for ${words} words) — the TTS model is reading extra text`);
}
