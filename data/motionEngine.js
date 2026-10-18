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
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) * (img.focusY ?? 0.5), dw, dh);
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
    circle(ctx, 190, 420 + p * 18, 110 * easeOutBack(clamp(t * 1.6)), BRAND.orange, 0.95); // left — clear of the logo
    circle(ctx, 930, 1250, 34 * easeOut(t), BRAND.orangeSoft, 0.9);
    drawLogo(ctx, assets.logoWhite, W - SAFE.right - 190, SAFE.top - 60, 190, t);
    ctx.font = "34px MLB";
    const f = fitCopy(ctx, copy.main, copy.key, W - SAFE.left - SAFE.right, 128, 80);
    drawCopy(ctx, f, W - SAFE.right, 560, t, { color: BRAND.white, pillFill: BRAND.orange, pillText: BRAND.magentaInk });
    drawFooter(ctx, a.biz, "rgba(255,255,255,0.85)", t);
  },
  // 1b) PHOTO HOOK — the opening SHOWN, not told (comedy / story openers): the
  // scene photo full-bleed with a slow push-in, a deep-magenta fade rising from the
  // bottom, and the hook in giant white type + orange pill over it — readable
  // inside the first second for muted viewers.
  photoHook(ctx, a) {
    const { t, p, copy, assets } = a;
    ctx.fillStyle = BRAND.magentaInk; ctx.fillRect(0, 0, W, H);
    coverDraw(ctx, assets.photo, 0, 0, W, H, 1.14 - 0.1 * p, 0);
    const top = ctx.createLinearGradient(0, 0, 0, 360); top.addColorStop(0, "rgba(40,10,25,0.5)"); top.addColorStop(1, "rgba(40,10,25,0)");
    ctx.fillStyle = top; ctx.fillRect(0, 0, W, 360);
    const e = easeOut(clamp(t * 1.6)), gy = 1020 + (1 - e) * 200;
    const g = ctx.createLinearGradient(0, gy, 0, H); g.addColorStop(0, "rgba(94,16,56,0)"); g.addColorStop(0.38, "rgba(94,16,56,0.86)"); g.addColorStop(1, "rgba(94,16,56,0.97)");
    ctx.fillStyle = g; ctx.fillRect(0, gy, W, H - gy);
    circle(ctx, 120, 1150 + (1 - e) * 120, 40 * easeOutBack(clamp(t * 1.8)), BRAND.orange, 0.95);
    drawLogo(ctx, assets.logoWhite, W - SAFE.right - 180, 70, 180, t);
    const f = fitCopy(ctx, copy.main, copy.key, W - SAFE.left - SAFE.right, 112, 72, 3);
    const lines = f.main.length + f.key.length, blockH = f.main.length * f.size * 1.18 + f.key.length * f.size * 1.3;
    drawCopy(ctx, f, W - SAFE.right, Math.min(1420, H - SAFE.bottom - blockH - 20 - (lines > 2 ? 0 : 40)), clamp(t * 1.5), { color: BRAND.white, pillFill: BRAND.orange, pillText: BRAND.magentaInk, gap: 0.09 });
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
    const norm = (x) => x.replace(/[.\s،,!؟]/g, "");
    if (head && !norm(ctaTxt).includes(norm(head))) { // never repeat what the CTA pill already says
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
// Comedy / story openers SHOW the first beat (photoHook) — a joke told only in
// text is not a joke. A scene about a person never goes inside the phone mockup
// (a man inside a phone reads as a video call, not the app).
const PERSON_RE = /\b(man|woman|owner|shopkeeper|trader|merchant|boy|girl|son|daughter|worker|customer|person|people|he|she|his|her)\b/i;
const STORY_MODES = new Set(["comedy", "storytelling", "ugc"]);
export function layoutFor(scene, i, n, { mode = "" } = {}) {
  if (scene && scene.layout && LAYOUTS[scene.layout]) return scene.layout;
  if (i === 0) return STORY_MODES.has(mode) ? "photoHook" : "hook";
  if (i === n - 1) return "cta";
  // the REVEAL (scene before the CTA) is the payoff of a story — full screen, never a small circle
  if (STORY_MODES.has(mode) && i === n - 2) return "photoHook";
  if (/[0-9٠-٩٪%]/.test(scene && scene.onScreenText || "")) return "stat";
  const l = ROTATION[(i - 1) % ROTATION.length];
  return l === "phone" && PERSON_RE.test(scene && scene.visual || "") ? "photoCard" : l;
}
// Layouts that place a scene photo (hook / cta are pure graphics — no image
// generation needed for them, which saves time, cost and disk).
const ROTATION = ["photoCard", "split", "phone", "stat"];
export const PHOTO_LAYOUTS = [...ROTATION, "photoHook"];
export const needsPhoto = (layout) => PHOTO_LAYOUTS.includes(layout);

export async function loadAssets(photoPath) {
  ensureFonts();
  const pub = path.join(__dirname, "..", "public");
  const safe = async (p) => { try { return p && fs.existsSync(p) ? await loadImage(p) : null; } catch (e) { return null; } };
  return { photo: await safe(photoPath), logo: await safe(path.join(pub, "logo-full.png")), logoWhite: await safe(path.join(pub, "logo-white.png")) };
}

// Draw one frame of a scene at entrance t / progress p.
export function drawScene(ctx, { layout, scene, assets, biz, cta, t = 1, p = 0.5, s = 2.5 }) {
  ensureFonts();
  const copy = splitKey(scene && scene.onScreenText);
  (LAYOUTS[layout] || LAYOUTS.photoCard)(ctx, { t, p, copy, assets, biz, cta });
  const ov = scene && OVERLAYS[scene.overlay]; if (ov) ov(ctx, s, scene);
}

// ── Explainer overlays ── crisp brand motion graphics drawn over a scene where
// AI footage cannot show a product truth (screens/text). Pure function of the
// scene time s (seconds), so they animate frame-accurately.
function cardBox(ctx, x, y, w, h, a) { ctx.save(); ctx.globalAlpha = a; shadow(ctx, 40, 18, 0.3); ctx.fillStyle = "rgba(255,255,255,0.96)"; rr(ctx, x, y, w, h, 36); ctx.fill(); noShadow(ctx); ctx.restore(); }
function iconRegister(ctx, cx, cy, c) { // cashier: screen on a stand + base
  ctx.save(); ctx.fillStyle = c; rr(ctx, cx - 44, cy - 40, 88, 56, 10); ctx.fill();
  ctx.fillStyle = "#fff"; rr(ctx, cx - 34, cy - 31, 68, 38, 6); ctx.fill();
  ctx.fillStyle = c; ctx.fillRect(cx - 8, cy + 16, 16, 14); rr(ctx, cx - 52, cy + 28, 104, 16, 8); ctx.fill(); ctx.restore();
}
function iconBag(ctx, cx, cy, c) { // online store: shopping bag
  ctx.save(); ctx.fillStyle = c; rr(ctx, cx - 42, cy - 24, 84, 70, 14); ctx.fill();
  ctx.strokeStyle = c; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(cx, cy - 24, 22, Math.PI, 0); ctx.stroke(); ctx.restore();
}
const eio = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const AR = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
const OVERLAYS = {
  // cashier sale → online store stock updates in the same instant
  stockSync(ctx, s, scene) {
    const o = scene.overlayText || {};
    const appear = easeOut(clamp((s - 0.15) / 0.5)), T_SALE = 1.0, T_ARRIVE = 1.75;
    const W2 = 400, H2 = 300, gap = 120, y = 760 + (1 - appear) * 60;
    const xR = W / 2 + gap / 2, xL = W / 2 - gap / 2 - W2; // RTL: cashier on the right, store on the left
    const after = s >= T_ARRIVE, pop = easeOutBack(clamp((s - T_ARRIVE) / 0.35));
    const before = o.from ?? 1, now = o.to ?? 0;
    for (const side of ["R", "L"]) {
      const x = side === "R" ? xR : xL, cx = x + W2 / 2;
      cardBox(ctx, x, y, W2, H2, appear);
      ctx.save(); ctx.globalAlpha = appear;
      if (side === "R") iconRegister(ctx, cx, y + 72, BRAND.magenta); else iconBag(ctx, cx, y + 76, BRAND.magenta);
      ctx.direction = "rtl"; ctx.textAlign = "center"; ctx.fillStyle = BRAND.magentaInk; ctx.font = "38px MLXB";
      ctx.fillText(side === "R" ? (o.left || "الكاشير") : (o.right || "المتجر الإلكتروني"), cx, y + 165);
      ctx.font = "30px MLB"; ctx.fillStyle = BRAND.inkSoft; ctx.fillText(o.label || "المخزون", cx - 50, y + 240);
      // the number flips at the moment the sale lands (both cards at once)
      const n = after ? now : before, sc = after ? 0.6 + 0.4 * pop : 1;
      ctx.save(); ctx.translate(cx + 70, y + 236); ctx.scale(sc, sc); ctx.font = "78px MLXB"; ctx.fillStyle = after ? BRAND.orangeDeep : BRAND.magenta; ctx.fillText(String(n), 0, 22); ctx.restore();
      ctx.restore();
    }
    // connector + travelling pulse (cashier → store)
    const ly = y + H2 / 2 - 10, x0 = xR - 6, x1 = xL + W2 + 6;
    ctx.save(); ctx.globalAlpha = appear; ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 6; ctx.setLineDash([14, 12]);
    ctx.beginPath(); ctx.moveTo(x0, ly); ctx.lineTo(x1, ly); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    if (s >= T_SALE && s < T_ARRIVE + 0.2) {
      const k = eio(clamp((s - T_SALE) / (T_ARRIVE - T_SALE))), px = x0 + (x1 - x0) * k;
      circle(ctx, px, ly, 26, BRAND.orange, 0.35); circle(ctx, px, ly, 15, BRAND.orange, 1);
    }
    // "sold out" pill on the store card + "instantly" tag
    if (after) {
      const e = pop; ctx.save(); ctx.globalAlpha = clamp(e); const lbl = o.done || "نفدت", cx = xL + W2 / 2;
      ctx.font = "34px MLXB"; const tw = ctx.measureText(lbl).width, pw = tw + 56, ph = 58, px = cx - pw / 2, py = y - 34;
      ctx.translate(cx, py + ph / 2); ctx.scale(0.7 + 0.3 * e, 0.7 + 0.3 * e); ctx.translate(-cx, -(py + ph / 2));
      ctx.fillStyle = BRAND.orange; rr(ctx, px, py, pw, ph, ph / 2); ctx.fill();
      ctx.direction = "rtl"; ctx.textAlign = "center"; ctx.fillStyle = BRAND.magentaInk; ctx.fillText(lbl, cx, py + 41); ctx.restore();
      const tag = o.tag || "لحظياً", e2 = easeOut(clamp((s - T_ARRIVE - 0.15) / 0.4));
      ctx.save(); ctx.globalAlpha = e2; ctx.font = "30px MLXB"; const w2 = ctx.measureText(tag).width + 40;
      ctx.fillStyle = BRAND.magenta; rr(ctx, W / 2 - w2 / 2, ly - 70, w2, 50, 25); ctx.fill();
      ctx.direction = "rtl"; ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.fillText(tag, W / 2, ly - 34); ctx.restore();
    }
  },
};

// Static style frame (t=1) → PNG buffer.
export async function renderStyleFrame({ layout, scene, photoPath, biz, cta }) {
  const assets = await loadAssets(photoPath);
  const cv = createCanvas(W, H); const ctx = cv.getContext("2d");
  drawScene(ctx, { layout, scene, assets, biz, cta, t: 1, p: 0.5 });
  return cv.toBuffer("image/png");
}

// ── Animated reel ── render every frame on ONE reused canvas and stream raw RGBA
// straight into ffmpeg (no frame files on disk, one frame in memory at a time).
// Between scenes a two-tone brand wipe (orange/magenta panel) sweeps right→left:
// it covers the end of scene i and uncovers the start of scene i+1 ("cut" in the
// storyboard skips the wipe). Silent stereo track until voice/music are added.
const WIPE = 0.38;
const easeInOut = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
function drawWipe(ctx, x, color, edge) {
  ctx.fillStyle = color; ctx.fillRect(x, 0, W, H);
  ctx.fillStyle = edge; ctx.fillRect(x, 0, 46, H); // leading two-tone band
}
async function ffmpegBin() {
  const m = await import("ffmpeg-static"); const p = m.default || m;
  if (!p || !fs.existsSync(p)) throw new Error("ffmpeg binary not found"); return p;
}
// ── Real video clips inside the brand layouts ── a scene may carry clipPath (an
// AI video whose first frame is the scene photo): its frames are decoded at the
// reel fps and drawn exactly where the photo would be (card, circle, full-bleed),
// so text, wipes and brand shapes stay identical; the last frame holds if the
// clip is shorter than the scene. Streams one frame at a time (no frame files).
const CW = 720, CH = 1280;
// Veo letterboxes the first frame with black when the photo is not exactly 9:16
// (bars that a push-in later fills). Detect the TIGHTEST picture area over the
// whole clip and crop to it, so no black ever shows inside a card or full-bleed.
export function detectCrop(bin, file) {
  return new Promise((res) => {
    // Only the first second (where Veo letterboxes) and only PURE black counts: Veo
    // pads with video-range black (Y 16-21); a black abaya measures Y 40+ with texture — never a "bar".
    const p = spawn(bin, ["-v", "info", "-i", file, "-t", "1", "-an", "-vf", "cropdetect=limit=26:round=2:reset=1", "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] });
    let best = null, buf = "", fw = 0, fh = 0;
    p.stderr.on("data", (d) => { buf += d; const lines = buf.split("\n"); buf = lines.pop();
      for (const l of lines) {
        const sz = l.match(/Stream.*Video.* (\d{3,4})x(\d{3,4})/); if (sz && !fw) { fw = +sz[1]; fh = +sz[2]; }
        const m = l.match(/crop=(\d+):(\d+):(\d+):(\d+)/); if (!m || !fw) continue;
        const [w, h, x, y] = m.slice(1).map(Number), top = y, bot = fh - h - y, lft = x, rgt = fw - w - x;
        const modest = w >= fw * 0.6 && h >= fh * 0.6;
        if (modest && (top > 8 || lft > 8 || bot > 8 || rgt > 8) && (!best || w * h < best[0] * best[1])) best = [w, h, x, y];
      } });
    p.on("close", () => res(best)); p.on("error", () => res(null));
    if (detectCrop.debug) p.stderr.on("data", (d) => { detectCrop.raw = (detectCrop.raw || "") + d; });
  });
}
function openClip(bin, file, fps, crop) {
  const pre = crop ? `crop=${crop.join(":")},` : "";
  const p = spawn(bin, ["-v", "error", "-i", file, "-an", "-vf", `${pre}fps=${fps},scale=${CW}:${CH}:force_original_aspect_ratio=increase,crop=${CW}:${CH}`, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { stdio: ["ignore", "pipe", "ignore"] });
  const out = p.stdout, size = CW * CH * 4;
  const cv = createCanvas(CW, CH), cx = cv.getContext("2d"), img = cx.createImageData(CW, CH);
  // flowing reads into a small queue (paused above ~3 frames = backpressure)
  const q = []; let have = 0, ended = false, wake = null;
  const poke = () => { if (wake) { const w = wake; wake = null; w(); } };
  out.on("data", (c) => { q.push(c); have += c.length; if (have > size * 3) out.pause(); poke(); });
  out.on("end", () => { ended = true; poke(); }); out.on("error", () => { ended = true; poke(); });
  const readExact = async () => {
    while (have < size && !ended) await new Promise((r) => { wake = r; });
    if (have < size) return null;
    let off = 0;
    while (off < size) {
      const c = q[0], take = Math.min(c.length, size - off);
      img.data.set(c.subarray(0, take), off); off += take;
      if (take === c.length) q.shift(); else q[0] = c.subarray(take);
    }
    have -= size; if (have < size * 2 && out.isPaused()) out.resume();
    return true;
  };
  let has = false;
  cv.focusY = 0.3; // video frames: keep faces (upper third) inside cards when the camera moves
  return {
    canvas: cv,
    async next() { if (await readExact()) { cx.putImageData(img, 0, 0); has = true; } return has ? cv : null; },
    close() { try { p.kill("SIGKILL"); } catch (e) {} },
  };
}
// scenes: [{ onScreenText, seconds, transition, layout?, photoPath?, clipPath? }]
export async function renderMotionReel(scenes, outPath, { biz = {}, cta = "", fps = 25, onProgress, audioPath = null, mode = "" } = {}) {
  if (!Array.isArray(scenes) || !scenes.length) throw new Error("no scenes");
  ensureFonts();
  const n = scenes.length;
  const durs = scenes.map((s) => Math.min(8, Math.max(1.5, +s.seconds || 3)));
  const total = durs.reduce((a, b) => a + b, 0);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const bin = await ffmpegBin();
  const proc = spawn(bin, [
    "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(fps), "-i", "-",
    ...(audioPath && fs.existsSync(audioPath) ? ["-i", audioPath] : ["-f", "lavfi", "-t", total.toFixed(2), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"]),
    "-map", "0:v", "-map", "1:a",
    "-c:v", "libx264", "-preset", "fast", "-crf", "21", "-pix_fmt", "yuv420p", "-threads", "1",
    "-x264-params", "ref=1:bframes=0:rc-lookahead=0:keyint=50",
    "-c:a", "aac", "-b:a", audioPath ? "160k" : "96k", "-shortest", "-movflags", "+faststart", outPath,
  ], { stdio: ["pipe", "ignore", "pipe"] });
  let err = ""; proc.stderr.on("data", (d) => { err += d; if (err.length > 6000) err = err.slice(-6000); });
  const done = new Promise((res, rej) => { proc.on("error", rej); proc.on("close", (c) => c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}: ${err.slice(-400)}`))); });
  // wait for each frame to be flushed before the canvas is redrawn
  const writeFrame = (buf) => new Promise((res, rej) => { proc.stdin.write(buf, (e) => e ? rej(e) : res()); });
  const cv = createCanvas(W, H); const ctx = cv.getContext("2d");
  const wipeCol = (k) => k % 2 === 0 ? [BRAND.orange, BRAND.magenta] : [BRAND.magenta, BRAND.orange];
  let frame = 0; const totalFrames = durs.reduce((a, d) => a + Math.round(d * fps), 0);
  try {
    for (let i = 0; i < n; i++) {
      const sc = scenes[i], layout = layoutFor(sc, i, n, { mode }), assets = await loadAssets(sc.photoPath);
      const d = durs[i], N = Math.round(d * fps);
      const clip = sc.clipPath && fs.existsSync(sc.clipPath) ? openClip(bin, sc.clipPath, fps, await detectCrop(bin, sc.clipPath)) : null;
      const wipeOut = i > 0 && String(scenes[i - 1].transition || "") !== "cut";
      const wipeIn = i < n - 1 && String(sc.transition || "") !== "cut";
      for (let f = 0; f < N; f++) {
        const s = f / fps;
        if (clip) { const fr = await clip.next(); if (fr) assets.photo = fr; }
        drawScene(ctx, { layout, scene: sc, assets, biz, cta, t: clamp(s / 0.85), p: s / d, s });
        if (wipeOut && s < WIPE) { const [c, e] = wipeCol(i - 1); drawWipe(ctx, -W * easeInOut(s / WIPE), c, e); }
        if (wipeIn && s > d - WIPE) { const [c, e] = wipeCol(i); drawWipe(ctx, W * (1 - easeInOut((s - (d - WIPE)) / WIPE)), c, e); }
        await writeFrame(cv.data());
        frame++; if (onProgress && frame % 25 === 0) onProgress(frame / totalFrames);
      }
      if (clip) clip.close();
      if (global.gc) { try { global.gc(); } catch (e) {} }
    }
    proc.stdin.end();
    await done;
  } catch (e) { try { proc.stdin.destroy(); proc.kill("SIGKILL"); } catch (x) {} throw e; }
  const fd = fs.openSync(outPath, "r+"); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  return { outPath, seconds: total, frames: totalFrames };
}
