import type { SimpleApp, ComplexApp } from './types'

const PLAUSIBLE_BASE_URL = import.meta.env.PUBLIC_PLAUSIBLE_API_BASE_URL || 'https://plausible.imranr.dev'
const PLAUSIBLE_SITE_ID = import.meta.env.PUBLIC_PLAUSIBLE_SITE_ID || 'apps.obtainium.imranr.dev'
const CACHE_TTL_MS = 10 * 60 * 1000
const RETRY_INTERVAL_MS = 5 * 60 * 1000
const FETCH_TIMEOUT_MS = 15 * 1000
const PAGE_LIMIT = 1000

let cache: { counts: Record<string, number>; fetchedAt: number } | null = null
let lastFailureAt = 0
let pending: Promise<Record<string, number>> | null = null

async function fetchInstallRows(period: string, page: number): Promise<any[]> {
  const params = new URLSearchParams({
    period,
    date: new Date().toISOString().slice(0, 10),
    filters: JSON.stringify([['is', 'event:goal', ['Outbound Link: Click']]]),
    detailed: 'true',
    limit: String(PAGE_LIMIT),
    page: String(page),
  })
  const url = `${PLAUSIBLE_BASE_URL}/api/stats/${PLAUSIBLE_SITE_ID}/custom-prop-values/url/?${params}`
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`Plausible API error: ${response.status}`)
  }
  const data = await response.json()
  return data.results || []
}

function decodeAppId(name: string): string | null {
  if (!name.startsWith('obtainium://app/')) {
    return null
  }
  try {
    const payload = name.replace('obtainium://app/', '')
    const config = JSON.parse(decodeURIComponent(payload))
    return typeof config.id === 'string' ? config.id : null
  } catch (e) {
    return null
  }
}

/**
 * Get monthly install counts per app id (based on install link clicks tracked by Plausible).
 * Falls back to stale cache (or an empty object) if stats are unavailable, so callers
 * degrade gracefully. After a failure, retries are throttled to RETRY_INTERVAL_MS.
 */
export const getInstallCounts = async (period = 'month'): Promise<Record<string, number>> => {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.counts
  }
  if (lastFailureAt && Date.now() - lastFailureAt < RETRY_INTERVAL_MS) {
    return cache ? cache.counts : {}
  }
  if (pending) {
    return pending
  }
  pending = (async () => {
    try {
      const counts: Record<string, number> = {}
      let page = 1
      while (true) {
        const rows = await fetchInstallRows(period, page)
        for (const row of rows) {
          const id = decodeAppId(row.name)
          if (id) {
            counts[id] = (counts[id] || 0) + (row.events || 0)
          }
        }
        if (rows.length < PAGE_LIMIT || page >= 10) {
          break
        }
        page++
      }
      cache = { counts, fetchedAt: Date.now() }
      lastFailureAt = 0
      return counts
    } catch (e) {
      console.error('Failed to fetch install stats:', e)
      lastFailureAt = Date.now()
      return cache ? cache.counts : {}
    } finally {
      pending = null
    }
  })()
  return pending
}

/**
 * Sum install counts across all configs of an app
 */
export const getAppInstallCount = (
  app: SimpleApp | ComplexApp,
  counts: Record<string, number>,
): number => {
  const configs = app.type === 'simple' ? [app.config] : app.configs
  return configs.reduce((sum, c) => sum + (counts[c.id] || 0), 0)
}
