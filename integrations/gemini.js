// Gemini image generation (Google Generative Language API) — used by the nightly
// job to invent new authentic-Omani brand characters fully server-side. The owner
// pastes a Google AI Studio key as GEMINI_API_KEY (env or Connections page).
//
// Model: an image-capable Gemini ("Nano Banana"). Default gemini-2.5-flash-image;
// override with GEMINI_IMAGE_MODEL if Google renames it. Returns a PNG/JPEG Buffer.
import * as store from "../store.js";

const KEY = () => store.cfgGet("GEMINI_API_KEY");
const MODEL = () => store.cfgGet("GEMINI_IMAGE_MODEL") || "gemini-2.5-flash-image";
export const geminiReady = () => Boolean(KEY());

// Generate one image from a text prompt. Returns { buffer, mime } or throws.
export async function generateImage(prompt) {
  const key = KEY();
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent?key=${key}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"], temperature: 1.0 },
  };
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) {
    let msg = `${r.status}`;
    try { const j = await r.json(); msg = j.error?.message || msg; } catch (e) {}
    throw new Error(`gemini ${msg}`);
  }
  const j = await r.json();
  const parts = j.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
  const inline = img?.inlineData || img?.inline_data;
  if (!inline?.data) throw new Error("gemini returned no image");
  return { buffer: Buffer.from(inline.data, "base64"), mime: inline.mimeType || inline.mime_type || "image/png" };
}
