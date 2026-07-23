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
- أنواع المحتوى الأربعة (ty) — التزم بها حصراً: «تشويق» (إثارة فضول قبل الإطلاق) / «توعية» (لماذا يحتاج التاجر النظام) / «معلومة» (نصيحة أو فائدة عملية) / «إحصائيات» (رقم أو حقيقة سوقية مؤثّرة).
- وزّع الأنواع الأربعة بالتناوب عبر الشهر بتوازن.`;

// Normalize the slides array (carousel content slides). The last slide may carry
// reveal fields (t2 orange solution line, cta pill text) for the inverted closer.
function cleanSlides(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((s) => s && (s.t || s.body)).slice(0, 8).map((s) => ({ t: String(s.t || ""), body: String(s.body || ""), t2: s.t2 ? String(s.t2) : "", cta: s.cta ? String(s.cta) : "" }));
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
export async function regeneratePost(item = {}, notes = [], lang = "ar", prefLine = "") {
  if (!claudeReady()) return null;
  const noteText = (notes || []).filter(n => n && n.role === "user").map(n => n.text).join(" | ") || "(بدون ملاحظة محددة — حسّن الجودة والهوك)";
  const system = `${BRAND}
${prefLine ? prefLine + "\n" : ""}
أنت «CAIMO»، مدير التسويق في متجرلينك — لست منفّذاً حرفياً. طبّق ملاحظة المالك **بحكمك المهني**: إن كانت في مصلحة الحساب نفّذها، وإن رأيتها تُضعف المنشور (عنوان طويل أو وصفي، هوك ضعيف) فحسّنها مع احترام نيّتها. اجعل العنوان (t) قصيراً قوياً يوقف السكرول (٦ كلمات أو أقل إن أمكن).
المنشور الحالي: العنوان «${item.t || ""}» — النوع «${item.ty || ""}» — الكابشن «${(item.cap || "").slice(0, 400)}».
ملاحظات المالك: ${noteText}
أعد **JSON فقط** بلا أي نص خارج الأقواس بهذا الشكل:
{"t":"<السطر الرئيسي للعنوان (يُرسم خمري) — قصير صادم>","t2":"<سطر ثانٍ مكمّل يُرسم برتقالي (نمط العنوان الأصلي ثنائي اللون) — أو \"\">","cta":"<عبارة حث قصيرة ≤4 كلمات تُرسم كحبة مائلة مثل «احفظها قبل لا تبدأ» — أو \"\">","cap":"<كابشن محدّث>","brief":"<بريف تصميم>","photo":"<٢-٤ كلمات إنجليزية تصف صورة خلفية موضوعية مناسبة إن طلب المالك صورة أو كانت تناسب الموضوع — مثل: perfume shop retail / omani small business / online store packaging / cashier point of sale — أو اتركها فارغة \"\" إن كانت بطاقة نصية أنسب>","slides":[<إن كان نوع المنشور «كاروسيل» اجعلها ٤-٦ شرائح محتوى (بعد الغلاف)، كل عنصر {"t":"عنوان الشريحة","body":"سطر أو سطران"} — واجعل الشريحة الأخيرة ختاماً (reveal): {"t":"سؤال ختامي يلخص القيمة","body":"جسر قصير","t2":"جملة الحل تُرسم برتقالية مثل «ومتجرلينك جايب لك الحل»","cta":"قريبًا في سلطنة عُمان"}؛ وإلا اتركها []>],"scenes":[<إن كان النوع «ريل» اجعلها ٣ مشاهد فيديو متتابعة: المشهد ١ هوك قصير صادم، المشهد ٢ القيمة/التشويق، المشهد ٣ ختام «قريبًا» — كل عنصر {"t":"سطر المشهد (٦ كلمات أو أقل)","body":"سطر داعم موجز أو \"\"","kicker":"سطر تمهيدي صغير أو \"\"}؛ وإلا اتركها []>]}`;
  const out = parseJSON(await chat([{ role: "user", text: "أعِد التوليد الآن. JSON فقط." }], system));
  if (!out || !out.cap) return null;
  return { t: String(out.t || item.t), t2: out.t2 ? String(out.t2) : "", cta: out.cta ? String(out.cta) : "", cap: String(out.cap), brief: String(out.brief || item.brief || ""), photo: out.photo ? String(out.photo) : "", slides: cleanSlides(out.slides), scenes: cleanScenes(out.scenes) };
}

// Generate a brand-new post. `prompt` is optional free-form direction from the owner.
export async function generatePost({ idNum = 0, date = "", pillar = "", prompt = "", prefLine = "" } = {}, lang = "ar") {
  if (!claudeReady()) return null;
  const system = `${BRAND}
${prefLine ? prefLine + "\n" : ""}
أنت وكيل المحتوى في متجرلينك. أنشئ منشور إنستغرام واحداً جديداً${pillar ? ` ضمن عمود المحتوى: «${pillar}»` : ""}${prompt ? ` وفق توجيه المالك: «${prompt}»` : ""}.
أعد **JSON فقط** بلا أي نص خارج الأقواس بهذا الشكل:
{"t":"<السطر الرئيسي للعنوان (خمري) — قصير صادم>","t2":"<سطر ثانٍ مكمّل برتقالي أو \"\">","cta":"<عبارة حث ≤4 كلمات كحبة مائلة أو \"\">","ty":"<نوع من: ريل تشويقي/كاروسيل توعوي/منشور علامة/تفاعلي + استطلاع/مجتمعي/كاروسيل فاخر>","cap":"<الكابشن كاملاً باللهجة العُمانية>","brief":"<بريف تصميم: الصيغة + هوك قوي + ألوان خمري/برتقالي + طاقة بصرية عالية + Stop-the-Scroll>","photo":"<٢-٤ كلمات إنجليزية لصورة خلفية موضوعية تناسب المنشور — مثل: omani merchant store / online shopping delivery / retail cashier — أو اتركها فارغة \"\" إن كانت بطاقة نصية أنسب>","slides":[<إن كان النوع «كاروسيل» اجعلها ٤-٦ شرائح محتوى (بعد الغلاف)، كل عنصر {"t":"عنوان قصير للشريحة","body":"سطر أو سطران موجزان"} — واجعل الشريحة الأخيرة ختاماً (reveal): {"t":"سؤال ختامي يلخص القيمة","body":"جسر قصير","t2":"جملة الحل تُرسم برتقالية مثل «ومتجرلينك جايب لك الحل»","cta":"قريبًا في سلطنة عُمان"}؛ وإلا اتركها []>],"scenes":[<إن كان النوع «ريل» اجعلها ٣ مشاهد فيديو متتابعة: هوك صادم ثم القيمة ثم ختام «قريبًا» — كل عنصر {"t":"سطر المشهد (٦ كلمات أو أقل)","body":"سطر داعم موجز أو \"\"","kicker":"سطر تمهيدي صغير أو \"\"}؛ وإلا اتركها []>]}`;
  const out = parseJSON(await chat([{ role: "user", text: "ولّد المنشور الآن. JSON فقط." }], system));
  if (!out || !out.cap) return null;
  const id = "MJ-" + String(idNum).padStart(3, "0");
  return { id, t: String(out.t || "منشور جديد"), t2: out.t2 ? String(out.t2) : "", cta: out.cta ? String(out.cta) : "", ch: "IG", ty: String(out.ty || "منشور علامة"), tyc: pickColor(idNum), date, st: ["مسودة — بانتظار التصميم", "p-idle"], drive: "", gen: true, cap: String(out.cap), brief: String(out.brief || ""), photoQuery: out.photo ? String(out.photo) : "", slides: cleanSlides(out.slides), scenes: cleanScenes(out.scenes) };
}

// Propose 3 alternative scroll-stopping hooks/titles for a post (A/B testing).
// prefLine steers them toward the owner's picked style.
export async function altHooks(item = {}, prefLine = "") {
  if (!claudeReady()) return null;
  const system = `${BRAND}

أنت «CAIMO». اقترح ٣ عناوين بديلة قصيرة توقف السكرول للمنشور التالي — بزوايا مختلفة (سؤال، رقم/قائمة، ألم/فائدة). كل عنوان ٦ كلمات أو أقل باللهجة العُمانية.
المنشور: «${item.t || ""}» — النوع «${item.ty || ""}» — الكابشن «${(item.cap || "").slice(0, 200)}».
${prefLine}
أعد **JSON فقط**: {"hooks":["<عنوان١>","<عنوان٢>","<عنوان٣>"]}`;
  const out = parseJSON(await chat([{ role: "user", text: "اقترح الآن. JSON فقط." }], system));
  const hooks = (out && Array.isArray(out.hooks) ? out.hooks : []).map((h) => String(h || "").trim()).filter(Boolean).slice(0, 3);
  return hooks.length ? hooks : null;
}

// Expand a raw owner idea («فكرة: …») into a plan-row concept.
export async function expandIdea(text = "") {
  if (!claudeReady()) return null;
  const system = `${BRAND}

أنت وكيل التخطيط. حوّل فكرة المالك الخام إلى مفهوم منشور واحد للخطة.
فكرة المالك: «${text.slice(0, 300)}»
أعد **JSON فقط**: {"t":"<عنوان مصقول قصير>","ty":"<النوع الأنسب من الأنواع الستة>","pillar":"<العمود الأنسب>"}`;
  const out = parseJSON(await chat([{ role: "user", text: "حوّلها الآن. JSON فقط." }], system));
  if (!out || !out.t) return null;
  return { t: String(out.t), ty: String(out.ty || "منشور علامة"), pillar: String(out.pillar || "") };
}

// Generate next month's plan: goal + pillars + 12 dated concepts (no full captions yet).
export async function generatePlan(monthLabel = "", year = 2026, month = 1, lang = "ar", perf = "") {
  if (!claudeReady()) return null;
  const system = `${BRAND}

أنت وكيل التخطيط في متجرلينك. ضع خطة محتوى إنستغرام لشهر «${monthLabel}» — ١٢ عنصراً موزّعة كل ~يومين بفترات مسائية، تدوّر أنواع المحتوى الأربعة (تشويق/توعية/معلومة/إحصائيات) بتوازن.${perf ? `\n${perf}` : ""}
توزيع الصيغ (format) مهم: **الريلز والكاروسيل هي الأكثر** والمنشور المفرد أقل — تقريباً ٥ ريل + ٤ كاروسيل + ٣ منشور من الـ١٢.
لكل عنصر اكتب **desc**: وصفاً واضحاً لفكرة البوست — كيف سيكون شكله، ومحتواه، وتفاصيله (للكاروسيل: عن ماذا كل شريحة؛ للريل: تسلسل المشاهد؛ للمنشور: المشهد والرسالة).
أعد **JSON فقط** بهذا الشكل. ty ∈ {تشويق، توعية، معلومة، إحصائيات}؛ format ∈ {ريل، كاروسيل، منشور}:
{"goal":"<هدف الشهر بجملة>","pillars":["تشويق","توعية","معلومة","إحصائيات"],"concepts":[{"t":"<عنوان قصير صادم>","ty":"<تشويق|توعية|معلومة|إحصائيات>","format":"<ريل|كاروسيل|منشور>","day":<رقم اليوم>,"hook":"<هوك قصير>","desc":"<وصف فكرة البوست: شكله ومحتواه وتفاصيله — جملتان أو ثلاث>","points":[<إن كانت الصيغة كاروسيل: ٣-٤ عناوين شرائح قصيرة؛ وإلا []>],"cap":"<كابشن جاهز باللهجة العُمانية>"},... 12 عنصر]}`;
  const out = parseJSON(await chat([{ role: "user", text: "ضع الخطة الآن. JSON فقط." }], system, { maxTokens: 6000 }));
  if (!out || !Array.isArray(out.concepts)) return null;
  return out;
}
