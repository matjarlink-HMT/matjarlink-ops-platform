// Live design engine — renders on-brand MatjarLink post images server-side with
// Skia (correct Arabic shaping + bidi). Rebuilt to match the original professional
// template: clean WHITE canvas, plum/orange rounded-pill corner decorations, the
// MatjarLink logo, a dotted number circle for carousel slides, and a branded
// footer (@matjarlink · phone). Output: publishable 1080x1350 PNG.
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

// Brand palette (sampled from the original professional designs).
const PLUM = "#6E1444", MAGENTA = "#9D1F60", DEEP = "#4E0E30";
const ORANGE = "#E8890F", CREAM = "#FBE3C8", PINK = "#F0D8E6";
const GRAY = "#8A8A93", INK = "#3A2531";

let LOGO;
async function getLogo() {
  if (LOGO === undefined) { try { LOGO = await loadImage(path.join(__dirname, "..", "public", "logo-full.png")); } catch (e) { LOGO = null; } }
  return LOGO;
}
// White (or any-color) silhouette of the logo lockup — for dark reveal slides.
let LOGO_TINTS = {};
async function getTintedLogo(color) {
  if (LOGO_TINTS[color] !== undefined) return LOGO_TINTS[color];
  const img = await getLogo();
  if (!img) return (LOGO_TINTS[color] = null);
  const c = createCanvas(img.width, img.height), x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = color; x.fillRect(0, 0, img.width, img.height);
  return (LOGO_TINTS[color] = c);
}

// ── drawing helpers ──────────────────────────────────────────────────────────
function pill(ctx, cx, cy, len, thick, angleDeg, color, alpha = 1) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(-len / 2, -thick / 2, len, thick, thick / 2); ctx.fill();
  ctx.restore(); ctx.globalAlpha = 1;
}
function sparkle(ctx, cx, cy, r, color) {
  const w = r * 0.26;
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(w, -w, r, 0);
  ctx.quadraticCurveTo(w, w, 0, r);
  ctx.quadraticCurveTo(-w, w, -r, 0);
  ctx.quadraticCurveTo(-w, -w, 0, -r);
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function dottedRing(ctx, cx, cy, radius, dots, dotR, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < dots; i++) {
    const a = (i / dots) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, dotR, 0, Math.PI * 2); ctx.fill();
  }
}
// Corner pill decorations + sparkles — the shared brand frame on every card.
function drawFrame(ctx, W, H) {
  // top-right cluster
  pill(ctx, 892, 66, 560, 82, -33, PLUM);
  pill(ctx, 1016, 198, 250, 82, -33, ORANGE);
  // left cluster (runs off the left edge)
  pill(ctx, 60, 548, 340, 60, -33, CREAM);
  pill(ctx, 40, 652, 300, 60, -33, ORANGE);
  pill(ctx, 92, 756, 322, 60, -33, PINK);
  // sparkles — positioned clear of the centered text column in both modes
  sparkle(ctx, 190, 372, 26, ORANGE);
  sparkle(ctx, 905, 615, 18, PINK);
  sparkle(ctx, 150, 905, 16, PINK);
}
function drawLogo(ctx, img) {
  if (img) ctx.drawImage(img, 78, 46, 250, 250); // logo-full.png is a padded square lockup
}
// Branded footer: @matjarlink · IG glyph · phone · WhatsApp glyph (centered).
// light=true renders the inverted (dark background) variant of the reveal slide.
function drawFooter(ctx, W, H, light = false) {
  const TXT = light ? "#FBE3C8" : PLUM, WA = light ? ORANGE : MAGENTA;
  const y = H - 96;
  ctx.textAlign = "left"; ctx.direction = "ltr";
  ctx.font = "42px TajawalXB"; ctx.fillStyle = TXT;
  const handle = "@matjarlink", phone = "97426620";
  const hw = ctx.measureText(handle).width, pw = ctx.measureText(phone).width;
  const igS = 44, waS = 44, gap = 22, dot = 8;
  const total = hw + gap + igS + gap + dot + gap + pw + gap + waS;
  let x = (W - total) / 2;
  ctx.fillText(handle, x, y + 30); x += hw + gap;
  drawInstagram(ctx, x, y, igS); x += igS + gap;
  ctx.fillStyle = light ? "#ffffff55" : PINK; ctx.beginPath(); ctx.arc(x + dot / 2, y + igS / 2, dot / 2, 0, Math.PI * 2); ctx.fill();
  x += dot + gap;
  ctx.fillStyle = light ? "#fff" : PLUM; ctx.fillText(phone, x, y + 30); x += pw + gap;
  drawWhatsApp(ctx, x, y, waS, WA);
  ctx.direction = "rtl";
}
// Accurate Instagram mark: rounded-square camera body, lens ring, flash dot.
function drawInstagram(ctx, x, y, s) {
  ctx.strokeStyle = ORANGE; ctx.lineWidth = s * 0.095; ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.beginPath(); ctx.roundRect(x + s * 0.06, y + s * 0.06, s * 0.88, s * 0.88, s * 0.30); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s * 0.215, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(x + s * 0.75, y + s * 0.25, s * 0.062, 0, Math.PI * 2); ctx.fill();
}
// Accurate WhatsApp mark: brand bubble with a bottom-left tail + white handset.
function drawWhatsApp(ctx, x, y, s, color = MAGENTA) {
  const cx = x + s / 2, cy = y + s / 2, r = s / 2;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  // speech-bubble tail (bottom-left)
  ctx.beginPath(); ctx.moveTo(cx - r * 0.62, cy + r * 0.72); ctx.lineTo(cx - r * 0.34, cy + r * 0.10); ctx.lineTo(cx + r * 0.06, cy + r * 0.58); ctx.closePath(); ctx.fill();
  // handset: a curved receiver (crescent) with rounded earpiece + mouthpiece
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI * 0.25);
  ctx.fillStyle = "#fff";
  const R = s * 0.31, ri = s * 0.175, mid = (R + ri) / 2, a1 = Math.PI * 0.12, a2 = Math.PI * 0.88;
  ctx.beginPath();
  ctx.arc(0, 0, R, a1, a2, false);
  ctx.arc(0, 0, ri, a2, a1, true);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(Math.cos(a1) * mid, Math.sin(a1) * mid, s * 0.115, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(Math.cos(a2) * mid, Math.sin(a2) * mid, s * 0.115, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
// "اسحب لليسار" swipe hint with an orange triangle, centered.
function drawSwipe(ctx, W, y) {
  ctx.direction = "rtl"; ctx.textAlign = "center"; ctx.font = "34px TajawalXB"; ctx.fillStyle = PLUM;
  const label = "اسحب لليسار"; const lw = ctx.measureText(label).width;
  ctx.fillText(label, W / 2, y);
  ctx.fillStyle = ORANGE; const tx = W / 2 - lw / 2 - 24;
  ctx.beginPath(); ctx.moveTo(tx, y - 16); ctx.lineTo(tx - 20, y - 6); ctx.lineTo(tx, y + 4); ctx.closePath(); ctx.fill();
}
function wrapLines(ctx, text, maxW) {
  const words = (text || "").trim().split(/\s+/); const lines = []; let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

// Cover-fit an image inside a rounded-rect window (the MJ-003/MJ-011 photo style).
function drawPhotoWindow(ctx, img, x, y, w, h, r = 40) {
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
  const ir = img.width / img.height, cr = w / h;
  let dw, dh, dx, dy;
  if (ir > cr) { dh = h; dw = h * ir; dx = x + (w - dw) / 2; dy = y; } else { dw = w; dh = w / ir; dx = x; dy = y + (h - dh) / 2; }
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

// role: "single" | "cover" | "slide". index/carousel/last drive the number circle + swipe.
// headline2: second line rendered in ORANGE (the original two-tone style,
// e.g. "٥ أخطاء" plum + "تقتل مبيعاتك" orange). cta: rotated plum pill text.
export async function renderDesign({ headline = "", headline2 = "", cta = "", body = "", kicker = "", accent = ORANGE, role = "single", index = 0, carousel = false, last = false, photo = null } = {}) {
  const W = 1080, H = 1350, CX = W / 2;
  const cv = createCanvas(W, H);
  const ctx = cv.getContext("2d");

  // ── reveal (الشريحة الختامية) ── inverted brand slide like the originals:
  // plum bg, white logo, white question + cream bridge + orange solution,
  // orange-outline «قريبًا في سلطنة عُمان» pill, light footer.
  if (role === "reveal") {
    ctx.fillStyle = MAGENTA; ctx.fillRect(0, 0, W, H);
    pill(ctx, 990, 90, 420, 78, -33, ORANGE);
    pill(ctx, 880, 240, 300, 70, -33, "#7A0F45");
    pill(ctx, 60, 1030, 330, 64, -33, "#7A0F45");
    pill(ctx, 130, 1150, 300, 64, -33, ORANGE);
    const wl = await getTintedLogo("#ffffff");
    if (wl) ctx.drawImage(wl, CX - 210, 60, 420, 420);
    ctx.textAlign = "center"; ctx.direction = "rtl";
    ctx.fillStyle = "#fff";
    let size = 74; let lines = wrapLines((ctx.font = size + "px TajawalXB", ctx), headline, W - 220);
    while (lines.length > 2 && size > 52) { size -= 6; lines = wrapLines((ctx.font = size + "px TajawalXB", ctx), headline, W - 220); }
    let y = 640;
    for (const ln of lines.slice(0, 3)) { ctx.fillText(ln, CX, y); y += size * 1.3; }
    if (body) { ctx.fillStyle = CREAM; ctx.font = "42px Tajawal"; for (const ln of wrapLines(ctx, body, W - 240).slice(0, 2)) { ctx.fillText(ln, CX, y + 14); y += 66; } y += 22; }
    if (headline2) { ctx.fillStyle = ORANGE; ctx.font = "64px TajawalXB"; for (const ln of wrapLines(ctx, headline2, W - 200).slice(0, 2)) { ctx.fillText(ln, CX, y + 34); y += 86; } y += 20; }
    const pillTxt = cta || "قريبًا في سلطنة عُمان";
    ctx.font = "46px TajawalXB";
    const tw = ctx.measureText(pillTxt).width, pw2 = tw + 130, ph2 = 96, py = Math.max(y + 30, 940);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(CX - pw2 / 2 - 7, py - 7, pw2 + 14, ph2 + 14, (ph2 + 14) / 2); ctx.stroke();
    ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.roundRect(CX - pw2 / 2, py, pw2, ph2, ph2 / 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText(pillTxt, CX, py + 62);
    drawFooter(ctx, W, H, true);
    return cv.toBuffer("image/png");
  }

  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
  drawFrame(ctx, W, H);
  drawLogo(ctx, await getLogo());
  ctx.textAlign = "center"; ctx.direction = "rtl";

  const isSlide = role === "slide";
  let photoImg = null;
  if (photo && !isSlide) { try { photoImg = await loadImage(photo); } catch (e) { console.error("[design] photo:", e.message); } }
  let y;

  if (isSlide && index) {
    // number circle with dotted ring + sparkles
    const ncx = CX, ncy = 440, cr = 92;
    dottedRing(ctx, ncx, ncy, cr + 58, 30, 6, PINK);
    ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(ncx, ncy, cr, 0, Math.PI * 2); ctx.fill();
    sparkle(ctx, ncx + cr + 62, ncy - cr - 6, 22, ORANGE);
    sparkle(ctx, ncx - cr - 70, ncy + cr + 8, 18, PINK);
    ctx.fillStyle = "#fff"; ctx.font = "104px TajawalXB"; ctx.direction = "ltr";
    ctx.fillText(String(index), ncx, ncy + 38); ctx.direction = "rtl";
    y = 660;
  } else {
    const kickY = photoImg ? 396 : 470;
    if (kicker) { ctx.fillStyle = GRAY; ctx.font = "38px TajawalB"; ctx.fillText(kicker, CX, kickY); }
    y = photoImg ? 440 : 560;
  }

  // headline (plum, adaptive) — centered, wrapped (tighter when a photo needs room)
  let size = isSlide ? 62 : photoImg ? 72 : 86;
  const maxW = W - 240;
  const maxLines = isSlide ? 3 : photoImg ? 2 : 4;
  let lines = wrapLines((ctx.font = size + "px TajawalXB", ctx), headline, maxW);
  while (lines.length > maxLines && size > 46) { size -= 6; lines = wrapLines((ctx.font = size + "px TajawalXB", ctx), headline, maxW); }
  lines = lines.slice(0, isSlide ? 3 : photoImg ? 3 : 5);
  const lh = size * 1.28;
  ctx.fillStyle = PLUM; ctx.font = size + "px TajawalXB";
  y += size;
  for (const ln of lines) { ctx.fillText(ln, CX, y); y += lh; }

  // second headline line in orange (the original two-tone hierarchy)
  if (headline2 && !isSlide) {
    const s2 = Math.round(size * 0.86);
    ctx.fillStyle = ORANGE; ctx.font = s2 + "px TajawalXB";
    const l2 = wrapLines(ctx, headline2, maxW).slice(0, 2);
    y += 8;
    for (const ln of l2) { ctx.fillText(ln, CX, y); y += s2 * 1.3; }
    // big orange "!" mark beside the orange line (cover energy, like the originals)
    if (role === "cover") { ctx.save(); ctx.translate(CX + Math.min(ctx.measureText(l2[0] || "").width / 2 + 90, 430), y - s2 * 1.5); ctx.rotate(0.13); ctx.font = Math.round(s2 * 1.7) + "px TajawalXB"; ctx.fillText("!", 0, 0); ctx.restore(); }
  } else {
    // accent underline (short orange bar, centered) — only without an orange line
    ctx.fillStyle = accent; ctx.beginPath(); ctx.roundRect(CX - 70, y - lh + size + 18, 140, 10, 5); ctx.fill();
  }
  y += 24;

  // rotated plum CTA pill (e.g. «احفظها قبل لا تبدأ») — the original save-hook style
  if (cta && !isSlide) {
    ctx.font = "44px TajawalXB";
    const tw = ctx.measureText(cta).width, pw = tw + 96, ph = 84;
    ctx.save(); ctx.translate(CX, y + ph / 2 + 10); ctx.rotate(-0.045);
    ctx.fillStyle = MAGENTA; ctx.beginPath(); ctx.roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText(cta, 0, 15); ctx.restore();
    y += ph + 26;
  }

  // topical photo in a rounded window (the professional MJ-003/MJ-011 layout)
  if (photoImg) {
    const px = 120, pw = W - 240, pTop = y + 26;
    const pBottom = H - (carousel && !last ? 260 : 190); // keep clear of swipe hint / footer
    if (pBottom - pTop > 260) drawPhotoWindow(ctx, photoImg, px, pTop, pw, pBottom - pTop, 44);
    y = pBottom;
  }

  // body (carousel slide detail), centered, regular weight
  if (body && !photoImg) {
    ctx.fillStyle = INK; ctx.font = "40px Tajawal";
    const blines = wrapLines(ctx, body, W - 220).slice(0, 4); const blh = 40 * 1.5;
    y += 22;
    for (const ln of blines) { ctx.fillText(ln, CX, y); y += blh; }
  }

  // swipe hint for carousels (not on the final slide)
  if (carousel && !last) drawSwipe(ctx, W, H - 210);
  drawFooter(ctx, W, H);
  return cv.toBuffer("image/png");
}

// ── Reel frames ── 1080x1920 (9:16) scenes for the generated motion reel ─────
// kind: "hook" (kicker + big headline) | "body" (headline + supporting line)
//       | "cta" (big logo + قريبًا + handle)
export async function renderReelFrame({ kind = "hook", headline = "", body = "", kicker = "" } = {}) {
  const W = 1080, H = 1920, CX = W / 2;
  const cv = createCanvas(W, H);
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
  // brand frame, spread for the taller canvas
  pill(ctx, 892, 66, 560, 82, -33, PLUM);
  pill(ctx, 1016, 198, 250, 82, -33, ORANGE);
  pill(ctx, 60, 828, 340, 60, -33, CREAM);
  pill(ctx, 40, 932, 300, 60, -33, ORANGE);
  pill(ctx, 92, 1036, 322, 60, -33, PINK);
  pill(ctx, 1020, 1520, 320, 66, -33, CREAM);
  sparkle(ctx, 190, 512, 26, ORANGE);
  sparkle(ctx, 905, 795, 18, PINK);
  sparkle(ctx, 170, 1330, 16, PINK);
  const logo = await getLogo();
  ctx.textAlign = "center"; ctx.direction = "rtl";

  if (kind === "cta") {
    if (logo) ctx.drawImage(logo, CX - 290, 470, 580, 580);
    ctx.fillStyle = PLUM; ctx.font = "104px TajawalXB";
    ctx.fillText(headline || "قريبًا", CX, 1180);
    ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.roundRect(CX - 80, 1216, 160, 12, 6); ctx.fill();
    if (body) {
      ctx.fillStyle = INK; ctx.font = "44px Tajawal";
      const bl = wrapLines(ctx, body, W - 240).slice(0, 2);
      let yy = 1330; for (const ln of bl) { ctx.fillText(ln, CX, yy); yy += 66; }
    }
  } else {
    drawLogo(ctx, logo);
    if (kicker) { ctx.fillStyle = GRAY; ctx.font = "44px TajawalB"; ctx.fillText(kicker, CX, 700); }
    let size = kind === "hook" ? 104 : 84;
    const maxW = W - 200;
    let lines = wrapLines((ctx.font = size + "px TajawalXB", ctx), headline, maxW);
    while (lines.length > 3 && size > 56) { size -= 8; lines = wrapLines((ctx.font = size + "px TajawalXB", ctx), headline, maxW); }
    lines = lines.slice(0, 4);
    const lh = size * 1.3;
    let y = 800 + size;
    ctx.fillStyle = PLUM; ctx.font = size + "px TajawalXB";
    for (const ln of lines) { ctx.fillText(ln, CX, y); y += lh; }
    ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.roundRect(CX - 80, y - lh + size + 20, 160, 12, 6); ctx.fill();
    if (body) {
      y += 60; ctx.fillStyle = INK; ctx.font = "46px Tajawal";
      const bl = wrapLines(ctx, body, W - 220).slice(0, 4); const blh = 46 * 1.5;
      for (const ln of bl) { ctx.fillText(ln, CX, y); y += blh; }
    }
  }
  drawFooter(ctx, W, H);
  return cv.toBuffer("image/png");
}
