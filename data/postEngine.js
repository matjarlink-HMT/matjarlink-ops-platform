// ── Brand Post Engine ── Instagram feed posts (1080×1350, 4:5) in the NEW
// MatjarLink theme — the same system as the reels' motion engine: magenta
// #9D1F60 + orange #F9A43C + white/cream, Tajawal, ONE highlighted key phrase in
// a pill, photos inside shapes (rounded card / sheet / circle), logo + footer.
// Three compositions so a grid never looks templated: card · split · bold.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { BRAND } from "./motionEngine.js";

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
export const PW = 1080, PH = 1350;
const M = 84; // side margin

function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function circle(ctx, cx, cy, r, fill, a = 1) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
function shadow(ctx, blur = 50, oy = 22, a = 0.25) { ctx.shadowColor = `rgba(40,10,25,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = oy; }
function noShadow(ctx) { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
function cover(ctx, img, x, y, w, h, r = 0, focusY = 0.5) {
  ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip();
  if (!img) { ctx.fillStyle = BRAND.magentaSoft; ctx.fillRect(x, y, w, h); ctx.restore(); return; }
  const ir = img.width / img.height, cr = w / h; let dw, dh;
  if (ir > cr) { dh = h; dw = h * ir; } else { dw = w; dh = w / ir; }
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) * focusY, dw, dh); ctx.restore();
}
function wrap(ctx, text, maxW) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean); const lines = []; let cur = "";
  for (const w of words) { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
// headline (main) + key phrase pill, RTL, fitted into maxW / maxLines
function copyBlock(ctx, { main, key }, x, y, maxW, o = {}) {
  const { size = 96, min = 60, color = BRAND.magenta, pill = BRAND.orange, pillText = BRAND.magentaInk, align = "right", lines = 3 } = o;
  let s = size, m = [], k = [];
  for (; s >= min; s -= 4) { ctx.font = `${s}px MLXB`; m = wrap(ctx, main, maxW); ctx.font = `${Math.round(s * 0.86)}px MLXB`; k = key ? wrap(ctx, key, maxW - 70) : []; if (m.length + k.length <= lines) break; }
  ctx.save(); ctx.direction = "rtl"; ctx.textAlign = align; ctx.textBaseline = "alphabetic";
  const lh = Math.round(s * 1.2);
  ctx.font = `${s}px MLXB`; ctx.fillStyle = color;
  for (const ln of m) { ctx.fillText(ln, x, y + s); y += lh; }
  if (k.length) y += Math.round(s * 0.12);
  const ks = Math.round(s * 0.86), ph = Math.round(ks * 1.34), pad = 32;
  for (const ln of k) {
    ctx.font = `${ks}px MLXB`; const tw = ctx.measureText(ln).width, pw = tw + pad * 2;
    const px = align === "right" ? x - pw : align === "center" ? x - pw / 2 : x;
    ctx.fillStyle = pill; rr(ctx, px, y, pw, ph, ph / 2); ctx.fill();
    ctx.fillStyle = pillText; ctx.textAlign = "center"; ctx.fillText(ln, px + pw / 2, y + ph / 2 + ks * 0.36); ctx.textAlign = align;
    y += ph + 14;
  }
  ctx.restore(); return y;
}
function kicker(ctx, text, x, y, color, align = "right") {
  if (!text) return y; ctx.save(); ctx.direction = "rtl"; ctx.textAlign = align; ctx.font = "38px MLB"; ctx.fillStyle = color; ctx.fillText(text, x, y + 38); ctx.restore(); return y + 64;
}
function ctaPill(ctx, text, x, y, bg, fg, align = "right") {
  if (!text) return; ctx.save(); ctx.direction = "rtl"; ctx.font = "40px MLXB"; const tw = ctx.measureText(text).width, pw = tw + 70, ph = 78;
  const px = align === "right" ? x - pw : align === "center" ? x - pw / 2 : x;
  shadow(ctx, 30, 12, 0.22); ctx.fillStyle = bg; rr(ctx, px, y, pw, ph, ph / 2); ctx.fill(); noShadow(ctx);
  ctx.fillStyle = fg; ctx.textAlign = "center"; ctx.fillText(text, px + pw / 2, y + ph / 2 + 15); ctx.restore();
}
function footer(ctx, biz, color) {
  const ig = String((biz && biz.instagram) || "matjarlink").replace(/^@/, ""), ph = (biz && (biz.phone || biz.whatsapp)) || "";
  ctx.save(); ctx.direction = "ltr"; ctx.textAlign = "left"; ctx.font = "30px MLB"; ctx.fillStyle = color;
  ctx.fillText(`@${ig}${ph ? "   ·   " + ph : ""}`, M, PH - 56); ctx.restore();
}
const logo = (ctx, img, x, y, w) => { if (!img) return; ctx.drawImage(img, x, y, w, w * (img.height / img.width)); };

const LAYOUTS = {
  // cream field · photo in a rounded card · magenta copy below
  card(ctx, a) {
    ctx.fillStyle = BRAND.cream; ctx.fillRect(0, 0, PW, PH);
    circle(ctx, PW - 40, PH - 60, 230, BRAND.orangeSoft, 0.6);
    circle(ctx, 70, 120, 26, BRAND.orange, 1);
    logo(ctx, a.logo, PW - M - 170, 52, 170);
    shadow(ctx); ctx.fillStyle = "#fff"; rr(ctx, M - 24, 170, PW - 2 * M + 48, 650, 52); ctx.fill(); noShadow(ctx);
    cover(ctx, a.photo, M - 24, 170, PW - 2 * M + 48, 650, 52);
    let y = kicker(ctx, a.kicker, PW - M, 860, BRAND.inkSoft);
    y = copyBlock(ctx, a, PW - M, y, PW - 2 * M, { size: 92, min: 60, color: BRAND.magenta, pill: BRAND.magenta, pillText: "#fff", lines: 3 });
    ctaPill(ctx, a.cta, M + 10, PH - 170, BRAND.orange, BRAND.magentaInk, "left");
    footer(ctx, a.biz, BRAND.inkSoft);
  },
  // photo on top · magenta sheet with white copy + orange pill
  split(ctx, a) {
    cover(ctx, a.photo, 0, 0, PW, 760, 0, 0.45);
    const g = ctx.createLinearGradient(0, 0, 0, 260); g.addColorStop(0, "rgba(40,10,25,0.45)"); g.addColorStop(1, "rgba(40,10,25,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, PW, 260);
    logo(ctx, a.logoWhite, PW - M - 175, 52, 175);
    ctx.fillStyle = BRAND.magenta; rr(ctx, 0, 690, PW, PH - 690 + 80, 64); ctx.fill();
    circle(ctx, 110, 760, 46, BRAND.orange, 1);
    let y = kicker(ctx, a.kicker, PW - M, 770, "rgba(255,255,255,0.78)");
    copyBlock(ctx, a, PW - M, y, PW - 2 * M, { size: 88, min: 58, color: "#fff", pill: BRAND.orange, pillText: BRAND.magentaInk, lines: 3 });
    ctaPill(ctx, a.cta, M + 10, PH - 175, "#fff", BRAND.magenta, "left");
    footer(ctx, a.biz, "rgba(255,255,255,0.85)");
  },
  // magenta field · giant white type · photo in a circle with a white ring
  bold(ctx, a) {
    const g = ctx.createLinearGradient(0, 0, PW, PH); g.addColorStop(0, BRAND.magenta); g.addColorStop(1, BRAND.magentaDeep); ctx.fillStyle = g; ctx.fillRect(0, 0, PW, PH);
    circle(ctx, PW - 120, PH - 260, 300, BRAND.magentaSoft, 0.35);
    circle(ctx, 150, 170, 60, BRAND.orange, 1);
    logo(ctx, a.logoWhite, PW - M - 175, 52, 175);
    let y = kicker(ctx, a.kicker, PW - M, 200, "rgba(255,255,255,0.8)");
    copyBlock(ctx, a, PW - M, y, PW - 2 * M, { size: 104, min: 66, color: "#fff", pill: BRAND.orange, pillText: BRAND.magentaInk, lines: 3 });
    const R = 285, cx = PW / 2 + 110, cy = 940;
    circle(ctx, cx, cy, R + 16, "#fff", 1);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip(); cover(ctx, a.photo, cx - R, cy - R, R * 2, R * 2, 0); ctx.restore();
    ctaPill(ctx, a.cta, M + 10, PH - 175, BRAND.orange, BRAND.magentaInk, "left");
    footer(ctx, a.biz, "rgba(255,255,255,0.85)");
  },
};
export const POST_LAYOUTS = Object.keys(LAYOUTS);

// → PNG buffer
export async function renderBrandPost({ layout = "card", photoPath = null, kicker: k = "", main = "", key = "", cta = "قريباً", biz = {} } = {}) {
  ensureFonts();
  const pub = path.join(__dirname, "..", "public");
  const safe = async (p) => { try { return p ? await loadImage(p) : null; } catch (e) { return null; } };
  const a = { photo: await safe(photoPath), logo: await safe(path.join(pub, "logo-full.png")), logoWhite: await safe(path.join(pub, "logo-white.png")), kicker: k, main, key, cta, biz };
  const cv = createCanvas(PW, PH); const ctx = cv.getContext("2d");
  (LAYOUTS[layout] || LAYOUTS.card)(ctx, a);
  return cv.toBuffer("image/png");
}
