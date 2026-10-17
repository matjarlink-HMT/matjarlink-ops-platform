// ── Video Studio ── the creative front of the Reels pipeline: a Creative Brief
// and a Script + Storyboard, written by Claude. These are APPROVED by the owner
// BEFORE any (costly) scene production runs. No paid video/audio service is
// required here — this stage is pure planning the owner reviews and edits.
//
// Pipeline: idea → brief → storyboard (review/edit) → scene production →
// montage (FFmpeg) → المونتير review → owner approval → publish queue.
import { chat, claudeReady } from "../integrations/claude.js";
export { claudeReady };

const BRAND = `متجرلينك (MatjarLink): منصة عُمانية شاملة للتجار — متجر إلكتروني + كاشير (POS) + محاسبة، في مكان واحد. قبل الإطلاق. الجمهور: تجّار عُمان الصغار والمتوسطون. ألوان العلامة: وردي خمري #9D1F60 + برتقالي #F9A43C. لهجة عُمانية ودّية عملية. تشويق قبل الإطلاق بـ«قريبًا» فقط.`;

function parseJSON(raw) {
  if (!raw) return null;
  const m = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}

// The 9 creative production modes — guidance, NOT rigid templates. Each shifts
// composition, pacing, text treatment and whether a presenter/voiceover fits.
export const PRODUCTION_MODES = {
  cinematic: { label: "سينمائي (Cinematic Ads)", hint: "لقطات بطيئة مؤثّرة، إضاءة درامية، إيقاع هادئ متصاعد، عنوان قوي واحد، تعليق صوتي عاطفي." },
  comedy: { label: "مشهد كوميدي (Comedy Sketch)", hint: "يبدأ بموقف كوميدي مفاجئ من يوميات التاجر يضحك عليه المشاهد في أول ثانيتين (مفارقة أو ردّة فعل مبالغ فيها قليلاً)، النكتة مفهومة من الصورة والنص حتى بلا صوت، توقيت كوميدي بقطعات سريعة (cut)، ثم انقلاب سريع للحل، وينتهي بابتسامة. فكاهة عُمانية خفيفة من الحياة اليومية، بلا سخرية من أحد." },
  ugc: { label: "محتوى مستخدم (UGC)", hint: "عفوي كأنه تجربة تاجر حقيقي، كاميرا يد، نص بسيط، نبرة صادقة غير إعلانية." },
  talking_head: { label: "مقدّم يتحدث (Talking Head)", hint: "شخصية تخاطب الكاميرا مباشرة، تعليق صوتي متزامن، كلمات مفتاحية تظهر مع الكلام." },
  kinetic: { label: "نصوص متحركة (Kinetic Typography)", hint: "النص هو البطل — كلمات كبيرة متحركة متزامنة مع الإيقاع والصوت، خلفيات بسيطة بالهوية." },
  product: { label: "إبراز منتج/ميزة (Product Showcase)", hint: "تركيز على واجهة التطبيق/الكاشير/التقارير، لقطات قريبة، حركة push-in، إبراز الفائدة." },
  explainer: { label: "شرح مشكلة وحل (Explainer)", hint: "مشكلة التاجر في البداية ثم الحل من متجرلينك، تسلسل منطقي، رسوم توضيحية بسيطة." },
  storytelling: { label: "قصة قصيرة (Storytelling)", hint: "قصة تاجر: مشكلة → تحوّل → حل، قوس عاطفي، تعليق سردي." },
  data: { label: "أرقام وإحصائيات (Data-driven)", hint: "رقم/إحصائية مؤثّرة تُبنى بصرياً، عدّادات ورسوم، إيقاع واضح، مصدر الرقم إن وُجد." },
  hybrid: { label: "مزيج (Hybrid)", hint: "دمج شخصية واقعية + مشاهد منتج + رسوم ونصوص متحركة في أسلوب متجانس." },
};
export const MODE_KEYS = Object.keys(PRODUCTION_MODES);

// ── Stage 1: Creative Brief ── analyze the idea into a production brief.
export async function generateBrief({ idea = "", mode = "explainer", goal = "", audience = "", cap = "", ty = "" } = {}) {
  if (!claudeReady()) return null;
  const m = PRODUCTION_MODES[mode] || PRODUCTION_MODES.explainer;
  const system = `${BRAND}
أنت Creative Director في وكالة إعلانات. حوّل الفكرة إلى **Creative Brief** لريل إنستغرام (9:16) بنمط «${m.label}» — ${m.hint}
الفكرة: «${idea}».${ty ? ` النوع: ${ty}.` : ""}${goal ? ` الهدف المبدئي: ${goal}.` : ""}${audience ? ` الجمهور: ${audience}.` : ""}${cap ? ` سياق/كابشن: ${String(cap).slice(0, 200)}.` : ""}
أعد **JSON فقط**:
{"title":"<عنوان الفكرة قصير>","goal":"<هدف الفيديو بجملة>","audience":"<الجمهور المستهدف>","message":"<الرسالة الرئيسية الواحدة>","problem":"<المشكلة التي يعالجها>","bigIdea":"<الفكرة الإبداعية في جملة>","tone":"<نبرة العلامة>","platform":"instagram-reel","aspect":"9:16","duration":<مدة مستهدفة بالثواني 15-30>,"cta":"<الدعوة للإجراء ≤4 كلمات>"}`;
  const out = parseJSON(await chat([{ role: "user", text: "اكتب الـBrief الآن. JSON فقط." }], system, { maxTokens: 1500 }));
  if (!out || !out.goal) return null;
  out.mode = mode;
  return out;
}

// ── Stage 2: Script & Storyboard ── written like a real Omani agency writer, then
// passed through a separate Arabic copy editor (polishCopy). The owner reviews /
// edits before any production runs.
const HUMAN_RULES = `**اللغة — أهم شرط:**
- اكتب كما يتكلم ويكتب إنسان حقيقي، لا كما يكتب الذكاء الاصطناعي: جمل طبيعية مكتملة ومترابطة، بإيقاع الكلام الحقيقي.
- عربية سليمة نحوياً وإملائياً (الهمزات، التاء المربوطة، حروف الجر: «يحوّل جوالك إلى كاشير» لا «يحوّل جوالك كاشير»).
- التعليق الصوتي (vo) **باللهجة العُمانية** الدارجة، كأن تاجراً عُمانياً من مسقط يكلّم صاحبه في المحل — دافئة وواقعية، لا فصحى ولا لهجة خليجية عامة. استعمل مفردات عُمانية طبيعية حين تناسب الجملة: «شو» (لا «وش» ولا «إيش»)، «بغيت/تبغى»، «زين»، «الحين»، «واجد» (لا «وايد» ولا «مرّة» بمعنى كثير)، «هيه»، «ما شي»، «خلاص»، «يالله». لا تحشُ المفردات حشواً — جملة طبيعية واحدة أصدق من خمس كلمات لهجة مرصوصة. ممنوع اللهجات الأخرى: الشامية والمصرية («كتير، هيك، هلّق، دلوقتي، عايز، إزاي») والنجدية («ذحين، يبيله، مرّة»). النص على الشاشة (onScreenText) بعربية واضحة سليمة.
- ممنوع: النقطتان «..» أو «…» لتقطيع الكلام؛ الجمل المبتورة والكلمات المرصوصة مثل «بيع، كاشير، محاسبة»؛ التعداد الثلاثي المصطنع؛ العبارات الجاهزة مثل «في عالم اليوم» و«ثورة» و«حلول مبتكرة» و«اكتشف» و«لا تفوّت» و«ارتقِ» و«بكل سهولة»؛ المبالغات العامة؛ الأسئلة البلاغية المتتالية؛ أي صياغة تبدو مترجمة.
- كن محدداً وملموساً: تفصيلة حقيقية (فاتورة، زبون ينتظر، آخر الليل، دفتر، علبة الكاش) أقوى من وصف عام.`;
export async function generateStoryboard({ brief = {}, mode = "explainer", note = "" } = {}) {
  if (!claudeReady()) return null;
  const m = PRODUCTION_MODES[mode] || PRODUCTION_MODES[brief.mode] || PRODUCTION_MODES.explainer;
  const dur = Math.min(30, Math.max(12, +brief.duration || 20));
  const system = `${BRAND}
أنت كاتب إعلانات ومخرج إبداعي عُماني بخبرة طويلة في إعلانات السوشيال للعلامات المحلية. اكتب ريل إنستغرام رأسي (9:16) مدته ~${dur} ثانية بنمط «${m.label}» — ${m.hint}
الـBrief: الهدف «${brief.goal || ""}» · الرسالة «${brief.message || ""}» · المشكلة «${brief.problem || ""}» · الفكرة «${brief.bigIdea || ""}» · الجمهور «${brief.audience || ""}» · الـCTA «${brief.cta || ""}».${note ? `\nملاحظة المالك (طبّقها بدقّة، لها الأولوية): ${note}` : ""}
**الفكرة الإبداعية أولاً:** ابنِ الريل حول فكرة واحدة ذكية ومحددة — موقف حقيقي يعيشه التاجر، أو مفارقة، أو لحظة صغيرة يعرفها كل صاحب محل — لا قائمة ميزات. اكتبها في concept بجملة.
${HUMAN_RULES}
**البنية:**
- هوك قوي في أول ٣ ثوانٍ: جملة تمسك المشاهد فوراً.
- ٤-٦ مشاهد، كل مشهد يكمل ما قبله.
- التعليق الصوتي **سرد واحد متصل** موزّع على المشاهد: كل vo جملة طبيعية تُقال في مدة مشهدها — تقريباً كلمتان ونصف في الثانية (مشهد ٤ ثوانٍ ≈ ٨-١٠ كلمات).
- النص على الشاشة **يكمّل الصوت ولا يكرره حرفياً**: عنوان قصير (٢-٦ كلمات)، جملة مكتملة سليمة تلخّص فكرة المشهد.
- **استثناء المشهد الأول:** نصّه على الشاشة هو الهوك نفسه (أو صيغة أقصر منه) — لأن كثيراً من المشاهدين يتابعون بلا صوت، فلازم يقرؤون الهوك.
- المشهد الأخير دعوة طبيعية واضحة؛ لا تكتب اسم «متجرلينك» في نص المشهد الأخير (الشعار يظهر).
لكل مشهد:
- visual: وصف بصري دقيق بالإنجليزية للصورة، واقعي، بلا نص. إن ظهرت شاشة فواجهتها رمزية فقط (أيقونات وأشكال) بلا أرقام أو أسعار أو عملة أو كلمات.
- onScreenText: النص على الشاشة أو "". أي مبلغ بالريال العُماني (ر.ع.) فقط — ممنوع الدولار.
- keywords: [] · cameraMotion: من {push-in, pull-out, pan-left, pan-right, tilt-up, static, handheld} · vo · sfx: "" · transition: من {cut, flash, whip, dissolve, slide}.
قبل أن تعيد الإجابة اقرأ كل سطر في ذهنك: هل يقوله عُماني حقيقي بهذه الطريقة؟ هل هو سليم لغوياً؟ أصلح أي سطر مصطنع.
أعد **JSON فقط**:
{"title":"<عنوان>","concept":"<الفكرة الإبداعية بجملة>","hook":"<الهوك>","music":"<energetic|calm|cinematic|playful>","totalSeconds":${dur},"cta":"<CTA قصير طبيعي>","scenes":[{"n":1,"seconds":<ثوانٍ>,"visual":"<English visual, no text>","onScreenText":"<نص>","keywords":[],"cameraMotion":"push-in","vo":"<تعليق>","sfx":"","transition":"whip"}]}`;
  const out = parseJSON(await chat([{ role: "user", text: "اكتب السيناريو والـStoryboard الآن. JSON فقط." }], system, { maxTokens: 4000 }));
  if (!out || !Array.isArray(out.scenes) || !out.scenes.length) return null;
  out.scenes = out.scenes.map((sc, i) => ({
    n: i + 1,
    seconds: Math.min(8, Math.max(1.5, +sc.seconds || 3)),
    visual: String(sc.visual || ""),
    onScreenText: String(sc.onScreenText || ""),
    keywords: Array.isArray(sc.keywords) ? sc.keywords.map(String).slice(0, 5) : [],
    cameraMotion: String(sc.cameraMotion || "push-in"),
    vo: String(sc.vo || ""),
    sfx: String(sc.sfx || ""),
    transition: String(sc.transition || "whip"),
  }));
  try { await polishCopy(out); } catch (e) { /* keep the writer's draft if the editor fails */ }
  for (const sc of out.scenes) { sc.onScreenText = tidy(sc.onScreenText); sc.vo = tidy(sc.vo); }
  out.hook = tidy(out.hook); out.cta = tidy(out.cta);
  out.totalSeconds = out.scenes.reduce((a, sc) => a + sc.seconds, 0);
  out.mode = mode;
  return out;
}
// Deterministic last line of defence against the most common AI tell (".." / "…").
export function tidy(t) { return String(t || "").replace(/\s*(\.{2,}|…)\s*/g, "، ").replace(/،\s*،/g, "،").replace(/\s+/g, " ").replace(/^[،\s]+|[،\s]+$/g, "").trim(); }

// ── Arabic copy editor ── a separate pass that fixes grammar/spelling and
// rewrites anything that reads machine-made, keeping meaning and timing.
export async function polishCopy(sb) {
  if (!claudeReady() || !sb || !Array.isArray(sb.scenes)) return sb;
  const draft = { hook: sb.hook || "", cta: sb.cta || "", scenes: sb.scenes.map((sc) => ({ n: sc.n, seconds: sc.seconds, onScreenText: sc.onScreenText, vo: sc.vo })) };
  const system = `أنت محرّر لغوي عربي محترف ومدقّق إعلانات خليجي، تراجع نصوص ريل إعلاني لمتجرلينك (منصة عُمانية للتجار) قبل التصوير.
مهمتك:
1. صحّح أي خطأ نحوي أو إملائي أو حرف جر ناقص.
2. أعد صياغة أي سطر يبدو مصطنعاً أو آلياً أو مترجماً ليصبح طبيعياً كما يقوله/يكتبه إنسان عُماني — دون تغيير المعنى أو الفكرة.
3. احذف النقاط المتتالية «..» و«…» والتقطيع المصطنع؛ استخدم الفاصلة أو جملة مكتملة.
4. حافظ على الطول المناسب: vo ≈ كلمتان ونصف لكل ثانية من مدة المشهد؛ onScreenText من ٢ إلى ٦ كلمات.
5. vo باللهجة العُمانية الدارجة (لا تحوّله إلى فصحى أو لهجة خليجية عامة — صحّح فقط ما ليس عُمانياً)؛ onScreenText بعربية سليمة واضحة.
${HUMAN_RULES}
أعد **JSON فقط** بنفس عدد المشاهد وترتيبها: {"hook":"...","cta":"...","scenes":[{"n":1,"onScreenText":"...","vo":"..."}]}`;
  const out = parseJSON(await chat([{ role: "user", text: "النصوص:\n" + JSON.stringify(draft) + "\nراجعها وأعدها JSON فقط." }], system, { maxTokens: 2500 }));
  if (!out || !Array.isArray(out.scenes) || out.scenes.length !== sb.scenes.length) return sb;
  sb.scenes.forEach((sc, i) => { const e = out.scenes[i] || {}; if (e.onScreenText) sc.onScreenText = String(e.onScreenText); if (typeof e.vo === "string") sc.vo = e.vo; });
  if (out.hook) sb.hook = String(out.hook);
  if (out.cta) sb.cta = String(out.cta);
  sb.edited = true;
  return sb;
}
