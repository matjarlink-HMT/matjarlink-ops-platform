// Live design engine — renders on-brand MatjarLink post images server-side with
// Skia (correct Arabic shaping + bidi). Two modes: a plain brand-gradient card,
// or a topic-relevant PHOTO background (from the stock-photo integration) with a
// legible plum overlay and brand text on top. Output: publishable 1080x1350 PNG.
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

export async function renderDesign({ headline = "", tag = "قريبًا", accent = "#E8890F", photo = null } = {}) {
  const W = 1080, H = 1350, R = W - 84; // right anchor
  const cv = createCanvas(W, H);
  const ctx = cv.getContext("2d");
  const hasPhoto = !!photo;

  if (hasPhoto) {
    // photo background, cover-fit
    try {
      const img = await loadImage(photo);
      const ir = img.width / img.height, cr = W / H;
      let dw, dh, dx, dy;
      if (ir > cr) { dh = H; dw = H * ir; dx = (W - dw) / 2; dy = 0; } else { dw = W; dh = W / ir; dx = 0; dy = (H - dh) / 2; }
      ctx.drawImage(img, dx, dy, dw, dh);
    } catch (e) { ctx.fillStyle = "#4E0E30"; ctx.fillRect(0, 0, W, H); }
    // brand plum tint + bottom gradient for text legibility
    ctx.fillStyle = "rgba(62,10,38,0.40)"; ctx.fillRect(0, 0, W, H);
    const og = ctx.createLinearGradient(0, H * 0.30, 0, H);
    og.addColorStop(0, "rgba(45,8,30,0)"); og.addColorStop(0.75, "rgba(45,8,30,0.86)"); og.addColorStop(1, "rgba(45,8,30,0.96)");
    ctx.fillStyle = og; ctx.fillRect(0, 0, W, H);
    // accent color wash at the very top edge
    ctx.fillStyle = accent; ctx.globalAlpha = 0.14; ctx.fillRect(0, 0, W, 10); ctx.globalAlpha = 1;
  } else {
    // plain brand gradient + accent glows
    const g = ctx.createLinearGradient(0, 0, W * 0.55, H);
    g.addColorStop(0, "#6E1444"); g.addColorStop(1, "#3D0A26");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.24; ctx.beginPath(); ctx.arc(140, 170, 320, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.13; ctx.beginPath(); ctx.arc(W - 70, H - 100, 300, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.direction = "rtl"; ctx.textAlign = "right";

  // headline — adaptive size to fit
  let size = 88;
  let lines = wrapLines((ctx.font = size + "px TajawalXB", ctx), headline, W - 168);
  while (lines.length > 4 && size > 54) { size -= 8; lines = wrapLines((ctx.font = size + "px TajawalXB", ctx), headline, W - 168); }
  lines = lines.slice(0, 5);
  const lh = size * 1.3;
  const blockH = lines.length * lh;

  const footerY = H - 168;
  // Photo mode: anchor text to the bottom (over the dark gradient). Plain: upper-middle.
  const hlTop = hasPhoto ? (footerY - 78 - blockH) : 560;
  const pillH = 66;

  // tag pill (above the headline)
  ctx.font = "34px TajawalXB";
  const tw = ctx.measureText(tag).width;
  const pillW = tw + 64, pillY = hlTop - pillH - 26;
  ctx.fillStyle = accent; ctx.beginPath(); ctx.roundRect(R - pillW, pillY, pillW, pillH, 33); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.fillText(tag, R - 32, pillY + 45);

  // headline
  ctx.fillStyle = "#ffffff"; ctx.font = size + "px TajawalXB";
  let y = hlTop + size;
  for (const ln of lines) { ctx.fillText(ln, R, y); y += lh; }

  // accent underline
  ctx.fillStyle = accent; ctx.beginPath(); ctx.roundRect(R - 168, y - lh + 34, 168, 12, 6); ctx.fill();

  // footer brand
  const img = await getLogo();
  if (img) {
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(R - 104, footerY, 104, 104, 24); ctx.fill();
    ctx.drawImage(img, R - 97, footerY + 7, 90, 90);
  }
  ctx.textAlign = "right"; ctx.fillStyle = "#fff"; ctx.font = "44px TajawalXB";
  ctx.fillText("متجرلينك", R - 128, footerY + 48);
  ctx.fillStyle = "#EBB0CC"; ctx.font = "27px Tajawal";
  ctx.fillText("متجر · كاشير · محاسبة — قريبًا", R - 128, footerY + 88);

  return cv.toBuffer("image/png");
}
