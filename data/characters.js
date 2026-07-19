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

export const CHARACTERS = [
  { id: "omani-massar", label: "تاجر عُماني · مصر", file: "omani-massar-merchant.png", dress: "المصر العُماني الملفوف + دشداشة بيضاء" },
  { id: "omani-kummah", label: "تاجر عُماني · كمة", file: "omani-kummah.png", dress: "الكمة العُمانية المطرزة + دشداشة (محل عطور)" },
  { id: "omani-massar-tablet", label: "تاجر عُماني · مصر + جهاز", file: "omani-massar-tablet.png", dress: "المصر العُماني + دشداشة، يمسك تابلت" },
  { id: "omani-shopkeeper", label: "صاحب بقالة عُماني · كمة", file: "omani-shopkeeper.png", dress: "الكمة العُمانية + دشداشة (بقالة تقليدية)" },
];

export const characterById = (id) => CHARACTERS.find((c) => c.id === id) || null;

// Absolute path to a character's image file, or null if unknown / missing on disk.
export function characterPath(id) {
  const c = characterById(id);
  if (!c) return null;
  const p = path.join(charDir(), c.file);
  return fs.existsSync(p) ? p : null;
}
