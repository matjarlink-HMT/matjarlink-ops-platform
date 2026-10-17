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
  // prefer a "flash" TTS (fast/cheap), else any TTS model the key can use
  modelCache = list.find((n) => /flash/.test(n)) || list[0] || "gemini-2.5-flash-preview-tts";
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
// Speak one Arabic line. style steers delivery (the model speaks only the line).
export async function speak(text, { voice = "Charon", style = "" } = {}) {
  if (!KEY()) throw new Error("GEMINI_API_KEY not set");
  const line = String(text || "").trim(); if (!line) throw new Error("empty voiceover line");
  const model = await pickModel();
  const direction = style || "Say this in natural, warm, conversational Gulf Arabic with an Omani feel — friendly, confident and human, medium pace, like a real person talking to a shop owner, never robotic";
  const body = {
    contents: [{ parts: [{ text: `${direction}: ${line}` }] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
  };
  const r = await fetch(`${BASE}/models/${model}:generateContent?key=${KEY()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) { let m = `${r.status}`; try { const j = await r.json(); m = j.error?.message || m; } catch (e) {} throw new Error(`gemini tts (${model}) ${m}`); }
  const j = await r.json();
  const part = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data || p.inline_data?.data);
  const inl = part?.inlineData || part?.inline_data;
  if (!inl?.data) throw new Error("gemini tts returned no audio");
  const mime = inl.mimeType || inl.mime_type || "";
  const rate = +((mime.match(/rate=(\d+)/) || [])[1] || 24000);
  const pcm = Buffer.from(inl.data, "base64");
  return { wav: pcmToWav(pcm, rate), seconds: pcm.length / (rate * 2), model, rate };
}
