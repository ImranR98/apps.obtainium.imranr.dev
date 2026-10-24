import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getApps, getCategories, getStrings } from '../../src/lib/data'

function countAppFiles(dir: string): number {
  let count = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) count += countAppFiles(path.join(dir, entry.name))
    else if (entry.name.endsWith('.json')) count++
  }
  return count
}

describe('data loading', () => {
  it('loads categories and strings once', () => {
    const categories = getCategories()
    const strings = getStrings()

    expect(Object.keys(categories)).toContain('games')
    expect(categories.games.en).toBe('Games')
    expect(strings.title.en).toBe('Obtainium Apps')
    expect(getCategories()).toBe(categories)
    expect(getStrings()).toBe(strings)
  })

  it('loads every app config and keeps them sorted by name', () => {
    const apps = getApps()
    const expectedCount = countAppFiles(path.join(process.cwd(), 'public', 'data', 'apps'))

    expect(apps).toHaveLength(expectedCount)
    expect(apps.some((app) => app.type === 'simple')).toBe(true)
    expect(apps.some((app) => app.type === 'complex')).toBe(true)

    for (let i = 1; i < apps.length; i++) {
      const previousApp = apps[i - 1]
      const currentApp = apps[i]
      const previous =
        previousApp.type === 'simple' ? previousApp.config.name : previousApp.configs[0].name
      const current = currentApp.type === 'simple' ? currentApp.config.name : currentApp.configs[0].name
      expect(previous.localeCompare(current)).toBeLessThanOrEqual(0)
    }

    for (const app of apps) {
      expect(app.categories.length).toBeGreaterThan(0)
      for (const category of app.categories) {
        expect(getCategories()).toHaveProperty(category)
      }
    }
  })

  it('injects app name/author into complex settings without replacing existing values', () => {
    const apps = getApps()
    const obtainium = apps.find(
      (app) => app.type === 'complex' && app.configs.some((config) => config.id === 'dev.imranr.obtainium'),
    )

    expect(obtainium).toBeDefined()
    if (!obtainium || obtainium.type !== 'complex') throw new Error('expected a complex Obtainium app')

    for (const config of obtainium.configs) {
      const settings = JSON.parse(config.additionalSettings ?? '{}')
      expect(settings.appName).toBe(config.name)
      expect(settings.appAuthor).toBe(config.author)
    }
  })
})
