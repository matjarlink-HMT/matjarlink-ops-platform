// Seed / base state for the ops dashboard.
// In MODE=mock this is served as-is. In MODE=live the comments/messages/insights
// sections are replaced by real API data (see integrations/*), the rest (agents,
// queue, prep, campaigns, accounts) stays here as the team's operating record.

export const agents = [
  { n: "CAIMO", r: "المدير — المشرف العام", c: "#6E1444", st: ["online", "متصل"], task: "يشرف على دفعة يوليو ويوجّه معيار «الطاقة البصرية»", sc: 92, ev: "قيادة متسقة؛ فعّل نموذج الصمت-موافقة ووحّد المعايير.", sug: "أتمتة تقرير يومي موحّد يجمع حالة كل الوكلاء." },
  { n: "Strategy Planner", r: "وكيل التخطيط", c: "#9D1F60", st: ["working", "يعمل"], task: "خطة محتوى الأسبوعين + أعمدة المحتوى ونسبها", sc: 88, ev: "أعمدة واضحة ونِسب متوازنة.", sug: "ابدأ تخطيط دفعة أغسطس مبكرًا." },
  { n: "Content Studio", r: "وكيل المحتوى", c: "#B83B76", st: ["working", "يعمل"], task: "12 كابشن + سكربتات الريلز الثلاثة", sc: 90, ev: "هوكات قوية بعد ضبط اللهجة.", sug: "جهّز بنك عناوين مسبق لتسريع الإنتاج." },
  { n: "Design Studio", r: "وكيل التصميم", c: "#E8890F", st: ["working", "يعمل"], task: "أنتج 32 تصميم + 3 ريلز + 4 ستوريز", sc: 85, ev: "إخراج عالٍ؛ احتاج 4 جولات لمعيار الطاقة البصرية.", sug: "طبّق فحص Stop-the-Scroll قبل الحفظ." },
  { n: "Reviewer (QA)", r: "وكيل المراجعة", c: "#2D6FB3", st: ["idle", "بانتظار"], task: "بانتظار مراجعة إبراهيم/مروة للدفعة", sc: 80, ev: "فحص الادعاءات والهوية سليم.", sug: "أضف فحصًا آليًا لأرقام التواصل قبل النشر." },
  { n: "Localizer", r: "الترجمة والتوطين", c: "#1A7A8A", st: ["idle", "خامل"], task: "لا مهام AR/EN حاليًا", sc: 78, ev: "جاهز للتفعيل عند التوسّع للإنجليزية.", sug: "جهّز مسرد مصطلحات ثابت." },
  { n: "Publish Desk", r: "وكيل النشر", c: "#5E7A1A", st: ["scheduled", "مجدول"], task: "جدولة MJ-001 اليوم 20:30", sc: 82, ev: "ينشر المعتمد فقط.", sug: "اربط الجدولة بـ Meta Business Suite." },
  { n: "Analytics & Insights", r: "وكيل التحليلات", c: "#7A5A1A", st: ["idle", "غير مُفعّل"], task: "بانتظار أول نشر لسحب البيانات عبر Windsor.ai", sc: 0, ev: "لم يُفعّل بعد.", sug: "اربط Windsor.ai الآن ليجهّز خط الأساس." },
  { n: "Knowledge Librarian", r: "أمين قاعدة المعرفة", c: "#3A6E44", st: ["online", "متصل"], task: "يحدّث قاعدة المعرفة وملف التسليم", sc: 90, ev: "توثيق دقيق ومزامنة موثوقة.", sug: "أرشفة أسبوعية مؤرّخة." },
  { n: "Integrations Engineer", r: "وكيل التكاملات", c: "#B0521A", st: ["action", "يحتاج إجراء"], task: "ربط IG/FB مؤكد؛ WhatsApp API معلّق", sc: 70, ev: "التكاملات الأساسية تمت؛ الناقص واتساب.", sug: "فعّل WhatsApp Business API." },
  { n: "Automation Engineer", r: "وكيل الأتمتة", c: "#5A5A7A", st: ["working", "يعمل"], task: "صيانة نظام المهام + سكربتات التوليد", sc: 80, ev: "السكربتات على جهاز المكتب فقط.", sug: "انسخ السكربتات إلى Drive/_Scripts." },
  { n: "Campaigns Manager", r: "الحملات المدفوعة", c: "#8A2A2A", st: ["idle", "خامل"], task: "خامل حتى الإطلاق", sc: 0, ev: "لا حملات قبل الإطلاق (سياسة).", sug: "جهّز جمهورًا مخصصًا وبيكسل مسبقًا." },
  { n: "Creative Innovation", r: "وكيل الابتكار", c: "#B96BB9", st: ["working", "يعمل"], task: "يقترح قوالب وأفكارًا تكسر التكرار", sc: 83, ev: "أدخل ألوان تمييز ثانوية بحساب.", sug: "وثّق كل قالب ناجح في Design_System فورًا." },
  { n: "Community & Platform Steward", r: "مسؤول المنصة والمجتمع", c: "#0E8C6A", st: ["new", "جديد — يُفعّل"], task: "يتابع الحساب، يجمع التعليقات والرسائل، يردّ بإشراف المدير", sc: 0, ev: "أُنشئ 2026-07-12 — بانتظار صلاحية Comment/DM API.", sug: "اربطه بـ Graph API عبر Integrations.", NEW: true }
];

export const needs = [
  { f: "Integrations Engineer", t: ["تكامل", "p-info"], pr: ["عالٍ", "p-bad"], ti: "تفعيل WhatsApp Business API", d: "أهم مسار تحويل للتجار — بدونه تُفقد Leads. يتطلب مزوّدًا وربط رقم 97426620." },
  { f: "Analytics & Insights", t: ["تكامل", "p-info"], pr: ["عالٍ", "p-bad"], ti: "ربط Windsor.ai لسحب بيانات IG/FB", d: "لتجهيز خط الأساس فور نشر MJ-001. يعمل بلا كود عبر OAuth." },
  { f: "Community & Platform Steward", t: ["صلاحية", "p-new"], pr: ["عالٍ", "p-bad"], ti: "صلاحية قراءة/رد التعليقات والرسائل", d: "الوكيل الجديد يحتاج وصول Graph API ليبدأ الرصد والرد." },
  { f: "Design Studio", t: ["توظيف", "p-warn"], pr: ["متوسط", "p-warn"], ti: "توظيف وكيل مونتاج فيديو", d: "الريلز حاليًا موشن آلي؛ وكيل مونتاج يرفع الجودة." },
  { f: "Automation Engineer", t: ["تكامل", "p-info"], pr: ["متوسط", "p-warn"], ti: "أداة جدولة تلقائية للنشر", d: "ربط Business Suite API لجدولة الدفعة بضغطة." },
  { f: "CAIMO", t: ["عملية", "p-idle"], pr: ["منخفض", "p-idle"], ti: "تقرير يومي موحّد من كل الوكلاء", d: "لوحة صباحية تجمع حالة كل وكيل — هذه اللوحة نواته." }
];

export const queue = [
  { id: "MJ-001", t: "كم نظام تستخدم عشان تدير تجارتك؟", ch: "IG", ty: "ريل تشويقي", tyc: "#6E1444", date: "2026-07-12 · 20:30", st: ["اليوم", "p-info"], drive: "1Wy1U6OL_LSSzpRD3Vmsp2ebRO0lC2VHL", cap: "لكل تاجر في عُمان… كم نظام تستخدم عشان تدير تجارتك؟ قريبًا، شيء يجمعها كلها في مكان واحد." },
  { id: "MJ-002", t: "٥ أخطاء تقتل مبيعاتك", ch: "IG", ty: "كاروسيل توعوي", tyc: "#E8890F", date: "2026-07-13 · 20:30", st: ["جاهز للمراجعة", "p-warn"], drive: "1-LPc8wDO-SBRwD2hI-u-ZEyn5AmJmbqV", cap: "٥ أخطاء تخلي متجرك يفشل قبل ما يبدأ. احفظها." },
  { id: "MJ-003", t: "قصتنا بدأت من نفس مكانك", ch: "IG", ty: "منشور علامة", tyc: "#9D1F60", date: "2026-07-15 · 20:00", st: ["جاهز للمراجعة", "p-warn"], drive: "1dyU4jEXNHxdeqGIOCasXnG0Bze7IYwOv", cap: "فريق عُماني عاش نفس تحديات التاجر. قصتنا بدأت من نفس مكانك." },
  { id: "MJ-004", t: "متجرك موجود.. بس المبيعات صفر؟", ch: "IG", ty: "ريل توعوي", tyc: "#B83B76", date: "2026-07-16 · 21:00", st: ["جاهز للمراجعة", "p-warn"], drive: "1xJyfuwqZ4W4PsRXUuCkiY9EyFg9GG5IM", cap: "متجرك موجود بس المبيعات صفر؟ غالبًا السبب واحد من ثلاثة." },
  { id: "MJ-005", t: "استطلاع: أكبر تحدٍّ يواجهك؟", ch: "IG", ty: "تفاعلي + استطلاع", tyc: "#2D6FB3", date: "2026-07-17 · 19:30", st: ["جاهز للمراجعة", "p-warn"], drive: "1uQU_fun0lutQ6CsD7DQVaW_CCaXbDbax", cap: "وش أكبر تحدٍّ يواجهك اليوم في تجارتك؟" },
  { id: "MJ-006", t: "تجارتك كلها في نظام واحد", ch: "IG", ty: "تشويقي", tyc: "#6E1444", date: "2026-07-18 · 20:30", st: ["جاهز للمراجعة", "p-warn"], drive: "1zyVAlQxvmCgI2HXw65jZk657ANzVPLKq", cap: "متجرك والكاشير وحساباتك يشتغلون كفريق واحد. قريبًا." },
  { id: "MJ-007", t: "جهّز منتجاتك للبيع أونلاين", ch: "IG", ty: "كاروسيل توعوي", tyc: "#E8890F", date: "2026-07-19 · 20:30", st: ["جاهز للمراجعة", "p-warn"], drive: "1mxSL2aHJhFL0FrVH24XixsNFOdVB2tQ7", cap: "دليل مختصر خطوة بخطوة لتجهيز منتجاتك للبيع." },
  { id: "MJ-008", t: "شريك ينجح معك", ch: "IG", ty: "منشور علامة", tyc: "#9D1F60", date: "2026-07-21 · 20:00", st: ["جاهز للمراجعة", "p-warn"], drive: "1bI7h9_QI-0ikQhiZOJiwnx0W7Juczdpp", cap: "فرق بين شركة تبيعك خدمة وشريك ينجح معك. أربع قيم." },
  { id: "MJ-009", t: "كم ساعة تضيع في إدخال منتجاتك؟", ch: "IG", ty: "ريل تشويقي", tyc: "#6E1444", date: "2026-07-22 · 21:00", st: ["جاهز للمراجعة", "p-warn"], drive: "1L6JWUk_YElLUH6e5-ZOwAuDjZ4eKXpLB", cap: "شو لو تلقى آلاف العلامات جاهزة مسبقًا؟ قريبًا." },
  { id: "MJ-010", t: "الكاشير التقليدي vs الذكي", ch: "IG", ty: "كاروسيل مقارنة", tyc: "#E8890F", date: "2026-07-23 · 20:30", st: ["جاهز للمراجعة", "p-warn"], drive: "1bd5NI-1upLMX6_PMbnVLyX_rJetZTwiT", cap: "كاشيرك القديم يسجّل المبيعات بس هل يديرها؟" },
  { id: "MJ-011", t: "منشن متجر عُماني تحبه", ch: "IG", ty: "مجتمعي", tyc: "#0E8C6A", date: "2026-07-24 · 19:30", st: ["جاهز للمراجعة", "p-warn"], drive: "1tlVNYWl0OBV5DM9Xz9UyahnRmgkLLDIp", cap: "منشن متجر عُماني جرّبته وعجبك في التعليقات." },
  { id: "MJ-012", t: "وعدنا لك يا تاجر عُمان", ch: "IG", ty: "كاروسيل فاخر", tyc: "#4E0E30", date: "2026-07-25 · 20:30", st: ["جاهز للمراجعة", "p-warn"], drive: "1cxbK8PwW3Q6Ny_R0DKA9DnAUb3GqnCxq", cap: "وعدنا لك يا تاجر عُمان: منصة بلا خبرة تقنية، أدواتك في مكان واحد. قريبًا." }
];

export const prep = [
  { d: "2026-07-14", t: "تكييف «٥ أخطاء» لفيسبوك", ch: "FB", ty: "كاروسيل", ag: "Localizer", st: ["بانتظار المراجعة", "p-warn"] },
  { d: "2026-07-15", t: "بطاقة قناة واتساب الأولى", ch: "WA", ty: "ستوري/بطاقة", ag: "Design Studio", st: ["بانتظار المراجعة", "p-warn"] },
  { d: "2026-07-16", t: "منشور B2B عن التكامل المحاسبي", ch: "LI", ty: "منشور", ag: "Content Studio", st: ["بانتظار المراجعة", "p-warn"] },
  { d: "2026-07-20", t: "تحويل ريل MJ-009 لتيك توك", ch: "TT", ty: "ريل", ag: "Design Studio", st: ["معتمد (صمت)", "p-ok"] },
  { d: "2026-07-28", t: "دفعة أغسطس — بنك الثقة", ch: "IG", ty: "سلسلة", ag: "Strategy Planner", st: ["بانتظار المراجعة", "p-warn"] }
];

export const campaigns = [
  { name: "Meta Ads — حملة وعي", meta: "مخطط · بعد الإطلاق · إنستغرام + فيسبوك", st: ["مخطط", "p-idle"] },
  { name: "Meta Ads — تحويل (Leads)", meta: "مخطط · يعتمد على بيكسل + جمهور مخصص", st: ["مخطط", "p-idle"] }
];

export const published = [
  { t: "MJ-001 — كم نظام تستخدم؟ (ريل)", ch: "IG", d: "2026-07-12 · 20:30", m: "مجدول — ينشر اليوم" },
  { t: "منشور تعريفي سابق", ch: "IG", d: "محفوظ", m: "558 متابعًا · حساب نشط" },
  { t: "صفحة فيسبوك MatjarLink", ch: "FB", d: "مرتبطة", m: "0 منشور جديد بعد" }
];

export const accounts = [
  { ch: "IG", h: "@matjarlink", s: "متصل · 558 متابعًا · نشط", st: ["متصل", "p-ok"] },
  { ch: "FB", h: "MatjarLink", s: "صفحة مرتبطة عبر Business Suite", st: ["متصل", "p-ok"] },
  { ch: "TH", h: "@matjarlink", s: "Threads مرتبط بالحساب", st: ["متصل", "p-ok"] },
  { ch: "WA", h: "WhatsApp Business", s: "يحتاج تفعيل API لبدء الردود", st: ["معلّق", "p-warn"] },
  { ch: "TT", h: "TikTok", s: "مخطط بعد الإطلاق", st: ["مخطط", "p-idle"] },
  { ch: "LI", h: "LinkedIn", s: "مخطط للمحتوى B2B", st: ["مخطط", "p-idle"] }
];

// Sample comments/messages — used in MODE=mock and as fallback when a token is missing.
export const sampleComments = [
  { ch: "IG", who: "@um_ahmad_store", tm: "قبل ساعتين", tx: "متى الإطلاق؟ 🔥 محتاجينكم بسرعة", ref: "على منشور MJ-006", id: "c1", sug: "شكرًا لحماسك 🧡 قريبًا جدًا — فعّل التنبيهات وبتكون أول من يعرف!" },
  { ch: "IG", who: "@salalah_crafts", tm: "قبل ٥ ساعات", tx: "الأسعار كم؟ وهل فيه باقة للمشاريع المنزلية؟", ref: "على منشور MJ-008", id: "c2", sug: "أكيد فيه باقة تناسب المشاريع المنزلية 🙌 راسلنا واتساب 97426620." },
  { ch: "FB", who: "Ahmed Al-Rawahi", tm: "أمس", tx: "فكرة حلوة، بالتوفيق للفريق 👏", ref: "على صفحة الفيسبوك", id: "c3", sug: "يعطيك العافية أحمد 🌟 ترقّب القادم!" }
];
export const sampleMessages = [
  { ch: "IG", who: "@trader_muscat", tm: "قبل ٢٠ دقيقة", tx: "السلام عليكم، أبي أعرف عن الباقات وكيف أبدأ متجري معكم؟", id: "m1", sug: "وعليكم السلام 🌟 نجهّز لك متجرك من البداية. نكمّل هنا أو واتساب 97426620." },
  { ch: "FB", who: "Mona Trading", tm: "قبل ٣ ساعات", tx: "عندكم دعم للكاشير في المحل؟", id: "m2", sug: "نعم 🙌 نربط متجرك بالكاشير والمحاسبة في نظام واحد. قريبًا!" },
  { ch: "WA", who: "رقم +968 …", tm: "معلّق", tx: "(قناة واتساب غير مفعّلة بعد — تظهر الرسائل فور ربط WhatsApp Cloud API)", id: "m3", sug: "" }
];

export const kpis = [
  ["١٤", "وكيلًا في الفريق", "+1 جديد", "p-new"],
  ["١٢", "تصميمًا بانتظار المراجعة", "مهلة الصمت فعّالة", "p-warn"],
  ["٣٩", "إجمالي أصول الدفعة", "32 تصميم · 3 ريلز · 4 ستوري", "p-ok"],
  ["٥٥٨", "متابع على إنستغرام", "قبل الإطلاق", "p-info"]
];

// WhatsApp / DM leads pipeline (mini-CRM). Stages: جديد / مهتم / تفاوض / عميل / معلّق
export const leads = [
  { name: "أم أحمد — منتجات منزلية", ch: "IG", stage: "جديد", note: "سألت عن الباقات ومتى الإطلاق", tm: "اليوم" },
  { name: "salalah_crafts", ch: "IG", stage: "مهتم", note: "يريد باقة للمشاريع المنزلية", tm: "أمس" },
  { name: "trader_muscat", ch: "IG", stage: "مهتم", note: "يريد تجهيز متجر من البداية", tm: "اليوم" },
  { name: "Mona Trading", ch: "FB", stage: "تفاوض", note: "دعم كاشير للمحل + أونلاين", tm: "قبل يومين" },
  { name: "Ahmed Al-Rawahi", ch: "FB", stage: "جديد", note: "تفاعل إيجابي على الصفحة", tm: "أمس" },
  { name: "+968 …", ch: "WA", stage: "معلّق", note: "بانتظار تفعيل قناة واتساب", tm: "—" }
];

export function baseState() {
  return {
    mode: "mock", generatedAt: null,
    agents, needs, queue, prep, campaigns, published, accounts, kpis, leads,
    comments: sampleComments, messages: sampleMessages,
    insights: null,
    connectivity: { meta: false, whatsapp: false, windsor: false }
  };
}
