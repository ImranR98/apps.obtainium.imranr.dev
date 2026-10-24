import { describe, expect, it, vi } from 'vitest'
import * as data from '../../src/lib/data'
import {
  getCurrentLanguage,
  getLocalizedStrings,
  pickLocalTranslation,
} from '../../src/lib/i18n'

describe('language selection', () => {
  it('prefers the lang query parameter over the browser header', async () => {
    const request = new Request('https://apps.example/', {
      headers: { 'accept-language': 'de-DE,de;q=0.9,en;q=0.8' },
    })
    await expect(getCurrentLanguage(new URL('https://apps.example/?lang=fr'), request)).resolves.toBe('fr')
  })

  it('uses the first browser language and normalizes it', async () => {
    const request = new Request('https://apps.example/', {
      headers: { 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8' },
    })
    await expect(getCurrentLanguage(new URL('https://apps.example/'), request)).resolves.toBe('pt')
  })

  it('falls back to English without a language header', async () => {
    const request = new Request('https://apps.example/')
    await expect(getCurrentLanguage(new URL('https://apps.example/'), request)).resolves.toBe('en')
  })

  it('falls back to English for an empty lang parameter', async () => {
    const request = new Request('https://apps.example/')
    await expect(getCurrentLanguage(new URL('https://apps.example/?lang='), request)).resolves.toBe('en')
  })
})

describe('translation fallback', () => {
  it('uses an exact match, then English, then the first available language', () => {
    expect(pickLocalTranslation({ en: 'Hello', de: 'Hallo' }, 'de')).toBe('Hallo')
    expect(pickLocalTranslation({ en: 'Hello', de: 'Hallo' }, 'fr')).toBe('Hello')
    expect(pickLocalTranslation({ fr: 'Bonjour' }, 'de')).toBe('Bonjour')
    expect(pickLocalTranslation({}, 'de')).toBeNull()
    expect(pickLocalTranslation({ de: null, en: null }, 'de')).toBeNull()
  })

  it('localizes categories and UI strings and caches each language', () => {
    const german = getLocalizedStrings('de')
    expect(german.games).toBe('Spiele')
    expect(german.title).toBeTruthy()
    expect(getLocalizedStrings('de')).toBe(german)

    const unknown = getLocalizedStrings('zz')
    expect(unknown.games).toBe('Games')
    expect(unknown.title).toBe('Obtainium Apps')
  })

  it('uses keys as fallbacks and skips the cache when nothing is translated', () => {
    vi.spyOn(data, 'getCategories').mockReturnValue({ emptyCategory: {} })
    vi.spyOn(data, 'getStrings').mockReturnValue({ emptyString: {} })

    const first = getLocalizedStrings('yy')
    const second = getLocalizedStrings('yy')

    expect(first).toEqual({ emptyCategory: 'emptyCategory', emptyString: 'emptyString' })
    expect(second).not.toBe(first)
  })
})
