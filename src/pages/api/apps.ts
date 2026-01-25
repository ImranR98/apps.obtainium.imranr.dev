import type { APIRoute } from 'astro'
import { extractAppParamsFromRequest, queryAppsAsync } from '../../lib/query'

export const GET: APIRoute = async ({ request }) => {
  const result = await queryAppsAsync(await extractAppParamsFromRequest(request))
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  })
}
