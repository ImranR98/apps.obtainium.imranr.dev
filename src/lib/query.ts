import { getApps } from './data'
import type { SimpleApp, ComplexApp, QueryOptions, PaginatedResult, SimpleAppConfig, ComplexAppConfig } from './types'
import { pickLocalTranslation } from './i18n'
import { getInstallCounts, getAppInstallCount } from './stats'

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Get app configuration(s) based on app type
 */
export const getAppConfig = (app: SimpleApp | ComplexApp): (SimpleAppConfig | ComplexAppConfig)[] => {
  return app.type === 'simple' ? [app.config] : app.configs
}

/**
 * Serialize app config as JSON string, injecting description into additionalSettings
 */
export const getAppConfigString = (
  app: SimpleApp | ComplexApp,
  currentLanguage: string,
  configIndex = 0,
): string => {
  const description = pickLocalTranslation(app.description, currentLanguage)

  if (app.type === 'complex') {
    const config = JSON.parse(JSON.stringify(app.configs[configIndex]))
    if (description) {
      try {
        const settings = JSON.parse(config.additionalSettings || '{}')
        if (!settings.about) settings.about = description
        config.additionalSettings = JSON.stringify(settings)
      } catch (e) {
        console.error(config)
      }
    }
    if (config.altLabel) delete config.altLabel
    return JSON.stringify(config)
  }
  return JSON.stringify(app.config)
}

/**
 * Extract query parameters from request
 */
export const extractAppParamsFromRequest = async (request: Request): Promise<QueryOptions> => {
  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50')))
  const categories = (
    url.searchParams.get("categories")?.split(",") ||
    url.searchParams.getAll("category")
  ).filter((c) => c.trim() !== "")
  const categoryMode = (url.searchParams.get('categoryMode') as 'inclusive' | 'exclusive') || 'inclusive'
  const type = (url.searchParams.get('type') as 'simple' | 'complex' | 'both') || 'both'
  const q = url.searchParams.get('q') || ''
  const explicitSort = url.searchParams.get('sort')
  const sort = explicitSort === 'name' || explicitSort === 'popular' || explicitSort === 'relevance'
    ? explicitSort
    : getDefaultSort(categories)
  return {
    categories: categories,
    categoryMode,
    type,
    q,
    page,
    limit,
    sort
  }
}

/**
 * Default sort: popularity when none, one or all categories are selected,
 * relevance otherwise (sorts by category match count).
 * The category set mirrors what the filter form offers (categories present on apps).
 */
export const getDefaultSort = (categories: string[]): 'popular' | 'relevance' => {
  if (categories.length <= 1) {
    return 'popular'
  }
  const totalCategories = new Set(getApps().flatMap((app) => app.categories)).size
  return categories.length >= totalCategories ? 'popular' : 'relevance'
}

/**
 * Query apps with filtering, searching, and pagination
 */
export const queryAppsAsync = async (options: QueryOptions): Promise<PaginatedResult> => {
  const {
    categories = [],
    categoryMode = 'inclusive',
    type = 'both',
    q = '',
    page = 1,
    limit = 50,
    sort = 'popular'
  } = options

  const apps = getApps()
  let filteredApps = apps

  if (type !== 'both') {
    filteredApps = filteredApps.filter(app => app.type === type)
  }

  if (categories.length > 0) {
    if (categoryMode === 'inclusive') {
      filteredApps = filteredApps.filter(app => categories.some(cat => app.categories.includes(cat)))
    } else {
      filteredApps = filteredApps.filter(app => categories.every(cat => app.categories.includes(cat)))
    }
  }

  if (q) {
    const escaped = escapeRegex(q)
    const regex = new RegExp(escaped, 'i')
    filteredApps = filteredApps.filter(app => {
      const { name, author } = getAppConfig(app)[0]
      const descText = Object.values(app.description).filter(Boolean).join(' ')
      return regex.test(name) || regex.test(author) || regex.test(descText)
    })
  }

  if (sort === 'popular') {
    const counts = await getInstallCounts()
    filteredApps = [...filteredApps].sort((a, b) => {
      const diff = getAppInstallCount(b, counts) - getAppInstallCount(a, counts)
      if (diff !== 0) return diff
      const nameA = getAppConfig(a)[0].name.toLowerCase()
      const nameB = getAppConfig(b)[0].name.toLowerCase()
      return nameA.localeCompare(nameB)
    })
  } else if (sort === 'relevance') {
    filteredApps = [...filteredApps].sort((a, b) => {
      const countA = a.categories.filter(cat => categories.includes(cat)).length
      const countB = b.categories.filter(cat => categories.includes(cat)).length
      if (countB !== countA) return countB - countA
      const nameA = getAppConfig(a)[0].name.toLowerCase()
      const nameB = getAppConfig(b)[0].name.toLowerCase()
      return nameA.localeCompare(nameB)
    })
  }

  const total = filteredApps.length
  const start = (page - 1) * limit
  const end = start + limit
  const paginatedApps = filteredApps.slice(start, end)

  const letterPages: Record<string, number> = {}
  if (sort === 'name') {
    for (let i = 0; i < total; i++) {
      const name = getAppConfig(filteredApps[i])[0].name
      const letter = name.charAt(0).toUpperCase()
      if (/[A-Z]/.test(letter) && !(letter in letterPages)) {
        letterPages[letter] = Math.floor(i / limit) + 1
      }
    }
  }

  return {
    apps: paginatedApps,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    letterPages
  }
}

/**
 * Get categories with random apps (limited per category)
 */
export const getCategoriesWithRandomApps = (countPerCategory: number): Record<string, (SimpleApp | ComplexApp)[]> => {
  const apps = getApps()
  const categories: Record<string, (SimpleApp | ComplexApp)[]> = {}

  for (const app of apps) {
    for (const cat of app.categories) {
      if (!categories[cat]) categories[cat] = []
      categories[cat].push(app)
    }
  }

  const result: Record<string, (SimpleApp | ComplexApp)[]> = {}
  for (const [cat, list] of Object.entries(categories)) {
    const shuffled = [...list].sort(() => Math.random() - 0.5)
    if (list.length <= countPerCategory) {
      result[cat] = list
    } else {
      result[cat] = []
      for (let i = 0; i < shuffled.length && result[cat].length < countPerCategory; i++) {
        if (shuffled[i].icon) {
          result[cat].push(shuffled[i])
        }
      }
    }
  }

  return result
}
