// UI translation dictionaries. Interface chrome is fully localized (AR/EN/FA).
// Marketing content (captions, agent tasks) stays in its authored language.
export const LANGS = {
  ar: { name: "العربية", dir: "rtl" },
  en: { name: "English", dir: "ltr" },
  fa: { name: "فارسی", dir: "rtl" }
};

export const I18N = {
  ar: {
    brand_sub: "AI Ops · مركز التشغيل", sub: "لوحة تشغيل فريق الذكاء الاصطناعي — متجرلينك",
    nav_overview: "نظرة عامة", nav_agents: "الفريق (الوكلاء)", nav_needs: "الاحتياجات", nav_queue: "قائمة النشر",
    nav_prep: "قيد الإعداد", nav_analytics: "التحليلات", nav_media: "معرض التصاميم", nav_camp: "الحملات",
    nav_pub: "آخر ما نُشر", nav_comments: "التعليقات", nav_messages: "الرسائل", nav_leads: "عملاء محتملون",
    nav_accounts: "الحسابات", nav_calendar: "تقويم النشر",
    updated: "آخر تحديث", mode_mock: "وضع تجريبي — بيانات نموذجية", mode_live: "وضع حيّ — بيانات حقيقية",
    mode_mock_hint: "أضف المفاتيح وحوّل MODE=live لتفعيل السحب الحيّ.",
    kpi_agents: "وكيلًا في الفريق", kpi_queue: "تصميمًا بانتظار المراجعة", kpi_assets: "إجمالي أصول الدفعة", kpi_followers: "متابع على إنستغرام",
    perf: "الأداء", notConnected: "غير مربوط — أضف WINDSOR_API_KEY", today_title: "أولويات اليوم", alerts_title: "تنبيهات تحتاج قراراً",
    reply: "رد", sent: "أُرسل الرد", sent_sim: "محاكاة (فعّل MODE=live للإرسال الحقيقي)", save: "حفظ ملاحظة", approve: "اعتماد", next: "التالي",
    note_ph: "اكتب ملاحظتك… (بلا ملاحظة = اعتماد تلقائي عند المهلة)", noteSaved: "حُفظت الملاحظة — الحالة: قيد التعديل", approvedMsg: "اعتُمد — سيُنشر في موعده",
    openDrive: "افتح في Drive", playHint: "اضغط للعرض داخل الموقع", noteBadge: "ملاحظة",
    reach: "الوصول", impressions: "الظهور", engagement: "التفاعل", clicks: "النقرات", followers: "المتابعون", engRate: "معدل التفاعل",
    range7: "٧ أيام", range30: "٣٠ يوم", comparison: "مقارنة المنصات", inactive: "غير مُفعّلة",
    eval: "التقييم", noScore: "لا تقييم بعد", selfSug: "اقتراح ذاتي", priority: "الأولوية", waitingChannel: "بانتظار تفعيل القناة",
    stage_جديد: "جديد", stage_مهتم: "مهتم", stage_تفاوض: "تفاوض", stage_عميل: "عميل", stage_معلّق: "معلّق",
    install: "ثبّت كتطبيق", notif: "التنبيهات", notif_none: "لا تنبيهات جديدة", refreshOn: "تحديث تلقائي",
    campNone: "لا حملات مدفوعة نشطة", campPolicy: "سياسة ما قبل الإطلاق. المخطّط لاحقًا:",
    mediaShare: "لعرض التصاميم داخل الموقع، شارِك مجلد Designs/Batch_July في Drive كـ«أي شخص لديه الرابط — مُشاهد».",
    cal_pub: "نشر", cal_start: "بدء تصميم"
  },
  en: {
    brand_sub: "AI Ops · Command Center", sub: "AI marketing team operations — MatjarLink",
    nav_overview: "Overview", nav_agents: "Team (Agents)", nav_needs: "Needs", nav_queue: "Publish Queue",
    nav_prep: "In Preparation", nav_analytics: "Analytics", nav_media: "Media Gallery", nav_camp: "Campaigns",
    nav_pub: "Published", nav_comments: "Comments", nav_messages: "Messages", nav_leads: "Leads",
    nav_accounts: "Accounts", nav_calendar: "Calendar",
    updated: "Updated", mode_mock: "Demo mode — sample data", mode_live: "Live mode — real data",
    mode_mock_hint: "Add keys and set MODE=live to pull real data.",
    kpi_agents: "team agents", kpi_queue: "designs pending review", kpi_assets: "total batch assets", kpi_followers: "Instagram followers",
    perf: "Performance", notConnected: "Not connected — add WINDSOR_API_KEY", today_title: "Today's priorities", alerts_title: "Alerts needing action",
    reply: "Reply", sent: "Reply sent", sent_sim: "Simulated (set MODE=live to send)", save: "Save note", approve: "Approve", next: "Next",
    note_ph: "Write your note… (no note = auto-approved at deadline)", noteSaved: "Note saved — status: editing", approvedMsg: "Approved — will publish on schedule",
    openDrive: "Open in Drive", playHint: "Tap to preview in-site", noteBadge: "note",
    reach: "Reach", impressions: "Impressions", engagement: "Engagement", clicks: "Clicks", followers: "Followers", engRate: "Engagement rate",
    range7: "7 days", range30: "30 days", comparison: "Platform comparison", inactive: "inactive",
    eval: "Score", noScore: "No score yet", selfSug: "Self-suggestion", priority: "Priority", waitingChannel: "Awaiting channel activation",
    "stage_جديد": "New", "stage_مهتم": "Interested", "stage_تفاوض": "Negotiation", "stage_عميل": "Customer", "stage_معلّق": "Pending",
    install: "Install app", notif: "Notifications", notif_none: "No new alerts", refreshOn: "Auto-refresh",
    campNone: "No active paid campaigns", campPolicy: "Pre-launch policy. Planned:",
    mediaShare: "To preview designs in-site, share the Drive folder Designs/Batch_July as “Anyone with the link — Viewer”.",
    cal_pub: "publish", cal_start: "design start"
  },
  fa: {
    brand_sub: "AI Ops · مرکز فرماندهی", sub: "عملیات تیم بازاریابی هوش مصنوعی — متجرلینک",
    nav_overview: "نمای کلی", nav_agents: "تیم (ایجنت‌ها)", nav_needs: "نیازها", nav_queue: "صف انتشار",
    nav_prep: "در حال آماده‌سازی", nav_analytics: "تحلیل‌ها", nav_media: "گالری طرح‌ها", nav_camp: "کمپین‌ها",
    nav_pub: "منتشر شده", nav_comments: "نظرات", nav_messages: "پیام‌ها", nav_leads: "سرنخ‌ها",
    nav_accounts: "حساب‌ها", nav_calendar: "تقویم انتشار",
    updated: "آخرین بروزرسانی", mode_mock: "حالت آزمایشی — داده نمونه", mode_live: "حالت زنده — داده واقعی",
    mode_mock_hint: "کلیدها را اضافه و MODE=live کنید تا داده واقعی بیاید.",
    kpi_agents: "ایجنت تیم", kpi_queue: "طرح در انتظار بررسی", kpi_assets: "کل دارایی‌های دسته", kpi_followers: "دنبال‌کننده اینستاگرام",
    perf: "عملکرد", notConnected: "متصل نیست — WINDSOR_API_KEY را اضافه کنید", today_title: "اولویت‌های امروز", alerts_title: "هشدارهای نیازمند اقدام",
    reply: "پاسخ", sent: "پاسخ ارسال شد", sent_sim: "شبیه‌سازی (برای ارسال MODE=live کنید)", save: "ذخیره یادداشت", approve: "تأیید", next: "بعدی",
    note_ph: "یادداشت خود را بنویسید… (بدون یادداشت = تأیید خودکار)", noteSaved: "یادداشت ذخیره شد — وضعیت: در حال ویرایش", approvedMsg: "تأیید شد — طبق برنامه منتشر می‌شود",
    openDrive: "باز کردن در Drive", playHint: "برای نمایش در سایت بزنید", noteBadge: "یادداشت",
    reach: "دسترسی", impressions: "نمایش", engagement: "تعامل", clicks: "کلیک‌ها", followers: "دنبال‌کنندگان", engRate: "نرخ تعامل",
    range7: "۷ روز", range30: "۳۰ روز", comparison: "مقایسه پلتفرم‌ها", inactive: "غیرفعال",
    eval: "امتیاز", noScore: "هنوز امتیازی نیست", selfSug: "پیشنهاد خودکار", priority: "اولویت", waitingChannel: "در انتظار فعال‌سازی کانال",
    "stage_جديد": "جدید", "stage_مهتم": "علاقه‌مند", "stage_تفاوض": "مذاکره", "stage_عميل": "مشتری", "stage_معلّق": "معلق",
    install: "نصب برنامه", notif: "اعلان‌ها", notif_none: "هشدار جدیدی نیست", refreshOn: "بروزرسانی خودکار",
    campNone: "کمپین پولی فعالی نیست", campPolicy: "سیاست پیش از راه‌اندازی. برنامه‌ریزی‌شده:",
    mediaShare: "برای نمایش طرح‌ها در سایت، پوشه Designs/Batch_July در Drive را «هر کسی با لینک — بیننده» کنید.",
    cal_pub: "انتشار", cal_start: "شروع طراحی"
  }
};
