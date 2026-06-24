/// <reference types="astro/client" />

interface Window {
  plausible?: {
    q?: unknown[]
    o?: unknown
    init?: (o?: unknown) => void
    (...args: unknown[]): void
  }
}
