/**
 * Shared list of all supported teaching languages.
 * Used by both the registration form and the onboarding flow.
 */

export interface Language {
  code: string;
  name: string;
  flag: string;
}

export const TEACHING_LANGUAGES: Language[] = [
  // CEFR languages
  { code: "french", name: "French", flag: "🇫🇷" },
  { code: "portuguese", name: "Portuguese", flag: "🇵🇹" },
  { code: "spanish", name: "Spanish", flag: "🇪🇸" },
  { code: "italian", name: "Italian", flag: "🇮🇹" },
  { code: "german", name: "German", flag: "🇩🇪" },
  { code: "english", name: "English", flag: "🇬🇧" },
  { code: "dutch", name: "Dutch", flag: "🇳🇱" },
  { code: "swedish", name: "Swedish", flag: "🇸🇪" },
  { code: "norwegian", name: "Norwegian", flag: "🇳🇴" },
  { code: "danish", name: "Danish", flag: "🇩🇰" },
  { code: "finnish", name: "Finnish", flag: "🇫🇮" },
  { code: "polish", name: "Polish", flag: "🇵🇱" },
  { code: "czech", name: "Czech", flag: "🇨🇿" },
  { code: "greek", name: "Greek", flag: "🇬🇷" },
  { code: "russian", name: "Russian", flag: "🇷🇺" },
  { code: "ukrainian", name: "Ukrainian", flag: "🇺🇦" },
  { code: "turkish", name: "Turkish", flag: "🇹🇷" },
  { code: "hungarian", name: "Hungarian", flag: "🇭🇺" },
  { code: "romanian", name: "Romanian", flag: "🇷🇴" },
  { code: "bulgarian", name: "Bulgarian", flag: "🇧🇬" },
  { code: "croatian", name: "Croatian", flag: "🇭🇷" },
  { code: "serbian", name: "Serbian", flag: "🇷🇸" },
  { code: "slovak", name: "Slovak", flag: "🇸🇰" },
  { code: "slovenian", name: "Slovenian", flag: "🇸🇮" },
  { code: "lithuanian", name: "Lithuanian", flag: "🇱🇹" },
  { code: "latvian", name: "Latvian", flag: "🇱🇻" },
  { code: "estonian", name: "Estonian", flag: "🇪🇪" },
  { code: "irish", name: "Irish", flag: "🇮🇪" },
  // South Asian languages
  { code: "hindi", name: "Hindi", flag: "🇮🇳" },
  { code: "bengali", name: "Bengali", flag: "🇧🇩" },
  { code: "tamil", name: "Tamil", flag: "🇮🇳" },
  { code: "telugu", name: "Telugu", flag: "🇮🇳" },
  { code: "marathi", name: "Marathi", flag: "🇮🇳" },
  { code: "punjabi", name: "Punjabi", flag: "🇮🇳" },
  { code: "gujarati", name: "Gujarati", flag: "🇮🇳" },
  { code: "malayalam", name: "Malayalam", flag: "🇮🇳" },
  // East Asian languages
  { code: "mandarin_chinese", name: "Mandarin Chinese", flag: "🇨🇳" },
  { code: "japanese", name: "Japanese", flag: "🇯🇵" },
  { code: "korean", name: "Korean", flag: "🇰🇷" },
  // Southeast Asian languages
  { code: "indonesian", name: "Indonesian", flag: "🇮🇩" },
  { code: "malay", name: "Malay", flag: "🇲🇾" },
  { code: "vietnamese", name: "Vietnamese", flag: "🇻🇳" },
  { code: "thai", name: "Thai", flag: "🇹🇭" },
  // Middle Eastern languages
  { code: "arabic", name: "Arabic", flag: "🇸🇦" },
  { code: "hebrew", name: "Hebrew", flag: "🇮🇱" },
  { code: "persian", name: "Persian", flag: "🇮🇷" },
  { code: "yiddish", name: "Yiddish", flag: "🇮🇱" },
];

/**
 * Get a language by its code.
 */
export function getLanguageByCode(code: string): Language | undefined {
  return TEACHING_LANGUAGES.find((l) => l.code === code);
}

/**
 * Get display names for an array of language codes.
 */
export function getLanguageNames(codes: string[]): string[] {
  return codes.map((code) => {
    const lang = getLanguageByCode(code);
    return lang ? `${lang.flag} ${lang.name}` : code;
  });
}
