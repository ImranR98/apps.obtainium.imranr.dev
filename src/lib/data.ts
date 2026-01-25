import fs from 'fs'
import path from 'path'
import type { SimpleApp, ComplexApp, Translations } from './types'


const DATA_DIR = path.join(process.cwd(), 'public/data')
const APPS_DIR = path.join(DATA_DIR, '/apps')
const CATEGORIES_FILE = path.join(DATA_DIR, '/categories.json')
const STRINGS_FILE = path.join(DATA_DIR, '/strings.json')

function getAllJsonFiles(dir: string): string[] {
  const results: string[] = []
  const items = fs.readdirSync(dir)
  for (const item of items) {
    const fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      results.push(...getAllJsonFiles(fullPath))
    } else if (item.endsWith('.json')) {
      results.push(fullPath)
    }
  }
  return results
}

let categories: Translations = {}
let apps: (SimpleApp | ComplexApp)[] = []
let strings: Translations = {}

/**
 * Get categories translations
 */
export const getCategories = async (): Promise<Translations> => {
  if (Object.keys(categories).length === 0) {
    categories = JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8'))
  }
  return categories
}

/**
 * Get strings translations
 */
export const getStrings = async (): Promise<Translations> => {
  if (Object.keys(strings).length === 0) {
    strings = JSON.parse(fs.readFileSync(path.join(STRINGS_FILE), 'utf8'))
  }
  return strings
}

/**
 * Get apps with icons validation and categorization
 */
export const getApps = async (): Promise<(SimpleApp | ComplexApp)[]> => {
  if (apps.length === 0) {
    const cats = Object.keys(await getCategories())
    const files = getAllJsonFiles(APPS_DIR)
    await Promise.all(files.map(async filePath => {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))

      const appBase = {
        icon: data.icon,
        categories: (data.categories as string[] | undefined || []).filter((cat: string) => cats.includes(cat)),
        description: data.description || {}
      }
      if (appBase.categories.length === 0) {
        appBase.categories.push('other')
      }
      if (Array.isArray(data.configs)) {
        try {
          data.configs = data.configs.map((c: any) => {
            const settings = JSON.parse(c.additionalSettings || '{}')
            if (c.name && !settings.appName) {
              settings.appName = c.name
            }
            if (c.author && !settings.appAuthor) {
              settings.appAuthor = c.author
            }
            c.additionalSettings = JSON.stringify(settings)
            return c
          })
          apps.push({
            ...appBase,
            configs: data.configs,
            type: 'complex'
          })
        } catch (e) {
          console.error(`Error parsing ${filePath}`)
        }
      } else {
        apps.push({
          ...appBase,
          config: data.config,
          type: 'simple'
        })
      }
    }))

    apps = apps.sort((a, b) => {
      const nameA = a.type == 'simple' ? a.config.name : a.configs[0].name
      const nameB = b.type == 'simple' ? b.config.name : b.configs[0].name
      return nameA.localeCompare(nameB)
    })
  }
  return apps
}