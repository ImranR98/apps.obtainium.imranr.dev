import type { APIRoute } from 'astro'
import { extractAppParamsFromRequest, queryAppsAsync } from '../../lib/query'

export const GET: APIRoute = async ({ request }) => {
  try {
    const result = await queryAppsAsync(await extractAppParamsFromRequest(request))
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, s-maxage=600',
      },
    })
  } catch (e) {
    console.error('API error:', e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
