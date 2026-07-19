// Brand characters — authentic Omani people generated with Gemini and adopted
// by the owner, then composited into the ORIGINAL brand design system by our own
// engine (spotlight template). These live in the repo (public/assets/characters)
// so they deploy with the app; the render engine reads them off disk and bakes
// them into the final design PNG, so the raw asset never needs to be public.
//
// Authenticity rule (see owner-design-preferences memory): Omani identity ONLY —
// the massar (wrapped turban) or the embroidered kummah + white Omani dishdasha;
// never the Gulf ghutra+egal. Add new members here as they are generated/adopted.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const charDir = () => path.join(__dirname, "..", "public", "assets", "characters");

// portrait: true → hero portrait (face-anchored in the classic window). Others are
// wider scene shots that work best full-bleed (spotlight) or in the photo window.
export const CHARACTERS = [
  // — portrait heroes —
  { id: "omani-massar", label: "تاجر عُماني · مصر", file: "omani-massar-merchant.png", dress: "المصر العُماني الملفوف + دشداشة بيضاء", portrait: true },
  { id: "omani-kummah", label: "تاجر عُماني · كمة", file: "omani-kummah.png", dress: "الكمة العُمانية المطرزة + دشداشة (محل عطور)", portrait: true },
  { id: "omani-massar-tablet", label: "تاجر عُماني · مصر + جهاز", file: "omani-massar-tablet.png", dress: "المصر العُماني + دشداشة، يمسك تابلت", portrait: true },
  { id: "omani-shopkeeper", label: "صاحب بقالة عُماني · كمة", file: "omani-shopkeeper.png", dress: "الكمة العُمانية + دشداشة (بقالة تقليدية)", portrait: true },
  { id: "omani-analytics-tablet", label: "تاجر عُماني · تحليلات", file: "omani-analytics-tablet.png", dress: "كمة عُمانية، يمسك تابلت التحليلات في مكتب", portrait: true },
  // — women & mixed —
  { id: "omani-woman-shopkeeper", label: "بائعة عُمانية · كاشير", file: "omani-woman-shopkeeper.png", dress: "سيدة عُمانية بالحجاب تخدم عميلة عند الكاشير" },
  { id: "omani-pos-boutique", label: "كاشير + عميلة · بوتيك", file: "omani-pos-boutique.png", dress: "تاجر عُماني وعميلة عُمانية عند نقطة البيع في بوتيك" },
  { id: "omani-pos-mosque", label: "كاشير + عميلة · إطلالة جامع", file: "omani-pos-mosque.png", dress: "تاجر وعميلة عُمانيان عند الكاشير بإطلالة جامع" },
  { id: "omani-delivery-van", label: "توصيل · شاحنة مُعلّمة", file: "omani-delivery-van.png", dress: "تاجر وعميلة عُمانيان مع شاحنة توصيل مُعلّمة" },
  // — scenes (operations) —
  { id: "omani-counter-tablet", label: "بائعان · تابلت عند الكاونتر", file: "omani-counter-tablet.png", dress: "تاجران عُمانيان بالكمة عند الكاونتر مع تابلت" },
  { id: "omani-fulfillment-desk", label: "تجهيز الطلبات · شاشتان", file: "omani-fulfillment-desk.png", dress: "تاجر عُماني يجهّز الطلبات على شاشتين وماسح باركود" },
  { id: "omani-dashboard-warehouse", label: "لوحة تحكم · مستودع", file: "omani-dashboard-warehouse.png", dress: "تاجر عُماني أمام لوحة التحكم في مستودع" },
  { id: "omani-warehouse-vest", label: "مستودع · لوجستيات", file: "omani-warehouse-vest.png", dress: "تاجر عُماني بالمصر وسترة عمل في مستودع" },
  { id: "omani-massar-laptop", label: "مصر · لابتوب المتجر", file: "omani-massar-laptop.png", dress: "تاجر عُماني بالمصر يدير المتجر على اللابتوب" },
  { id: "omani-massar-apps", label: "مصر · تطبيقات الجوال", file: "omani-massar-apps.png", dress: "تاجر عُماني بالمصر مع تطبيقات على الجوال" },
  { id: "omani-massar-appui", label: "مصر · واجهة التطبيق", file: "omani-massar-appui.png", dress: "تاجر عُماني بالمصر يستعرض واجهة التطبيق" },
  { id: "omani-support-headset", label: "دعم العملاء · سماعة", file: "omani-support-headset.png", dress: "موظف دعم عُماني بالكمة وسماعة أمام لابتوب متجرلينك" },
  { id: "omani-shop-flag", label: "متجر · علم عُمان", file: "omani-shop-flag.png", dress: "تاجر عُماني بالكمة على اللابتوب مع علم عُمان" },
];

export const characterById = (id) => CHARACTERS.find((c) => c.id === id) || null;

// Absolute path to a character's image file, or null if unknown / missing on disk.
export function characterPath(id) {
  const c = characterById(id);
  if (!c) return null;
  const p = path.join(charDir(), c.file);
  return fs.existsSync(p) ? p : null;
}
