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
function drawSwipe(ctx, W, y, light = false) {
  ctx.direction = "rtl"; ctx.textAlign = "center"; ctx.font = "34px TajawalXB"; ctx.fillStyle = light ? "#FBE3C8" : PLUM;
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

// Cover-fit an image inside a rounded-rect window (the MJ-003/MJ-011 photo
// style) with brand treatment: unified vibrance, a subtle plum wash, a top
// depth gradient tying it to the headline, and a warm glow at the base.
// focusY: vertical crop anchor when the image is taller than the window
// (0 = keep the top, 0.5 = center). Portrait PEOPLE need a top bias so the
// face/headdress survives the crop instead of the chest.
function drawPhotoWindow(ctx, img, x, y, w, h, r = 40, focusY = 0.5) {
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
  const ir = img.width / img.height, cr = w / h;
  let dw, dh, dx, dy;
  if (ir > cr) { dh = h; dw = h * ir; dx = x + (w - dw) / 2; dy = y; } else { dw = w; dh = w / ir; dx = x; dy = y + (h - dh) * focusY; }
  ctx.filter = "saturate(1.08) contrast(1.06) brightness(1.02)"; // evens out mixed stock
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.filter = "none";
  // plum wash unifies any photo with the brand world
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "rgba(110,20,68,0.10)"; ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = "source-over";
  const tg = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
  tg.addColorStop(0, "rgba(78,14,48,0.28)"); tg.addColorStop(1, "rgba(78,14,48,0)");
  ctx.fillStyle = tg; ctx.fillRect(x, y, w, h * 0.5);
  ctx.globalCompositeOperation = "soft-light";
  const og = ctx.createLinearGradient(0, y + h * 0.55, 0, y + h);
  og.addColorStop(0, "rgba(232,137,15,0)"); og.addColorStop(1, "rgba(232,137,15,0.35)");
  ctx.fillStyle = og; ctx.fillRect(x, y + h * 0.55, w, h * 0.45);
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
  // hairline frame seats the window on the white canvas
  ctx.strokeStyle = "rgba(110,20,68,0.18)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, r); ctx.stroke();
}

// role: "single" | "cover" | "slide". index/carousel/last drive the number circle + swipe.
// headline2: second line rendered in ORANGE (the original two-tone style,
// e.g. "٥ أخطاء" plum + "تقتل مبيعاتك" orange). cta: rotated plum pill text.
// template: "classic" (white pro) | "luxe" (dark plum premium) | "spotlight" (full-bleed photo)
export async function renderDesign({ headline = "", headline2 = "", cta = "", body = "", kicker = "", accent = ORANGE, role = "single", index = 0, carousel = false, last = false, photo = null, template = "classic" } = {}) {
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
    if (headline2) { ctx.fillStyle = accent; ctx.font = "64px TajawalXB"; for (const ln of wrapLines(ctx, headline2, W - 200).slice(0, 2)) { ctx.fillText(ln, CX, y + 34); y += 86; } y += 20; }
    const pillTxt = cta || "قريبًا في سلطنة عُمان";
    ctx.font = "46px TajawalXB";
    const tw = ctx.measureText(pillTxt).width, pw2 = tw + 130, ph2 = 96, py = Math.max(y + 30, 940);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(CX - pw2 / 2 - 7, py - 7, pw2 + 14, ph2 + 14, (ph2 + 14) / 2); ctx.stroke();
    ctx.fillStyle = accent; ctx.beginPath(); ctx.roundRect(CX - pw2 / 2, py, pw2, ph2, ph2 / 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText(pillTxt, CX, py + 62);
    drawFooter(ctx, W, H, true);
    return cv.toBuffer("image/png");
  }

  const isSlide = role === "slide";
  let photoImg = null;
  if (photo && !isSlide) { try { photoImg = await loadImage(photo); } catch (e) { console.error("[design] photo:", e.message); } }

  // ── template background ──────────────────────────────────────────────────
  const TPL = template || "classic";
  const darkBg = TPL === "luxe" || TPL === "spotlight"; // spotlight is dark-themed even if the photo fails
  if (TPL === "spotlight" && photoImg) {
    const ir = photoImg.width / photoImg.height, cr = W / H; let dw, dh, dx, dy;
    if (ir > cr) { dh = H; dw = H * ir; dx = (W - dw) / 2; dy = 0; } else { dw = W; dh = W / ir; dx = 0; dy = (H - dh) / 2; }
    ctx.drawImage(photoImg, dx, dy, dw, dh);
    ctx.fillStyle = "rgba(62,10,38,0.55)"; ctx.fillRect(0, 0, W, H);
    const gg = ctx.createLinearGradient(0, H * 0.35, 0, H); gg.addColorStop(0, "rgba(45,8,30,0)"); gg.addColorStop(1, "rgba(45,8,30,0.92)");
    ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
    pill(ctx, 940, 70, 360, 74, -33, ORANGE);
    photoImg = null; // consumed as the background — skip the inset window
  } else if (TPL === "luxe" || TPL === "spotlight") {
    const g = ctx.createLinearGradient(0, 0, W * 0.5, H); g.addColorStop(0, MAGENTA); g.addColorStop(1, DEEP);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    pill(ctx, 905, 84, 460, 80, -33, ORANGE); pill(ctx, 150, H - 100, 360, 66, -33, "#7A0F45"); pill(ctx, 250, H - 12, 320, 66, -33, ORANGE);
    sparkle(ctx, 190, 430, 26, ORANGE); sparkle(ctx, 905, 720, 18, CREAM);
  } else {
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    drawFrame(ctx, W, H);
  }
  drawLogo(ctx, darkBg ? await getTintedLogo("#ffffff") : await getLogo());
  ctx.textAlign = "center"; ctx.direction = "rtl";
  const HEAD = darkBg ? "#ffffff" : PLUM, SUB = darkBg ? CREAM : GRAY;
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
    if (kicker) { ctx.fillStyle = SUB; ctx.font = "38px TajawalB"; ctx.fillText(kicker, CX, kickY); }
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
  ctx.fillStyle = HEAD; ctx.font = size + "px TajawalXB";
  y += size;
  for (const ln of lines) { ctx.fillText(ln, CX, y); y += lh; }

  // second headline line in orange (the original two-tone hierarchy)
  if (headline2 && !isSlide) {
    const s2 = Math.round(size * 0.86);
    ctx.fillStyle = accent; ctx.font = s2 + "px TajawalXB";
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
    // A portrait PERSON (a brand character) keeps the same window but anchors the
    // crop near the face so the head/headdress survive instead of the chest; a
    // landscape stock photo stays centered.
    const isPortrait = photoImg.height > photoImg.width * 1.15;
    const px = 120, pw = W - 240, pTop = y + 26;
    const pBottom = H - (carousel && !last ? 260 : 190); // keep clear of swipe hint / footer
    if (pBottom - pTop > 260) drawPhotoWindow(ctx, photoImg, px, pTop, pw, pBottom - pTop, 44, isPortrait ? 0.17 : 0.5);
    y = pBottom;
  }

  // body (carousel slide detail), centered, regular weight
  if (body && !photoImg) {
    ctx.fillStyle = darkBg ? "#F3DCE8" : INK; ctx.font = "40px Tajawal";
    const blines = wrapLines(ctx, body, W - 220).slice(0, 4); const blh = 40 * 1.5;
    y += 22;
    for (const ln of blines) { ctx.fillText(ln, CX, y); y += blh; }
  }

  // swipe hint for carousels (not on the final slide)
  if (carousel && !last) drawSwipe(ctx, W, H - 210, darkBg);
  drawFooter(ctx, W, H, darkBg);
  return cv.toBuffer("image/png");
}

// ── Story ── 1080x1920 branded "new on the profile" companion for a feed post ─
export async function renderStory({ title = "", badge = "جديد في البروفايل" } = {}) {
  const W = 1080, H = 1920, CX = W / 2;
  const cv = createCanvas(W, H);
  const ctx = cv.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, W * 0.5, H);
  g.addColorStop(0, MAGENTA); g.addColorStop(1, DEEP);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // corner pills (lighter on the dark ground)
  pill(ctx, 900, 120, 460, 84, -33, ORANGE);
  pill(ctx, 150, 1720, 360, 70, -33, "#8A1A50");
  pill(ctx, 250, 1830, 320, 70, -33, ORANGE);
  sparkle(ctx, 200, 520, 30, ORANGE); sparkle(ctx, 900, 1380, 22, "#F0D8E6");
  const wl = await getTintedLogo("#ffffff");
  if (wl) ctx.drawImage(wl, CX - 190, 300, 380, 380);
  ctx.textAlign = "center"; ctx.direction = "rtl";
  // badge pill
  ctx.font = "48px TajawalXB";
  const bw = ctx.measureText(badge).width, bpw = bw + 120;
  ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.roundRect(CX - bpw / 2, 760, bpw, 100, 50); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.fillText(badge, CX, 826);
  // title
  ctx.fillStyle = "#fff"; let size = 92;
  let lines = wrapLines((ctx.font = size + "px TajawalXB", ctx), title, W - 200);
  while (lines.length > 3 && size > 60) { size -= 8; lines = wrapLines((ctx.font = size + "px TajawalXB", ctx), title, W - 200); }
  let y = 1030 + size;
  for (const ln of lines.slice(0, 4)) { ctx.fillText(ln, CX, y); y += size * 1.3; }
  // "see it now" cue + a drawn up-chevron (no emoji — the font lacks them)
  const cueY = Math.max(y + 70, 1500);
  ctx.fillStyle = CREAM; ctx.font = "52px TajawalXB"; ctx.fillText("اطّلع عليه الآن", CX, cueY);
  ctx.strokeStyle = ORANGE; ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(CX - 26, cueY + 46); ctx.lineTo(CX, cueY + 20); ctx.lineTo(CX + 26, cueY + 46); ctx.stroke();
  ctx.lineCap = "butt";
  drawFooter(ctx, W, H, true);
  return cv.toBuffer("image/png");
}

// ── Reel frames ── 1080x1920 (9:16) scenes for the generated motion reel ─────
// kind: "hook" (kicker + big headline) | "body" (headline + supporting line)
//       | "cta" (big logo + قريبًا + handle)
export async function renderReelFrame({ kind = "hook", headline = "", body = "", kicker = "", template = "classic" } = {}) {
  const W = 1080, H = 1920, CX = W / 2;
  const cv = createCanvas(W, H);
  const ctx = cv.getContext("2d");
  const dark = template === "luxe" || template === "spotlight";
  if (dark) {
    const g = ctx.createLinearGradient(0, 0, W * 0.5, H); g.addColorStop(0, MAGENTA); g.addColorStop(1, DEEP);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    pill(ctx, 905, 84, 460, 82, -33, ORANGE); pill(ctx, 60, 828, 340, 60, -33, "#7A0F45");
    pill(ctx, 40, 932, 300, 60, -33, ORANGE); pill(ctx, 1020, 1560, 320, 66, -33, "#7A0F45");
    sparkle(ctx, 190, 512, 26, ORANGE); sparkle(ctx, 905, 795, 18, CREAM); sparkle(ctx, 170, 1330, 16, CREAM);
  } else {
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    pill(ctx, 892, 66, 560, 82, -33, PLUM); pill(ctx, 1016, 198, 250, 82, -33, ORANGE);
    pill(ctx, 60, 828, 340, 60, -33, CREAM); pill(ctx, 40, 932, 300, 60, -33, ORANGE); pill(ctx, 92, 1036, 322, 60, -33, PINK);
    pill(ctx, 1020, 1520, 320, 66, -33, CREAM);
    sparkle(ctx, 190, 512, 26, ORANGE); sparkle(ctx, 905, 795, 18, PINK); sparkle(ctx, 170, 1330, 16, PINK);
  }
  const HEAD = dark ? "#ffffff" : PLUM, SUB = dark ? CREAM : GRAY, BODY = dark ? "#F3DCE8" : INK;
  const logo = dark ? await getTintedLogo("#ffffff") : await getLogo();
  ctx.textAlign = "center"; ctx.direction = "rtl";

  if (kind === "cta") {
    if (logo) ctx.drawImage(logo, CX - 290, 470, 580, 580);
    ctx.fillStyle = HEAD; ctx.font = "104px TajawalXB";
    ctx.fillText(headline || "قريبًا", CX, 1180);
    ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.roundRect(CX - 80, 1216, 160, 12, 6); ctx.fill();
    if (body) {
      ctx.fillStyle = BODY; ctx.font = "44px Tajawal";
      const bl = wrapLines(ctx, body, W - 240).slice(0, 2);
      let yy = 1330; for (const ln of bl) { ctx.fillText(ln, CX, yy); yy += 66; }
    }
  } else {
    drawLogo(ctx, logo);
    if (kicker) { ctx.fillStyle = SUB; ctx.font = "44px TajawalB"; ctx.fillText(kicker, CX, 700); }
    let size = kind === "hook" ? 104 : 84;
    const maxW = W - 200;
    let lines = wrapLines((ctx.font = size + "px TajawalXB", ctx), headline, maxW);
    while (lines.length > 3 && size > 56) { size -= 8; lines = wrapLines((ctx.font = size + "px TajawalXB", ctx), headline, maxW); }
    lines = lines.slice(0, 4);
    const lh = size * 1.3;
    let y = 800 + size;
    ctx.fillStyle = HEAD; ctx.font = size + "px TajawalXB";
    for (const ln of lines) { ctx.fillText(ln, CX, y); y += lh; }
    ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.roundRect(CX - 80, y - lh + size + 20, 160, 12, 6); ctx.fill();
    if (body) {
      y += 60; ctx.fillStyle = BODY; ctx.font = "46px Tajawal";
      const bl = wrapLines(ctx, body, W - 220).slice(0, 4); const blh = 46 * 1.5;
      for (const ln of bl) { ctx.fillText(ln, CX, y); y += blh; }
    }
  }
  drawFooter(ctx, W, H, dark);
  return cv.toBuffer("image/png");
}
