import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  extractAppParamsFromRequest,
  getAppConfig,
  getAppConfigString,
  getCategoriesWithRandomApps,
  getDefaultSort,
  queryAppsAsync,
} from '../../src/lib/query'
import * as data from '../../src/lib/data'
import { getApps } from '../../src/lib/data'
import * as stats from '../../src/lib/stats'
import type { ComplexApp, QueryOptions, SimpleApp } from '../../src/lib/types'

const emptyStatsResponse = () =>
  new Response(JSON.stringify({ results: [] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

const defaultQuery: QueryOptions = {
  categories: [],
  categoryMode: 'inclusive',
  type: 'both',
  q: '',
  page: 1,
  limit: 50,
}

const query = (overrides: Partial<QueryOptions> = {}) =>
  queryAppsAsync({ ...defaultQuery, ...overrides })

function simpleApp(id: string, name: string): SimpleApp {
  return {
    type: 'simple',
    categories: ['games'],
    description: { en: `${name} description` },
    config: { id, url: `https://example.com/${id}`, author: 'Author', name },
  }
}

function complexApp(): ComplexApp {
  return {
    type: 'complex',
    categories: ['games'],
    description: { en: 'Complex description' },
    configs: [
      {
        id: 'complex.one',
        url: 'https://example.com/complex',
        author: 'Author',
        name: 'Complex',
        altLabel: 'Stable',
        additionalSettings: JSON.stringify({ includePrereleases: true }),
      },
    ],
  }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => emptyStatsResponse()))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('app config helpers', () => {
  it('returns the correct config list for simple and complex apps', () => {
    expect(getAppConfig(simpleApp('simple.one', 'Simple'))).toEqual([
      { id: 'simple.one', url: 'https://example.com/simple.one', author: 'Author', name: 'Simple' },
    ])
    expect(getAppConfig(complexApp())).toHaveLength(1)
  })

  it('serializes simple configs unchanged', () => {
    const app = simpleApp('simple.one', 'Simple')
    expect(getAppConfigString(app, 'en')).toBe(JSON.stringify(app.config))
  })

  it('injects the description into complex settings and removes altLabel', () => {
    const app = complexApp()
    const parsed = JSON.parse(getAppConfigString(app, 'en'))

    expect(parsed.altLabel).toBeUndefined()
    expect(JSON.parse(parsed.additionalSettings)).toMatchObject({
      includePrereleases: true,
      about: 'Complex description',
    })
  })

  it('preserves an existing about value', () => {
    const app = complexApp()
    app.configs[0].additionalSettings = JSON.stringify({ about: 'Custom about' })
    const parsed = JSON.parse(getAppConfigString(app, 'en'))

    expect(JSON.parse(parsed.additionalSettings).about).toBe('Custom about')
  })

  it('keeps the original settings when they are malformed', () => {
    const app = complexApp()
    app.configs[0].additionalSettings = 'not-json'
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const parsed = JSON.parse(getAppConfigString(app, 'en'))

    expect(parsed.additionalSettings).toBe('not-json')
    expect(parsed.altLabel).toBeUndefined()
    expect(errorSpy).toHaveBeenCalled()
  })

  it('serializes a complex config without a description or altLabel', () => {
    const app = complexApp()
    app.description = {}
    delete app.configs[0].altLabel

    const parsed = JSON.parse(getAppConfigString(app, 'en'))

    expect(parsed.altLabel).toBeUndefined()
    expect(parsed.additionalSettings).toBe(app.configs[0].additionalSettings)
  })
})

describe('query parameter extraction', () => {
  it('uses defaults when no parameters are supplied', async () => {
    await expect(
      extractAppParamsFromRequest(new Request('https://apps.example/api/apps')),
    ).resolves.toEqual({
      page: 1,
      limit: 50,
      categories: [],
      categoryMode: 'inclusive',
      type: 'both',
      q: '',
      sort: 'popular',
    })
  })

  it('parses repeated categories, trims values, and clamps pagination', async () => {
    const params = await extractAppParamsFromRequest(
      new Request(
        'https://apps.example/api/apps?category=games&category=finance&page=3&limit=9999&categoryMode=exclusive&type=simple&q=neo&sort=name',
      ),
    )

    expect(params).toMatchObject({
      page: 3,
      limit: 200,
      categories: ['games', 'finance'],
      categoryMode: 'exclusive',
      type: 'simple',
      q: 'neo',
      sort: 'name',
    })
  })

  it('trims comma-separated categories and drops empty values', async () => {
    const params = await extractAppParamsFromRequest(
      new Request('https://apps.example/api/apps?categories=%20games%20,finance,'),
    )

    expect(params.categories).toEqual(['games', 'finance'])
  })

  it('falls back to safe values for invalid pagination and filter parameters', async () => {
    const params = await extractAppParamsFromRequest(
      new Request(
        'https://apps.example/api/apps?page=abc&limit=abc&type=invalid&categoryMode=invalid&sort=invalid',
      ),
    )

    expect(params).toMatchObject({
      page: 1,
      limit: 50,
      type: 'both',
      categoryMode: 'inclusive',
      sort: 'popular',
    })
  })

  it('rejects negative and zero pagination values', async () => {
    const params = await extractAppParamsFromRequest(
      new Request('https://apps.example/api/apps?page=-4&limit=0'),
    )

    expect(params.page).toBe(1)
    expect(params.limit).toBe(50)
  })

  it('computes a default sort from the selected categories', () => {
    const apps = getApps()
    const allCategories = [...new Set(apps.flatMap((app) => app.categories))]
    const multiCategoryApp = apps.find((app) => app.categories.length > 1)

    expect(getDefaultSort([])).toBe('popular')
    expect(getDefaultSort([allCategories[0]])).toBe('popular')
    expect(getDefaultSort(allCategories)).toBe('popular')
    if (multiCategoryApp) {
      expect(getDefaultSort(multiCategoryApp.categories.slice(0, 2))).toBe('relevance')
    }
  })
})

describe('app querying', () => {
  it('filters by type and returns pagination metadata', async () => {
    const result = await query({ type: 'simple', sort: 'name', page: 1, limit: 5 })

    expect(result.apps).toHaveLength(5)
    expect(result.apps.every((app) => app.type === 'simple')).toBe(true)
    expect(result.pagination.limit).toBe(5)
    expect(result.pagination.page).toBe(1)
    expect(result.pagination.total).toBeGreaterThan(5)
    expect(result.pagination.totalPages).toBe(Math.ceil(result.pagination.total / 5))
  })

  it('supports inclusive and exclusive category filters', async () => {
    const apps = getApps()
    const multiCategoryApp = apps.find((app) => app.categories.length > 1)
    if (!multiCategoryApp) throw new Error('expected an app with multiple categories')

    const categories = multiCategoryApp.categories.slice(0, 2)
    const inclusive = await query({ categories, categoryMode: 'inclusive', sort: 'name', limit: 200 })
    const exclusive = await query({ categories, categoryMode: 'exclusive', sort: 'name', limit: 200 })

    expect(inclusive.apps.length).toBeGreaterThan(0)
    expect(inclusive.apps.every((app) => categories.some((category) => app.categories.includes(category)))).toBe(true)
    expect(exclusive.apps.every((app) => categories.every((category) => app.categories.includes(category)))).toBe(true)
  })

  it('searches names, authors, and descriptions, and escapes regex characters', async () => {
    const apps = getApps()
    const target = apps.find((app) => {
      const name = app.type === 'simple' ? app.config.name : app.configs[0].name
      return name.length > 4 && /^[\w .!+-]+$/.test(name)
    })
    if (!target) throw new Error('expected a searchable app')
    const targetName = target.type === 'simple' ? target.config.name : target.configs[0].name
    const targetId = target.type === 'simple' ? target.config.id : target.configs[0].id

    const found = await query({ q: targetName, sort: 'name', limit: 200 })
    expect(found.apps.some((app) => {
      const config = getAppConfig(app)[0]
      return config.id === targetId
    })).toBe(true)

    const escaped = await query({ q: '^$', sort: 'name', limit: 200 })
    expect(escaped.pagination.total).toBe(0)
  })

  it('sorts by popularity with a name tie-breaker when stats are empty', async () => {
    vi.spyOn(stats, 'getInstallCounts').mockResolvedValue({})
    const result = await query({ sort: 'popular', limit: 10 })
    const names = result.apps.map((app) => getAppConfig(app)[0].name.toLowerCase())

    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })

  it('sorts by install counts before the name tie-breaker', async () => {
    const apps = getApps()
    const first = getAppConfig(apps[0])[0]
    const second = getAppConfig(apps[1])[0]
    const third = getAppConfig(apps[2])[0]
    vi.spyOn(stats, 'getInstallCounts').mockResolvedValue({
      [first.id]: 1,
      [second.id]: 2,
      [third.id]: 1,
    })

    const result = await query({ sort: 'popular', limit: 3 })

    expect(result.apps.map((app) => getAppConfig(app)[0].id)).toEqual([
      second.id,
      first.id,
      third.id,
    ])
  })

  it('sorts by relevance and paginates', async () => {
    const apps = getApps()
    const multiCategoryApp = apps.find((app) => app.categories.length > 1)
    if (!multiCategoryApp) throw new Error('expected an app with multiple categories')
    const categories = multiCategoryApp.categories.slice(0, 2)

    const result = await query({
      categories,
      categoryMode: 'inclusive',
      sort: 'relevance',
      page: 1,
      limit: 10,
    })
    const matchCounts = result.apps.map(
      (app) => app.categories.filter((category) => categories.includes(category)).length,
    )
    expect(matchCounts).toEqual([...matchCounts].sort((a, b) => b - a))

    const pageTwo = await query({ sort: 'name', page: 2, limit: 5 })
    const beyondEnd = await query({ sort: 'name', page: 9999, limit: 5 })

    expect(pageTwo.apps).toHaveLength(5)
    expect(pageTwo.pagination.page).toBe(2)
    expect(beyondEnd.apps).toEqual([])
    expect(beyondEnd.pagination.total).toBe(pageTwo.pagination.total)
  })

  it('builds letter jump pages for name sorting', async () => {
    const result = await query({ sort: 'name', page: 1, limit: 50 })
    const letters = Object.keys(result.letterPages ?? {})

    expect(letters.length).toBeGreaterThan(0)
    for (const letter of letters) {
      expect(letter).toMatch(/^[A-Z]$/)
      expect(result.letterPages?.[letter]).toBeGreaterThanOrEqual(1)
      expect(result.letterPages?.[letter]).toBeLessThanOrEqual(result.pagination.totalPages)
    }
  })

  it('returns a limited, icon-only random selection per category', () => {
    const apps = getApps()
    const perCategory = new Map<string, number>()
    for (const app of apps) {
      for (const category of app.categories) {
        perCategory.set(category, (perCategory.get(category) ?? 0) + 1)
      }
    }

    const empty = getCategoriesWithRandomApps(0)
    expect(Object.keys(empty).length).toBeGreaterThan(0)
    expect(Object.values(empty).every((list) => list.length === 0)).toBe(true)

    const result = getCategoriesWithRandomApps(1)
    for (const [category, list] of Object.entries(result)) {
      expect(list.length).toBeLessThanOrEqual(1)
      if ((perCategory.get(category) ?? 0) <= 1) {
        expect(list.length).toBe(perCategory.get(category) ?? 0)
      } else {
        for (const app of list) {
          expect(app.icon).toBeTruthy()
        }
      }
    }
  })

  it('skips iconless apps when selecting from a category with more apps than the limit', () => {
    const iconApp = simpleApp('icon.app', 'Icon App')
    iconApp.icon = 'https://example.com/icon.png'
    const noIconApp = simpleApp('no.icon', 'No Icon')
    vi.spyOn(data, 'getApps').mockReturnValue([noIconApp, iconApp])
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const result = getCategoriesWithRandomApps(1)

    expect(result.games).toHaveLength(1)
    expect(result.games[0]).toBe(iconApp)
  })
})
