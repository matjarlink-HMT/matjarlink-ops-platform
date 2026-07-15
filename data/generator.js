// Content generator — Claude turns notes / prompts into on-brand Instagram posts.
// Powers the dashboard's "regenerate from note" and "generate new post" buttons,
// and the server-side schedulers (monthly plan + daily post generation).
// Falls back gracefully (returns null) when no ANTHROPIC_API_KEY is set.
import { chat, claudeReady } from "../integrations/claude.js";

export { claudeReady };

// Accent palette reused across the brand (خمري + برتقالي family).
const PALETTE = ["#6E1444", "#9D1F60", "#B83B76", "#E8890F", "#2D6FB3", "#0E8C6A", "#4E0E30"];
export const pickColor = (n) => PALETTE[Math.abs(n) % PALETTE.length];

const BRAND = `متجرلينك (MatjarLink): منصة عُمانية شاملة للتجار — متجر إلكتروني + كاشير (POS) + محاسبة + تسويق عبر المؤثرين، في مكان واحد. المرحلة: ما قبل الإطلاق (خريف 2026). الجمهور: تجّار عُمان الصغار والمتوسطون.
قواعد المحتوى (التزم بها حرفياً):
- لهجة عُمانية: «شو» لا «وش»؛ ودّية وعملية وموجزة.
- تشويق ما قبل الإطلاق بـ«قريبًا» فقط — بلا ذكر تاريخ إطلاق محدد.
- طاقة بصرية عالية (Visual Energy) + فحص Stop-the-Scroll لكل تصميم.
- لا حملات مدفوعة قبل الإطلاق.
- ألوان العلامة: خمري + برتقالي.
- أعمدة المحتوى: تشويق / توعية بقيمة عملية / علامة وثقة / تفاعل واستطلاع / مجتمعي، وختام شهري فاخر (كاروسيل فاخر).
- أنواع المنشور (ty): «ريل تشويقي» / «كاروسيل توعوي» / «منشور علامة» / «تفاعلي + استطلاع» / «مجتمعي» / «كاروسيل فاخر».`;

// Normalize the slides array (carousel content slides).
function cleanSlides(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((s) => s && (s.t || s.body)).slice(0, 8).map((s) => ({ t: String(s.t || ""), body: String(s.body || "") }));
}

// Normalize reel scenes (hook → value → CTA) for the motion-reel engine.
function cleanScenes(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((s) => s && (s.t || s.body)).slice(0, 4).map((s, i, all) => ({
    kind: i === 0 ? "hook" : i === all.length - 1 ? "cta" : "body",
    headline: String(s.t || ""), body: String(s.body || ""), kicker: String(s.kicker || "")
  }));
}

// Extract the first JSON object/array from a model reply.
function parseJSON(raw) {
  if (!raw) return null;
  const m = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}

// Rewrite an existing post based on the owner's notes.
export async function regeneratePost(item = {}, notes = [], lang = "ar") {
  if (!claudeReady()) return null;
  const noteText = (notes || []).filter(n => n && n.role === "user").map(n => n.text).join(" | ") || "(بدون ملاحظة محددة — حسّن الجودة والهوك)";
  const system = `${BRAND}

أنت «CAIMO»، مدير التسويق في متجرلينك — لست منفّذاً حرفياً. طبّق ملاحظة المالك **بحكمك المهني**: إن كانت في مصلحة الحساب نفّذها، وإن رأيتها تُضعف المنشور (عنوان طويل أو وصفي، هوك ضعيف) فحسّنها مع احترام نيّتها. اجعل العنوان (t) قصيراً قوياً يوقف السكرول (٦ كلمات أو أقل إن أمكن).
المنشور الحالي: العنوان «${item.t || ""}» — النوع «${item.ty || ""}» — الكابشن «${(item.cap || "").slice(0, 400)}».
ملاحظات المالك: ${noteText}
أعد **JSON فقط** بلا أي نص خارج الأقواس بهذا الشكل:
{"t":"<عنوان قصير قوي>","cap":"<كابشن محدّث>","brief":"<بريف تصميم>","photo":"<٢-٤ كلمات إنجليزية تصف صورة خلفية موضوعية مناسبة إن طلب المالك صورة أو كانت تناسب الموضوع — مثل: perfume shop retail / omani small business / online store packaging / cashier point of sale — أو اتركها فارغة \"\" إن كانت بطاقة نصية أنسب>","slides":[<إن كان نوع المنشور «كاروسيل» اجعلها ٤-٦ شرائح محتوى (بعد الغلاف)، كل عنصر {"t":"عنوان الشريحة","body":"سطر أو سطران"}؛ وإلا اتركها []>],"scenes":[<إن كان النوع «ريل» اجعلها ٣ مشاهد فيديو متتابعة: المشهد ١ هوك قصير صادم، المشهد ٢ القيمة/التشويق، المشهد ٣ ختام «قريبًا» — كل عنصر {"t":"سطر المشهد (٦ كلمات أو أقل)","body":"سطر داعم موجز أو \"\"","kicker":"سطر تمهيدي صغير أو \"\"}؛ وإلا اتركها []>]}`;
  const out = parseJSON(await chat([{ role: "user", text: "أعِد التوليد الآن. JSON فقط." }], system));
  if (!out || !out.cap) return null;
  return { t: String(out.t || item.t), cap: String(out.cap), brief: String(out.brief || item.brief || ""), photo: out.photo ? String(out.photo) : "", slides: cleanSlides(out.slides), scenes: cleanScenes(out.scenes) };
}

// Generate a brand-new post. `prompt` is optional free-form direction from the owner.
export async function generatePost({ idNum = 0, date = "", pillar = "", prompt = "" } = {}, lang = "ar") {
  if (!claudeReady()) return null;
  const system = `${BRAND}

أنت وكيل المحتوى في متجرلينك. أنشئ منشور إنستغرام واحداً جديداً${pillar ? ` ضمن عمود المحتوى: «${pillar}»` : ""}${prompt ? ` وفق توجيه المالك: «${prompt}»` : ""}.
أعد **JSON فقط** بلا أي نص خارج الأقواس بهذا الشكل:
{"t":"<عنوان قصير قوي>","ty":"<نوع من: ريل تشويقي/كاروسيل توعوي/منشور علامة/تفاعلي + استطلاع/مجتمعي/كاروسيل فاخر>","cap":"<الكابشن كاملاً باللهجة العُمانية>","brief":"<بريف تصميم: الصيغة + هوك قوي + ألوان خمري/برتقالي + طاقة بصرية عالية + Stop-the-Scroll>","photo":"<٢-٤ كلمات إنجليزية لصورة خلفية موضوعية تناسب المنشور — مثل: omani merchant store / online shopping delivery / retail cashier — أو اتركها فارغة \"\" إن كانت بطاقة نصية أنسب>","slides":[<إن كان النوع «كاروسيل» اجعلها ٤-٦ شرائح محتوى (بعد الغلاف)، كل عنصر {"t":"عنوان قصير للشريحة","body":"سطر أو سطران موجزان"}؛ وإلا اتركها []>]}`;
  const out = parseJSON(await chat([{ role: "user", text: "ولّد المنشور الآن. JSON فقط." }], system));
  if (!out || !out.cap) return null;
  const id = "MJ-" + String(idNum).padStart(3, "0");
  return { id, t: String(out.t || "منشور جديد"), ch: "IG", ty: String(out.ty || "منشور علامة"), tyc: pickColor(idNum), date, st: ["مسودة — بانتظار التصميم", "p-idle"], drive: "", gen: true, cap: String(out.cap), brief: String(out.brief || ""), photoQuery: out.photo ? String(out.photo) : "", slides: cleanSlides(out.slides) };
}

// Generate next month's plan: goal + pillars + 12 dated concepts (no full captions yet).
export async function generatePlan(monthLabel = "", year = 2026, month = 1, lang = "ar") {
  if (!claudeReady()) return null;
  const system = `${BRAND}

أنت وكيل التخطيط في متجرلينك. ضع خطة محتوى إنستغرام لشهر «${monthLabel}» — ١٢ منشوراً موزّعة كل ~يومين بفترات مسائية، تدوّر الأعمدة وتنهي الشهر بكاروسيل فاخر.
أعد **JSON فقط** بهذا الشكل:
{"goal":"<هدف الشهر بجملة>","pillars":["...","...","...","...","..."],"concepts":[{"t":"<عنوان>","ty":"<نوع>","pillar":"<العمود>","day":<رقم اليوم في الشهر>},... 12 عنصر]}`;
  const out = parseJSON(await chat([{ role: "user", text: "ضع الخطة الآن. JSON فقط." }], system));
  if (!out || !Array.isArray(out.concepts)) return null;
  return out;
}
