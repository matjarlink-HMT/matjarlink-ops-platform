// ── Motion Engine ── MatjarLink "Bold Brand Motion" reel theme.
// Colour-field-first brand system (magenta #9D1F60 + orange #F9A43C + white):
// photos live INSIDE shapes (rounded cards, circles, a phone) instead of dark
// full-bleed backgrounds; big confident Arabic type with ONE highlighted key
// phrase per scene; six distinct compositions so reels never look templated.
//
// Every layout is a pure function of time:  t = entrance progress (0→1, the
// first ~0.8s of a scene), p = scene progress (0→1, slow continuous drift).
// A style frame is simply t=1; the animated reel renders many frames per scene
// and streams them to ffmpeg (see renderMotionReel) — same code for both.
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS = path.join(__dirname, "..", "assets", "fonts");
let fontsOK = false;
function ensureFonts() {
  if (fontsOK) return;
  GlobalFonts.registerFromPath(path.join(FONTS, "Tajawal-ExtraBold.ttf"), "MLXB");
  GlobalFonts.registerFromPath(path.join(FONTS, "Tajawal-Bold.ttf"), "MLB");
  GlobalFonts.registerFromPath(path.join(FONTS, "Tajawal-Regular.ttf"), "MLR");
  fontsOK = true;
}

export const BRAND = {
  magenta: "#9D1F60", magentaDeep: "#7A1549", magentaSoft: "#B8467F", magentaInk: "#5E1038",
  orange: "#F9A43C", orangeDeep: "#E8890F", orangeSoft: "#FCD9A8",
  white: "#FFFFFF", cream: "#FBF5F2", ink: "#2A1A23", inkSoft: "#6B5560",
};
export const W = 1080, H = 1920;
// Instagram Reels UI covers the bottom strip and the right-edge action icons —
// keep copy inside these margins so nothing gets hidden.
const SAFE = { top: 170, bottom: 330, left: 90, right: 120 };

// ── easing / timing ──
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const easeOutBack = (x) => { x = clamp(x); const c1 = 1.45, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const stag = (t, k, gap = 0.13, dur = 0.5) => easeOut((t - k * gap) / dur);

// ── drawing helpers ──
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function coverDraw(ctx, img, x, y, w, h, zoom = 1, r = 0) {
  ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip();
  if (!img) { ctx.fillStyle = BRAND.magentaSoft; ctx.fillRect(x, y, w, h); ctx.restore(); return; }
  const ir = img.width / img.height, cr = w / h;
  let dw, dh; if (ir > cr) { dh = h * zoom; dw = dh * ir; } else { dw = w * zoom; dh = dw / ir; }
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}
function circle(ctx, cx, cy, r, fill, alpha = 1) { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
function shadow(ctx, blur = 50, oy = 24, a = 0.28) { ctx.shadowColor = `rgba(40,10,25,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = oy; }
function noShadow(ctx) { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }

// ── text ──
function wrapLines(ctx, text, maxW) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean); const lines = []; let cur = "";
  for (const w of words) { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
// Split on-screen copy into a main part and ONE key phrase (highlighted).
// "آخر النهار.. كم ربحت؟" → main "آخر النهار.." · key "كم ربحت؟"
export function splitKey(text) {
  const s = String(text || "").trim(); if (!s) return { main: "", key: "" };
  let i = s.lastIndexOf("..");
  if (i > 0 && i < s.length - 2) return { main: s.slice(0, i + 2).trim(), key: s.slice(i + 2).trim() };
  i = s.lastIndexOf("،");
  if (i > 0 && i < s.length - 1) return { main: s.slice(0, i + 1).trim(), key: s.slice(i + 1).trim() };
  const w = s.split(/\s+/);
  if (w.length >= 4) return { main: w.slice(0, w.length - 2).join(" "), key: w.slice(-2).join(" ") };
  return { main: s, key: "" };
}
// Fit main + key lines inside maxW / maxLines by shrinking the font.
function fitCopy(ctx, main, key, maxW, size, minSize, maxLines = 4) {
  let m = [], k = [];
  for (let s = size; s >= minSize; s -= 6) {
    ctx.font = `${s}px MLXB`; m = main ? wrapLines(ctx, main, maxW) : [];
    ctx.font = `${Math.round(s * 0.92)}px MLXB`; k = key ? wrapLines(ctx, key, maxW - 80) : [];
    if (m.length + k.length <= maxLines) return { size: s, main: m, key: k };
  }
  return { size: minSize, main: m.slice(0, 3), key: k.slice(0, 2) };
}
// Right-aligned (RTL) copy block with a pill behind each key line; entrance =
// each line slides up 60px + fades, staggered. Returns the y after the block.
function drawCopy(ctx, { main, key, size }, x, y, t, o = {}) {
  const { color = BRAND.white, pillFill = BRAND.orange, pillText = BRAND.magentaInk, align = "right", gap = 0.13 } = o;
  ctx.save(); ctx.direction = "rtl"; ctx.textAlign = align; ctx.textBaseline = "alphabetic";
  const lh = Math.round(size * 1.18); let k = 0;
  for (const ln of main) {
    const e = stag(t, k++, gap); ctx.globalAlpha = e; ctx.font = `${size}px MLXB`; ctx.fillStyle = color;
    ctx.fillText(ln, x, y + size + (1 - e) * 60); y += lh;
  }
  if (key.length) y += Math.round(size * 0.18);
  const ks = Math.round(size * 0.92), padX = 34, ph = Math.round(ks * 1.32);
  for (const ln of key) {
    const e = easeOutBack(clamp((t - k++ * gap - 0.05) / 0.55)); ctx.globalAlpha = clamp(e);
    ctx.font = `${ks}px MLXB`; const tw = ctx.measureText(ln).width;
    const px = align === "right" ? x - tw - padX : align === "center" ? x - tw / 2 - padX : x - padX;
    const sc = 0.7 + 0.3 * e; const cx = px + (tw + padX * 2) / 2, cy = y + ph / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
    ctx.fillStyle = pillFill; rr(ctx, px, y, tw + padX * 2, ph, ph / 2); ctx.fill();
    ctx.fillStyle = pillText; ctx.fillText(ln, align === "right" ? x : align === "center" ? x : x, y + ph / 2 + ks * 0.36);
    ctx.restore(); y += ph + 16;
  }
  ctx.restore(); return y;
}
function drawLogo(ctx, logo, x, y, w, t = 1) {
  if (!logo) return; const e = easeOut(t); const h = w * (logo.height / logo.width);
  ctx.save(); ctx.globalAlpha = e; ctx.drawImage(logo, x, y + (1 - e) * -20, w, h); ctx.restore();
}
function drawFooter(ctx, biz, color, t = 1) {
  const ig = (biz && (biz.instagram || biz.ig)) || "matjarlink";
  const ph = (biz && (biz.phone || biz.whatsapp)) || "";
  ctx.save(); ctx.globalAlpha = easeOut(t) * 0.92; ctx.direction = "ltr"; ctx.textAlign = "left";
  ctx.font = "30px MLB"; ctx.fillStyle = color;
  ctx.fillText(`@${String(ig).replace(/^@/, "")}${ph ? "   ·   " + ph : ""}`, SAFE.left, H - SAFE.bottom + 210);
  ctx.restore();
}
// Never print the brand name as copy when the logo is on screen.
const stripBrand = (s) => String(s || "").replace(/^\s*(متجرلينك|متجر لينك|matjarlink)\s*[.،:\-–—]*\s*/i, "").trim();

// ── the six compositions ──
const LAYOUTS = {
  // 1) HOOK — full magenta field, giant white type, key phrase in an orange pill.
  hook(ctx, a) {
    const { t, p, copy, assets } = a;
    ctx.fillStyle = BRAND.magenta; ctx.fillRect(0, 0, W, H);
    circle(ctx, 160, 1560 - p * 40, 560 * easeOut(t * 1.4), BRAND.magentaSoft, 0.32);
    circle(ctx, 930, 300, 120 * easeOutBack(clamp(t * 1.6)), BRAND.orange, 0.95);
    circle(ctx, 820, 1180, 34 * easeOut(t), BRAND.orangeSoft, 0.9);
    drawLogo(ctx, assets.logoWhite, W - SAFE.right - 190, SAFE.top - 60, 190, t);
    ctx.font = "34px MLB";
    const f = fitCopy(ctx, copy.main, copy.key, W - SAFE.left - SAFE.right, 128, 80);
    drawCopy(ctx, f, W - SAFE.right, 560, t, { color: BRAND.white, pillFill: BRAND.orange, pillText: BRAND.magentaInk });
    drawFooter(ctx, a.biz, "rgba(255,255,255,0.85)", t);
  },
  // 2) PHOTO CARD — cream field, rounded photo card with slow zoom, magenta copy.
  photoCard(ctx, a) {
    const { t, p, copy, assets } = a;
    ctx.fillStyle = BRAND.cream; ctx.fillRect(0, 0, W, H);
    circle(ctx, 1000, 1700, 300, BRAND.orangeSoft, 0.55);
    drawLogo(ctx, assets.logo, W - SAFE.right - 170, 70, 170, t);
    const e = easeOut(t), cx = 70, cy = 250 + (1 - e) * 90, cw = W - 140, ch = 1000;
    ctx.save(); ctx.globalAlpha = e; shadow(ctx); ctx.fillStyle = "#fff"; rr(ctx, cx, cy, cw, ch, 56); ctx.fill(); noShadow(ctx);
    coverDraw(ctx, assets.photo, cx, cy, cw, ch, 1.1 - 0.08 * p, 56); ctx.restore();
    ctx.fillStyle = BRAND.orange; rr(ctx, W - SAFE.right - 150 * e, 1300, 150 * e, 14, 7); ctx.fill();
    const f = fitCopy(ctx, copy.main, copy.key, W - SAFE.left - SAFE.right, 92, 62, 3);
    drawCopy(ctx, f, W - SAFE.right, 1335, clamp(t * 1.1 - 0.1), { color: BRAND.magenta, pillFill: BRAND.magenta, pillText: BRAND.white });
    drawFooter(ctx, a.biz, BRAND.inkSoft, t);
  },
  // 3) SPLIT — photo on top, a magenta sheet slides up with the copy.
  split(ctx, a) {
    const { t, p, copy, assets } = a;
    coverDraw(ctx, assets.photo, 0, 0, W, 1120, 1.08 - 0.06 * p, 0);
    const g = ctx.createLinearGradient(0, 0, 0, 340); g.addColorStop(0, "rgba(40,10,25,0.45)"); g.addColorStop(1, "rgba(40,10,25,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 340);
    drawLogo(ctx, assets.logoWhite, W - SAFE.right - 180, 70, 180, t);
    const e = easeOut(t), sy = 1000 + (1 - e) * 420;
    ctx.fillStyle = BRAND.magenta; rr(ctx, 0, sy, W, H - sy + 80, 72); ctx.fill();
    circle(ctx, 120, sy + 120, 70, BRAND.orange, 0.95 * e);
    const f = fitCopy(ctx, copy.main, copy.key, W - SAFE.left - SAFE.right, 96, 64, 3);
    drawCopy(ctx, f, W - SAFE.right, sy + 120, clamp(t * 1.15 - 0.15), { color: BRAND.white, pillFill: BRAND.orange, pillText: BRAND.magentaInk });
    drawFooter(ctx, a.biz, "rgba(255,255,255,0.85)", t);
  },
  // 4) STAT — orange field, circular photo with a white ring, magenta copy.
  stat(ctx, a) {
    const { t, p, copy, assets } = a;
    ctx.fillStyle = BRAND.orange; ctx.fillRect(0, 0, W, H);
    circle(ctx, 140, 260, 180, BRAND.orangeSoft, 0.55);
    circle(ctx, 960, 1500, 90, BRAND.magenta, 0.9 * easeOut(t));
    drawLogo(ctx, assets.logoWhite, W - SAFE.right - 180, 70, 180, t);
    const e = easeOutBack(clamp(t * 1.2)), R = 330 * e, cx = W / 2, cy = 720;
    circle(ctx, cx, cy, R + 18, BRAND.white);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, R), 0, Math.PI * 2); ctx.clip();
    coverDraw(ctx, assets.photo, cx - R, cy - R, R * 2, R * 2, 1.06 - 0.05 * p, 0); ctx.restore();
    const f = fitCopy(ctx, copy.main, copy.key, W - SAFE.left - SAFE.right, 92, 62, 3);
    drawCopy(ctx, f, W / 2, 1120, clamp(t * 1.1 - 0.1), { align: "center", color: BRAND.magentaInk, pillFill: BRAND.magenta, pillText: BRAND.white });
    drawFooter(ctx, a.biz, BRAND.magentaInk, t);
  },
  // 5) PHONE — magenta gradient, a floating phone holding the photo.
  phone(ctx, a) {
    const { t, p, copy, assets } = a;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, BRAND.magenta); g.addColorStop(1, BRAND.magentaDeep);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    circle(ctx, W / 2, 1180, 470 * easeOut(t), BRAND.orange, 0.22);
    drawLogo(ctx, assets.logoWhite, W - SAFE.right - 180, 70, 180, t);
    const f = fitCopy(ctx, copy.main, copy.key, W - SAFE.left - SAFE.right, 88, 60, 3);
    drawCopy(ctx, f, W - SAFE.right, 210, t, { color: BRAND.white, pillFill: BRAND.orange, pillText: BRAND.magentaInk });
    const e = easeOut(clamp(t * 1.1 - 0.05)), pw = 560, ph = 1060, px = (W - pw) / 2, py = 700 + (1 - e) * 220;
    ctx.save(); ctx.globalAlpha = e; ctx.translate(W / 2, py + ph / 2); ctx.rotate((-7 + 3 * e - 1.5 * p) * Math.PI / 180); ctx.translate(-W / 2, -(py + ph / 2));
    shadow(ctx, 70, 34, 0.4); ctx.fillStyle = "#170A11"; rr(ctx, px, py, pw, ph, 84); ctx.fill(); noShadow(ctx);
    coverDraw(ctx, assets.photo, px + 22, py + 22, pw - 44, ph - 44, 1.06 - 0.05 * p, 64);
    ctx.fillStyle = "#170A11"; rr(ctx, W / 2 - 80, py + 34, 160, 34, 17); ctx.fill();
    ctx.restore();
    drawFooter(ctx, a.biz, "rgba(255,255,255,0.85)", t);
  },
  // 6) CTA — magenta→orange gradient, big logo, CTA pill.
  cta(ctx, a) {
    const { t, p, copy, assets, cta } = a;
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, BRAND.magenta); g.addColorStop(0.62, BRAND.magentaSoft); g.addColorStop(1, BRAND.orange);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 3; i++) { ctx.save(); ctx.globalAlpha = 0.09; ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(W / 2, 760, (360 + i * 170) * easeOut(clamp(t * 1.3 - i * 0.12)) + p * 30, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    const e = easeOutBack(clamp(t * 1.2)); const lw = 500 * (0.75 + 0.25 * e);
    if (assets.logoWhite) { const lh = lw * (assets.logoWhite.height / assets.logoWhite.width); ctx.save(); ctx.globalAlpha = clamp(e); ctx.drawImage(assets.logoWhite, W / 2 - lw / 2, 760 - lh / 2, lw, lh); ctx.restore(); }
    const head = stripBrand([copy.main, copy.key].filter(Boolean).join(" "));
    const ctaTxt = String(cta || "").trim();
    let y = 1130;
    if (head && head.replace(/[.\s]/g, "") !== ctaTxt.replace(/[.\s]/g, "")) {
      ctx.font = "84px MLXB"; const f = fitCopy(ctx, head, "", W - SAFE.left - SAFE.right, 84, 60, 2);
      y = drawCopy(ctx, f, W / 2, y, clamp(t * 1.2 - 0.25), { align: "center", color: BRAND.white });
      y += 20;
    }
    if (ctaTxt) {
      const ce = easeOutBack(clamp(t * 1.3 - 0.45)); ctx.save(); ctx.direction = "rtl"; ctx.textAlign = "center"; ctx.font = "60px MLXB";
      const tw = ctx.measureText(ctaTxt).width, pw = tw + 110, ph = 116, cx = W / 2, cy = y + ph / 2;
      ctx.globalAlpha = clamp(ce); ctx.translate(cx, cy); ctx.scale(0.7 + 0.3 * ce, 0.7 + 0.3 * ce); ctx.translate(-cx, -cy);
      shadow(ctx, 40, 16, 0.25); ctx.fillStyle = BRAND.white; rr(ctx, cx - pw / 2, y, pw, ph, ph / 2); ctx.fill(); noShadow(ctx);
      ctx.fillStyle = BRAND.magenta; ctx.fillText(ctaTxt, cx, y + ph / 2 + 22); ctx.restore();
    }
    drawFooter(ctx, a.biz, "rgba(255,255,255,0.92)", t);
  },
};
export const LAYOUT_KEYS = Object.keys(LAYOUTS);

// Pick a composition per scene: first = hook, last = cta, digits → stat,
// otherwise rotate photo-led layouts so consecutive scenes never repeat.
export function layoutFor(scene, i, n) {
  if (scene && scene.layout && LAYOUTS[scene.layout]) return scene.layout;
  if (i === 0) return "hook";
  if (i === n - 1) return "cta";
  if (/[0-9٠-٩٪%]/.test(scene && scene.onScreenText || "")) return "stat";
  return ["photoCard", "split", "phone"][(i - 1) % 3];
}

export async function loadAssets(photoPath) {
  ensureFonts();
  const pub = path.join(__dirname, "..", "public");
  const safe = async (p) => { try { return p && fs.existsSync(p) ? await loadImage(p) : null; } catch (e) { return null; } };
  return { photo: await safe(photoPath), logo: await safe(path.join(pub, "logo-full.png")), logoWhite: await safe(path.join(pub, "logo-white.png")) };
}

// Draw one frame of a scene at entrance t / progress p.
export function drawScene(ctx, { layout, scene, assets, biz, cta, t = 1, p = 0.5 }) {
  ensureFonts();
  const copy = splitKey(scene && scene.onScreenText);
  (LAYOUTS[layout] || LAYOUTS.photoCard)(ctx, { t, p, copy, assets, biz, cta });
}

// Static style frame (t=1) → PNG buffer.
export async function renderStyleFrame({ layout, scene, photoPath, biz, cta }) {
  const assets = await loadAssets(photoPath);
  const cv = createCanvas(W, H); const ctx = cv.getContext("2d");
  drawScene(ctx, { layout, scene, assets, biz, cta, t: 1, p: 0.5 });
  return cv.toBuffer("image/png");
}
