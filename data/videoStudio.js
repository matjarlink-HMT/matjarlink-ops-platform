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

// ── Stage 2: Script & Storyboard ── scenes with visual, on-screen text, camera
// motion, voiceover line, sfx, transition — the owner reviews/edits before prod.
export async function generateStoryboard({ brief = {}, mode = "explainer", note = "" } = {}) {
  if (!claudeReady()) return null;
  const m = PRODUCTION_MODES[mode] || PRODUCTION_MODES[brief.mode] || PRODUCTION_MODES.explainer;
  const dur = Math.min(30, Math.max(12, +brief.duration || 20));
  const system = `${BRAND}
أنت كاتب سيناريو ومخرج إبداعي. اكتب **سيناريو + Storyboard** لريل إنستغرام رأسي (9:16) مدته ~${dur} ثانية بنمط «${m.label}» — ${m.hint}
الـBrief: الهدف «${brief.goal || ""}» · الرسالة «${brief.message || ""}» · المشكلة «${brief.problem || ""}» · الفكرة «${brief.bigIdea || ""}» · الجمهور «${brief.audience || ""}» · الـCTA «${brief.cta || ""}».${note ? `\nملاحظة المالك (طبّقها بدقّة): ${note}` : ""}
قواعد: **هوك قوي في أول ٣ ثوانٍ**؛ ٣-٦ مشاهد؛ كل مشهد يبني على ما قبله؛ النص العربي مختصر وواضح للقراءة على الجوال؛ الانتقالات بسيطة تخدم السرد؛ الاحتراف لا الاستعراض.
لكل مشهد:
- visual: وصف بصري دقيق للمشهد (يُستخدم لتوليد الصورة/المشهد) — بالإنجليزية، واقعي سينمائي، بلا نص على الصورة. وإن ظهرت شاشة جوال/كاشير/لابتوب فواجهتها رمزية فقط (أيقونات وأشكال) بلا أي أرقام أو أسعار أو رموز عملة أو نصوص.
- onScreenText: النص العربي الظاهر على الشاشة (قصير) أو "". أي مبلغ يُكتب بالريال العُماني (ر.ع.) فقط — ممنوع الدولار $.
- keywords: كلمات عربية تُبرز متزامنة مع الصوت (للـkinetic) أو [].
- cameraMotion: من {push-in, pull-out, pan-left, pan-right, tilt-up, static, handheld}.
- vo: سطر التعليق الصوتي العربي لهذا المشهد (باللهجة العُمانية) أو "".
- sfx: مؤثّر صوتي مقترح أو "".
- transition: من {cut, flash, whip, dissolve, slide}.
أعد **JSON فقط**:
{"title":"<عنوان>","hook":"<الهوك قصير>","music":"<مزاج الموسيقى: energetic|calm|cinematic|playful>","totalSeconds":${dur},"cta":"<CTA>","scenes":[{"n":1,"seconds":<ثوانٍ>,"visual":"<English visual, no text>","onScreenText":"<نص عربي أو \\"\\">","keywords":[],"cameraMotion":"push-in","vo":"<تعليق عربي أو \\"\\">","sfx":"","transition":"cut"}]}`;
  const out = parseJSON(await chat([{ role: "user", text: "اكتب السيناريو والـStoryboard الآن. JSON فقط." }], system, { maxTokens: 4000 }));
  if (!out || !Array.isArray(out.scenes) || !out.scenes.length) return null;
  // normalize scenes
  out.scenes = out.scenes.map((s, i) => ({
    n: i + 1,
    seconds: Math.min(8, Math.max(1.5, +s.seconds || 3)),
    visual: String(s.visual || ""),
    onScreenText: String(s.onScreenText || ""),
    keywords: Array.isArray(s.keywords) ? s.keywords.map(String).slice(0, 5) : [],
    cameraMotion: String(s.cameraMotion || "push-in"),
    vo: String(s.vo || ""),
    sfx: String(s.sfx || ""),
    transition: String(s.transition || "cut"),
  }));
  out.totalSeconds = out.scenes.reduce((a, s) => a + s.seconds, 0);
  out.mode = mode;
  return out;
}
