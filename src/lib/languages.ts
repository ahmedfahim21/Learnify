/**
 * The launch languages: English plus the ten Indic languages that sarvam-105b
 * chat and Bulbul TTS both support. `nptelName` is the key NPTEL uses in a
 * lesson's `vtt_url` map, so a human track can be picked up when one exists.
 * `script` matches the language's own script, to tell a translation from an
 * untranslated echo of the English.
 */

export const LANGUAGES = {
  en: { name: "English", native: "English", sarvam: "en-IN", nptelName: "English", script: /[A-Za-z]/ },
  hi: { name: "Hindi", native: "हिन्दी", sarvam: "hi-IN", nptelName: "Hindi", script: /[\u0900-\u097F]/ },
  bn: { name: "Bengali", native: "বাংলা", sarvam: "bn-IN", nptelName: "Bengali", script: /[\u0980-\u09FF]/ },
  ta: { name: "Tamil", native: "தமிழ்", sarvam: "ta-IN", nptelName: "Tamil", script: /[\u0B80-\u0BFF]/ },
  te: { name: "Telugu", native: "తెలుగు", sarvam: "te-IN", nptelName: "Telugu", script: /[\u0C00-\u0C7F]/ },
  kn: { name: "Kannada", native: "ಕನ್ನಡ", sarvam: "kn-IN", nptelName: "Kannada", script: /[\u0C80-\u0CFF]/ },
  ml: { name: "Malayalam", native: "മലയാളം", sarvam: "ml-IN", nptelName: "Malayalam", script: /[\u0D00-\u0D7F]/ },
  mr: { name: "Marathi", native: "मराठी", sarvam: "mr-IN", nptelName: "Marathi", script: /[\u0900-\u097F]/ },
  gu: { name: "Gujarati", native: "ગુજરાતી", sarvam: "gu-IN", nptelName: "Gujarati", script: /[\u0A80-\u0AFF]/ },
  od: { name: "Odia", native: "ଓଡ଼ିଆ", sarvam: "od-IN", nptelName: "Odiya", script: /[\u0B00-\u0B7F]/ },
  pa: { name: "Punjabi", native: "ਪੰਜਾਬੀ", sarvam: "pa-IN", nptelName: "Punjabi", script: /[\u0A00-\u0A7F]/ },
} as const;

export type Lang = keyof typeof LANGUAGES;

export function isLang(value: string): value is Lang {
  return Object.hasOwn(LANGUAGES, value);
}
