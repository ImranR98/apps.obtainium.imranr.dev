import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComplexApp, SimpleApp } from '../../src/lib/types'

const siteId = 'apps.obtainium.imranr.dev'
const baseUrl = 'http://stats.example'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function row(id: string, events: number) {
  return {
    name: `obtainium://app/${encodeURIComponent(JSON.stringify({ id }))}`,
    events,
  }
}

function rows(count: number, id = 'app.one'): ReturnType<typeof row>[] {
  return Array.from({ length: count }, () => row(id, 1))
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetModules()
  vi.useRealTimers()
  process.env.PLAUSIBLE_API_BASE_URL = baseUrl
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete process.env.PLAUSIBLE_API_BASE_URL
})

describe('getInstallCounts', () => {
  it('aggregates valid rows and ignores malformed ids', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: [
          row('app.one', 5),
          row('app.one', 2),
          row('app.zero', 0),
          { name: 'https://not-an-obtainium-link', events: 99 },
          { name: 'obtainium://app/%7Bbad-json', events: 8 },
          { name: `obtainium://app/${encodeURIComponent(JSON.stringify({ id: 42 }))}`, events: 3 },
        ],
      }),
    )
    const { getInstallCounts } = await import('../../src/lib/stats')

    await expect(getInstallCounts()).resolves.toEqual({ 'app.one': 7, 'app.zero': 0 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain(`${baseUrl}/api/stats/${siteId}/custom-prop-values/url/`)
    expect(String(url)).toContain('period=month')
    expect(init).toMatchObject({ headers: { Accept: 'application/json' } })
  })

  it('handles a successful response without a results array', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}))
    const { getInstallCounts } = await import('../../src/lib/stats')

    await expect(getInstallCounts()).resolves.toEqual({})
  })

  it('fetches the next page when a page is full and stops on a short page', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ results: rows(1000) }))
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
    const { getInstallCounts } = await import('../../src/lib/stats')

    await expect(getInstallCounts()).resolves.toEqual({ 'app.one': 1000 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stops at the ten-page safety cap', async () => {
    for (let page = 0; page < 10; page++) {
      fetchMock.mockResolvedValueOnce(jsonResponse({ results: rows(1000, `app.${page}`) }))
    }
    const { getInstallCounts } = await import('../../src/lib/stats')

    const counts = await getInstallCounts()
    expect(fetchMock).toHaveBeenCalledTimes(10)
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(10_000)
  })

  it('caches counts within the TTL', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [row('app.one', 3)] }))
    const { getInstallCounts } = await import('../../src/lib/stats')

    await expect(getInstallCounts()).resolves.toEqual({ 'app.one': 3 })
    await expect(getInstallCounts('week')).resolves.toEqual({ 'app.one': 3 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns an empty object and throttles retries after a network failure', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getInstallCounts } = await import('../../src/lib/stats')

    await expect(getInstallCounts()).resolves.toEqual({})
    await expect(getInstallCounts()).resolves.toEqual({})
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith('Failed to fetch install stats:', expect.any(Error))
  })

  it('returns an empty object after a non-OK response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 503))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getInstallCounts } = await import('../../src/lib/stats')

    await expect(getInstallCounts()).resolves.toEqual({})
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to fetch install stats:',
      expect.objectContaining({ message: 'Plausible API error: 503' }),
    )
  })

  it('returns the last good cache when a refresh fails', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [row('app.one', 4)] }))
    const { getInstallCounts } = await import('../../src/lib/stats')

    await expect(getInstallCounts()).resolves.toEqual({ 'app.one': 4 })

    vi.setSystemTime(new Date('2026-01-01T00:11:00Z'))
    fetchMock.mockRejectedValueOnce(new Error('refresh failed'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(getInstallCounts()).resolves.toEqual({ 'app.one': 4 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('deduplicates concurrent requests', async () => {
    let resolveFetch: (response: Response) => void = () => {}
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )
    const { getInstallCounts } = await import('../../src/lib/stats')

    const first = getInstallCounts()
    const second = getInstallCounts()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveFetch(jsonResponse({ results: [row('app.one', 6)] }))
    await expect(Promise.all([first, second])).resolves.toEqual([
      { 'app.one': 6 },
      { 'app.one': 6 },
    ])
  })
})

describe('getAppInstallCount', () => {
  it('sums counts for simple and complex apps, defaulting missing counts to zero', async () => {
    const { getAppInstallCount } = await import('../../src/lib/stats')
    const simple: SimpleApp = {
      type: 'simple',
      categories: [],
      description: {},
      config: { id: 'simple.one', url: 'https://example.com', author: 'A', name: 'Simple' },
    }
    const complex: ComplexApp = {
      type: 'complex',
      categories: [],
      description: {},
      configs: [
        { id: 'complex.one', url: 'https://example.com', author: 'A', name: 'One' },
        { id: 'complex.two', url: 'https://example.com', author: 'A', name: 'Two' },
      ],
    }

    expect(getAppInstallCount(simple, { 'simple.one': 2 })).toBe(2)
    expect(getAppInstallCount(complex, { 'complex.one': 3, 'complex.two': 4 })).toBe(7)
    expect(getAppInstallCount(complex, {})).toBe(0)
  })
})
