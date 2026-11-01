/**
 * The study languages. `nptelName` is the key NPTEL uses in a lesson's
 * `vtt_url` map, so a human track can be picked up when one exists. `script`
 * matches the language's own script, to tell a translation from an
 * untranslated echo of the English.
 *
 * Two capabilities differ by language, both set by what Sarvam supports:
 * - `writes`: sarvam-105b writes study screens and doubt answers directly in
 *   it (English and ten Indic languages). For the rest, the model writes in
 *   English and Sarvam-Translate (22 Indic languages) translates the text.
 * - `speaks`: Bulbul can read answers aloud in it. Saaras transcribes spoken
 *   doubts in every language here.
 */

const DEVANAGARI = /[ऀ-ॿ]/;
const BENGALI = /[ঀ-৿]/;

export const LANGUAGES = {
  en: { name: "English", native: "English", sarvam: "en-IN", nptelName: "English", script: /[A-Za-z]/, writes: true, speaks: true },
  hi: { name: "Hindi", native: "हिन्दी", sarvam: "hi-IN", nptelName: "Hindi", script: DEVANAGARI, writes: true, speaks: true },
  bn: { name: "Bengali", native: "বাংলা", sarvam: "bn-IN", nptelName: "Bengali", script: BENGALI, writes: true, speaks: true },
  ta: { name: "Tamil", native: "தமிழ்", sarvam: "ta-IN", nptelName: "Tamil", script: /[஀-௿]/, writes: true, speaks: true },
  te: { name: "Telugu", native: "తెలుగు", sarvam: "te-IN", nptelName: "Telugu", script: /[ఀ-౿]/, writes: true, speaks: true },
  kn: { name: "Kannada", native: "ಕನ್ನಡ", sarvam: "kn-IN", nptelName: "Kannada", script: /[ಀ-೿]/, writes: true, speaks: true },
  ml: { name: "Malayalam", native: "മലയാളം", sarvam: "ml-IN", nptelName: "Malayalam", script: /[ഀ-ൿ]/, writes: true, speaks: true },
  mr: { name: "Marathi", native: "मराठी", sarvam: "mr-IN", nptelName: "Marathi", script: DEVANAGARI, writes: true, speaks: true },
  gu: { name: "Gujarati", native: "ગુજરાતી", sarvam: "gu-IN", nptelName: "Gujarati", script: /[઀-૿]/, writes: true, speaks: true },
  od: { name: "Odia", native: "ଓଡ଼ିଆ", sarvam: "od-IN", nptelName: "Odiya", script: /[଀-୿]/, writes: true, speaks: true },
  pa: { name: "Punjabi", native: "ਪੰਜਾਬੀ", sarvam: "pa-IN", nptelName: "Punjabi", script: /[਀-੿]/, writes: true, speaks: true },
  // Written in English, then translated by Sarvam-Translate; no read-aloud.
  as: { name: "Assamese", native: "অসমীয়া", sarvam: "as-IN", nptelName: "Assamese", script: BENGALI, writes: false, speaks: false },
  ne: { name: "Nepali", native: "नेपाली", sarvam: "ne-IN", nptelName: "Nepali", script: DEVANAGARI, writes: false, speaks: false },
  kok: { name: "Konkani", native: "कोंकणी", sarvam: "kok-IN", nptelName: "Konkani", script: DEVANAGARI, writes: false, speaks: false },
  mai: { name: "Maithili", native: "मैथिली", sarvam: "mai-IN", nptelName: "Maithili", script: DEVANAGARI, writes: false, speaks: false },
  doi: { name: "Dogri", native: "डोगरी", sarvam: "doi-IN", nptelName: "Dogri", script: DEVANAGARI, writes: false, speaks: false },
  sa: { name: "Sanskrit", native: "संस्कृतम्", sarvam: "sa-IN", nptelName: "Sanskrit", script: DEVANAGARI, writes: false, speaks: false },
  brx: { name: "Bodo", native: "बड़ो", sarvam: "brx-IN", nptelName: "Bodo", script: DEVANAGARI, writes: false, speaks: false },
} as const;

export type Lang = keyof typeof LANGUAGES;

export function isLang(value: string): value is Lang {
  return Object.hasOwn(LANGUAGES, value);
}

/** The languages besides English, for "N Indian languages" in copy. */
export const INDIAN_LANGUAGE_COUNT = Object.keys(LANGUAGES).length - 1;
