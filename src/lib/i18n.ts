import { getCategories, getStrings } from "./data"
import type { Translation } from "./types"

/**
 * Determine current language from URL and request headers
 */
export const getCurrentLanguage = async (url: URL, request: Request) => {
  const langParam = url.searchParams.get('lang')
  let browserLang = 'en'
  const browserLangHeader = request.headers.get('accept-language')
  if (browserLangHeader) {
    const languages = browserLangHeader.split(',')
    for (const lang of languages) {
      const code = lang.split(';')[0].trim().split('-')[0].toLowerCase()
      browserLang = code
    }
  }
  return langParam || browserLang || 'en'
}

/**
 * Pick translation from language object with fallback
 */
export const pickLocalTranslation = (langObj: Translation, language: string): string | null => {
  if (langObj[language]) {
    return langObj[language]!
  }
  if (language !== 'en' && langObj.en) {
    return langObj.en
  }
  const availableLangs = Object.keys(langObj)
  if (availableLangs.length > 0) {
    const firstLang = availableLangs[0]
    return langObj[firstLang] || null
  }
  return null
}

const translationCache: { [key: string]: { [key: string]: string } } = {}
/**
 * Get localized strings for a given language with caching
 */
export const getLocalizedStrings = async (language: string) => {
  if (translationCache[language]) {
    return translationCache[language]
  }
  const thisLang: { [key: string]: string } = {}
  let atLeastOne = false
  const cats = await getCategories()
  Object.keys(cats).forEach(c => {
    const tr = pickLocalTranslation(cats[c], language)
    if (tr) {
      atLeastOne = true
    }
    thisLang[c] = tr || c
  })
  const strings = await getStrings()
  Object.keys(strings).forEach(s => {
    const tr = pickLocalTranslation(strings[s], language)
    if (tr) {
      atLeastOne = true
    }
    thisLang[s] = tr || s
  })
  if (atLeastOne) {
    translationCache[language] = thisLang
  }
  return thisLang
}
