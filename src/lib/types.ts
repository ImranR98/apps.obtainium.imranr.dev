export type Translation = {
  [language: string]: string | null
}

export type Translations = {
  [key: string]: Translation
};

export interface SimpleAppConfig {
  id: string
  url: string
  author: string
  name: string
}

export interface ComplexAppConfig extends SimpleAppConfig {
  preferredApkIndex?: number
  additionalSettings?: string
  overrideSource?: string
  altLabel?: string
}

interface BaseApp {
  icon?: string
  categories: string[]
  description: Translation
}

export interface SimpleApp extends BaseApp {
  config: SimpleAppConfig
  type: 'simple'
}

export interface ComplexApp extends BaseApp {
  configs: ComplexAppConfig[]
  type: 'complex'
}

export interface QueryOptions {
  categories: string[]
  categoryMode: 'inclusive' | 'exclusive'
  type: 'simple' | 'complex' | 'both'
  q: string
  page: number;
  limit: number;
}

export interface PaginatedResult {
  apps: (ComplexApp | SimpleApp)[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}