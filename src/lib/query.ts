import { getApps } from './data'
import type { SimpleApp, ComplexApp, QueryOptions, PaginatedResult, SimpleAppConfig, ComplexAppConfig } from './types'

/**
 * Get app configuration(s) based on app type
 */
export const getAppConfig = (app: SimpleApp | ComplexApp): (SimpleAppConfig | ComplexAppConfig)[] => {
  return app.type === 'simple' ? [app.config] : app.configs
}

/**
 * Extract query parameters from request
 */
export const extractAppParamsFromRequest = async (request: Request): Promise<QueryOptions> => {
  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const categories = (
    url.searchParams.get("categories")?.split(",") ||
    url.searchParams.getAll("category")
  ).filter((c) => c.trim() !== "")
  const categoryMode = (url.searchParams.get('categoryMode') as 'inclusive' | 'exclusive') || 'inclusive'
  const type = (url.searchParams.get('type') as 'simple' | 'complex' | 'both') || 'both'
  const q = url.searchParams.get('q') || ''
  return {
    categories: categories,
    categoryMode,
    type,
    q,
    page,
    limit
  }
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
    limit = 50
  } = options

  const apps = await getApps()
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
    const regex = new RegExp(q, 'i')
    filteredApps = filteredApps.filter(app => {
      const { name, author } = getAppConfig(app)[0]
      const descText = Object.values(app.description).filter(Boolean).join(' ')
      return regex.test(name) || regex.test(author) || regex.test(descText)
    })
  }

  const total = filteredApps.length
  const start = (page - 1) * limit
  const end = start + limit
  const paginatedApps = filteredApps.slice(start, end)

  return {
    apps: paginatedApps,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
}

/**
 * Get categories with random apps (limited per category)
 */
export const getCategoriesWithRandomApps = async (countPerCategory: number): Promise<Record<string, (SimpleApp | ComplexApp)[]>> => {
  const apps = await getApps()
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