import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getApps } from '../../src/lib/data'

const dataDir = path.join(process.cwd(), 'public', 'data')
const appsDir = path.join(dataDir, 'apps')
const categoriesFile = path.join(dataDir, 'categories.json')
const stringsFile = path.join(dataDir, 'strings.json')

function appFile(folder: 'simple' | 'complex', name: string) {
  return path.join(appsDir, folder, name)
}

describe('data loading edge cases', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('skips malformed JSON, defaults unknown categories to other, and normalizes complex settings', () => {
    const files = new Map<string, string>([
      [categoriesFile, JSON.stringify({ games: { en: 'Games' } })],
      [stringsFile, JSON.stringify({})],
      [
        appFile('simple', 'a.json'),
        JSON.stringify({
          categories: ['not-a-category'],
          description: { en: 'A simple app' },
          config: { id: 'a', url: 'https://example.com/a', author: 'A', name: 'A' },
        }),
      ],
      [appFile('simple', 'bad.json'), '{ this is not json'],
      [
        appFile('simple', 'c.json'),
        JSON.stringify({
          config: { id: 'c', url: 'https://example.com/c', author: 'C', name: 'C' },
        }),
      ],
      [appFile('simple', 'notes.txt'), 'not an app config'],
      [
        appFile('complex', 'b.json'),
        JSON.stringify({
          categories: ['games'],
          description: { en: 'A complex app' },
          configs: [
            {
              id: 'b',
              url: 'https://example.com/b',
              author: 'B',
              name: 'B',
              additionalSettings: JSON.stringify({ about: 'keep me' }),
            },
          ],
        }),
      ],
    ])

    vi.spyOn(fs, 'readdirSync').mockImplementation(((target: fs.PathLike) => {
      const directory = String(target)
      if (directory === appsDir) return ['simple', 'complex']
      if (directory === path.join(appsDir, 'simple')) return ['a.json', 'bad.json', 'c.json', 'notes.txt']
      if (directory === path.join(appsDir, 'complex')) return ['b.json']
      return []
    }) as typeof fs.readdirSync)

    vi.spyOn(fs, 'statSync').mockImplementation(((target: fs.PathLike) => {
      const directory = String(target)
      return {
        isDirectory: () =>
          directory === appsDir ||
          directory === path.join(appsDir, 'simple') ||
          directory === path.join(appsDir, 'complex'),
      }
    }) as typeof fs.statSync)

    vi.spyOn(fs, 'readFileSync').mockImplementation(((target: fs.PathLike) => {
      const contents = files.get(String(target))
      if (contents === undefined) throw new Error(`unexpected read: ${String(target)}`)
      return contents
    }) as typeof fs.readFileSync)

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const apps = getApps()

    expect(apps).toHaveLength(3)
    expect(apps.map((app) => app.type)).toEqual(['simple', 'complex', 'simple'])
    expect(apps[0].categories).toEqual(['other'])
    expect(apps[2].categories).toEqual(['other'])
    expect(apps[2].description).toEqual({})

    const complex = apps[1]
    expect(complex.type).toBe('complex')
    if (complex.type !== 'complex') throw new Error('expected a complex app')
    const settings = JSON.parse(complex.configs[0].additionalSettings ?? '{}')
    expect(settings).toMatchObject({ about: 'keep me', appName: 'B', appAuthor: 'B' })
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('bad.json'), expect.any(Error))
    expect(getApps()).toBe(apps)
  })
})
