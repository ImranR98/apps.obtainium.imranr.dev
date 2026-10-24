import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '../../src/pages/api/apps'
import * as query from '../../src/lib/query'
import { getApps } from '../../src/lib/data'

function request(path: string): Parameters<typeof GET>[0] {
  return { request: new Request(`https://apps.example${path}`) } as Parameters<typeof GET>[0]
}

function responseJson(response: Response) {
  return response.json() as Promise<any>
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GET /api/apps', () => {
  it('returns a paginated JSON response with cache headers', async () => {
    const response = await GET(request('/api/apps?limit=1&sort=name'))
    const body = await responseJson(response)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(response.headers.get('cache-control')).toBe('public, max-age=300, s-maxage=600')
    expect(body.apps).toHaveLength(1)
    expect(body.pagination).toMatchObject({ page: 1, limit: 1, total: getApps().length })
  })

  it('sanitizes invalid pagination and filter parameters', async () => {
    const response = await GET(
      request('/api/apps?page=abc&limit=abc&type=invalid&categoryMode=invalid'),
    )
    const body = await responseJson(response)

    expect(response.status).toBe(200)
    expect(body.pagination).toMatchObject({
      page: 1,
      limit: 50,
      total: getApps().length,
    })
  })

  it('returns a JSON 500 when the query fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(query, 'queryAppsAsync').mockRejectedValueOnce(new Error('query exploded'))

    const response = await GET(request('/api/apps'))
    const body = await responseJson(response)

    expect(response.status).toBe(500)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(body).toEqual({ error: 'Internal server error' })
    expect(errorSpy).toHaveBeenCalledWith('API error:', expect.any(Error))
  })
})
