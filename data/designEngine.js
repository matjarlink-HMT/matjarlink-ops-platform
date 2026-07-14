// Live design engine — renders on-brand MatjarLink post images server-side with
// Skia (correct Arabic shaping + bidi). Driven by the post's headline; the owner's
// note regenerates it. Output is a publishable 1080x1350 (4:5) PNG.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS = path.join(__dirname, "..", "assets", "fonts");
try {
  GlobalFonts.registerFromPath(path.join(FONTS, "Tajawal-ExtraBold.ttf"), "TajawalXB");
  GlobalFonts.registerFromPath(path.join(FONTS, "Tajawal-Bold.ttf"), "TajawalB");
  GlobalFonts.registerFromPath(path.join(FONTS, "Tajawal-Regular.ttf"), "Tajawal");
} catch (e) { console.error("[design] font load:", e.message); }

let LOGO;
async function getLogo() {
  if (LOGO === undefined) { try { LOGO = await loadImage(path.join(__dirname, "..", "public", "logo-full.png")); } catch (e) { LOGO = null; } }
  return LOGO;
}

// Greedy word-wrap using the measured font (logical order; Skia handles RTL/bidi on draw).
function wrapLines(ctx, text, maxW) {
  const words = (text || "").trim().split(/\s+/);
  const lines = []; let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function renderDesign({ headline = "", tag = "قريبًا", accent = "#E8890F" } = {}) {
  const W = 1080, H = 1350, R = W - 84; // right anchor
  const cv = createCanvas(W, H);
  const ctx = cv.getContext("2d");

  // background gradient (brand plum)
  const g = ctx.createLinearGradient(0, 0, W * 0.55, H);
  g.addColorStop(0, "#6E1444"); g.addColorStop(1, "#3D0A26");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // decorative accent glows (visual energy)
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.24; ctx.beginPath(); ctx.arc(140, 170, 320, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.13; ctx.beginPath(); ctx.arc(W - 70, H - 100, 300, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  ctx.direction = "rtl"; ctx.textAlign = "right";

  // tag pill
  ctx.font = "34px TajawalXB";
  const tw = ctx.measureText(tag).width;
  const pillW = tw + 64, pillH = 66, pillY = 430;
  ctx.fillStyle = accent; ctx.beginPath(); ctx.roundRect(R - pillW, pillY, pillW, pillH, 33); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.fillText(tag, R - 32, pillY + 45);

  // headline — adaptive size to fit ≤5 lines
  let size = 88;
  let lines = wrapLines((ctx.font = size + "px TajawalXB", ctx), headline, W - 168);
  while (lines.length > 4 && size > 56) { size -= 8; lines = wrapLines((ctx.font = size + "px TajawalXB", ctx), headline, W - 168); }
  lines = lines.slice(0, 5);
  const lh = size * 1.3;
  let y = pillY + pillH + 96 + size;
  ctx.fillStyle = "#ffffff"; ctx.font = size + "px TajawalXB";
  for (const ln of lines) { ctx.fillText(ln, R, y); y += lh; }

  // accent underline under the headline block
  ctx.fillStyle = accent; ctx.beginPath(); ctx.roundRect(R - 168, y - lh + 34, 168, 12, 6); ctx.fill();

  // footer brand: logo chip + name
  const img = await getLogo();
  const fy = H - 172;
  if (img) {
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(R - 104, fy, 104, 104, 24); ctx.fill();
    ctx.drawImage(img, R - 97, fy + 7, 90, 90);
  }
  ctx.textAlign = "right"; ctx.fillStyle = "#fff"; ctx.font = "44px TajawalXB";
  ctx.fillText("متجرلينك", R - 128, fy + 48);
  ctx.fillStyle = "#EBB0CC"; ctx.font = "27px Tajawal";
  ctx.fillText("متجر · كاشير · محاسبة — قريبًا", R - 128, fy + 88);

  return cv.toBuffer("image/png");
}
