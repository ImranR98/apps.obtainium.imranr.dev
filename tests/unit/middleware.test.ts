import { describe, expect, it, vi } from 'vitest'
import { onRequest } from '../../src/middleware'

function context(pathname: string) {
  const rewrite = vi.fn((path: string) => new Response(`rewritten:${path}`))
  return {
    url: new URL(`https://apps.example${pathname}`),
    rewrite,
  } as unknown as Parameters<typeof onRequest>[0]
}

async function responseText(response: Response | void): Promise<string> {
  if (!(response instanceof Response)) throw new Error('middleware did not return a response')
  return response.text()
}

describe('HTML extension middleware', () => {
  it('rewrites .html paths and preserves the query string', async () => {
    const ctx = context('/apps.html?category=games')
    const next = vi.fn(async () => new Response('next'))

    const response = await onRequest(ctx, next)

    expect(ctx.rewrite).toHaveBeenCalledWith('/apps?category=games')
    expect(next).not.toHaveBeenCalled()
    await expect(responseText(response)).resolves.toBe('rewritten:/apps?category=games')
  })

  it('rewrites .htm paths case-insensitively', async () => {
    const ctx = context('/APPS.HTM')
    const next = vi.fn(async () => new Response('next'))

    await onRequest(ctx, next)

    expect(ctx.rewrite).toHaveBeenCalledWith('/APPS')
    expect(next).not.toHaveBeenCalled()
  })

  it('passes non-HTML paths to the next handler', async () => {
    const ctx = context('/apps?category=games')
    const next = vi.fn(async () => new Response('next'))

    const response = await onRequest(ctx, next)

    expect(ctx.rewrite).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
    await expect(responseText(response)).resolves.toBe('next')
  })
})
