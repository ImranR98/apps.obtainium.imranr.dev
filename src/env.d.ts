/// <reference types="astro/client" />

interface Window {
  plausible?: {
    q?: unknown[]
    o?: unknown
    init?: (o?: unknown) => void
    (...args: unknown[]): void
  }
  showToast?: (message: string, options?: { variant?: "success" | "error"; duration?: number }) => void
  copyToClipboard?: (text: string, options?: { successMessage?: string; failMessage?: string }) => void
}

declare var plausible: {
  q?: unknown[]
  o?: unknown
  init?: (o?: unknown) => void
  (...args: unknown[]): void
}
