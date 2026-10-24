import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(repoRoot, 'public', 'data')
const appsDir = path.join(dataDir, 'apps')
const APP_ID_RE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function listJsonFiles(dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...listJsonFiles(fullPath))
    } else if (entry.name.endsWith('.json')) {
      files.push(fullPath)
    }
  }
  return files
}

function validateConfigs(configs, label, errors) {
  for (const [index, config] of configs.entries()) {
    const where = `${label} configs[${index}]`
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      errors.push(`${where}: must be an object`)
      continue
    }
    for (const key of ['id', 'url', 'author', 'name']) {
      if (!isNonEmptyString(config[key])) {
        errors.push(`${where}: missing non-empty "${key}"`)
      }
    }
    if (isNonEmptyString(config.id) && !APP_ID_RE.test(config.id)) {
      errors.push(`${where}: invalid app id "${config.id}"`)
    }
    if (isNonEmptyString(config.url) && !/^https?:\/\//.test(config.url)) {
      errors.push(`${where}: url must start with http:// or https://`)
    }
    if (config.additionalSettings != null) {
      if (typeof config.additionalSettings !== 'string') {
        errors.push(`${where}: additionalSettings must be a JSON string`)
      } else {
        try {
          const settings = JSON.parse(config.additionalSettings)
          if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
            errors.push(`${where}: additionalSettings must decode to a JSON object`)
          }
        } catch (error) {
          errors.push(`${where}: additionalSettings is not valid JSON (${error.message})`)
        }
      }
    }
  }
}

const appFiles = listJsonFiles(appsDir)

test('categories and UI strings have an English translation', () => {
  const categories = JSON.parse(fs.readFileSync(path.join(dataDir, 'categories.json'), 'utf8'))
  const strings = JSON.parse(fs.readFileSync(path.join(dataDir, 'strings.json'), 'utf8'))
  const errors = []

  for (const [kind, translations] of [
    ['categories', categories],
    ['strings', strings],
  ]) {
    assert.ok(Object.keys(translations).length > 0, `${kind}.json must not be empty`)
    for (const [key, value] of Object.entries(translations)) {
      if (!value || typeof value !== 'object' || Array.isArray(value) || !isNonEmptyString(value.en)) {
        errors.push(`${kind}.json: "${key}" is missing a non-empty en translation`)
      }
    }
  }

  assert.deepEqual(errors, [], `translation errors:\n${errors.join('\n')}`)
})

test('every app config file is structurally valid', () => {
  assert.ok(appFiles.length > 0, 'no app config files found under public/data/apps')
  const categories = JSON.parse(fs.readFileSync(path.join(dataDir, 'categories.json'), 'utf8'))
  const categoryKeys = new Set(Object.keys(categories))
  const errors = []
  let simpleCount = 0
  let complexCount = 0

  for (const file of appFiles) {
    const relativePath = path.relative(repoRoot, file)
    const folder = path.basename(path.dirname(file))
    if (folder !== 'simple' && folder !== 'complex') {
      errors.push(`${relativePath}: app configs must live in simple/ or complex/`)
      continue
    }

    let data
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (error) {
      errors.push(`${relativePath}: invalid JSON (${error.message})`)
      continue
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      errors.push(`${relativePath}: top-level value must be an object`)
      continue
    }

    let configs
    if (folder === 'complex') {
      complexCount++
      if (!Array.isArray(data.configs) || data.configs.length === 0) {
        errors.push(`${relativePath}: complex apps need a non-empty configs array`)
        continue
      }
      if ('config' in data) {
        errors.push(`${relativePath}: complex apps must not also define config`)
      }
      configs = data.configs
    } else {
      simpleCount++
      if (!data.config || typeof data.config !== 'object' || Array.isArray(data.config)) {
        errors.push(`${relativePath}: simple apps need a config object`)
        continue
      }
      if ('configs' in data) {
        errors.push(`${relativePath}: simple apps must not define configs`)
      }
      configs = [data.config]
    }

    validateConfigs(configs, relativePath, errors)

    if (!Array.isArray(data.categories) || data.categories.length === 0) {
      errors.push(`${relativePath}: categories must be a non-empty array`)
    } else {
      if (new Set(data.categories).size !== data.categories.length) {
        errors.push(`${relativePath}: categories contains duplicates`)
      }
      for (const category of data.categories) {
        if (!categoryKeys.has(category)) {
          errors.push(`${relativePath}: unknown category "${category}"`)
        }
      }
    }

    if (!data.description || typeof data.description !== 'object' || Array.isArray(data.description)) {
      errors.push(`${relativePath}: description must be an object`)
    } else if (!isNonEmptyString(data.description.en)) {
      errors.push(`${relativePath}: description.en must be a non-empty string`)
    }

    if (data.icon != null && !(typeof data.icon === 'string' && /^https:\/\//.test(data.icon))) {
      errors.push(`${relativePath}: icon must be null/omitted or an https URL`)
    }
  }

  assert.ok(simpleCount > 0, 'expected at least one simple app config')
  assert.ok(complexCount > 0, 'expected at least one complex app config')
  assert.deepEqual(errors, [], `app config errors:\n${errors.join('\n')}`)
})

test('app ids are unique across config files', () => {
  const filesById = new Map()
  const errors = []

  for (const file of appFiles) {
    const relativePath = path.relative(repoRoot, file)
    let data
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      continue
    }
    const configs = Array.isArray(data?.configs) ? data.configs : [data?.config]
    const ids = new Set(
      configs
        .filter((config) => config && isNonEmptyString(config.id))
        .map((config) => config.id),
    )
    for (const id of ids) {
      if (!filesById.has(id)) filesById.set(id, new Set())
      filesById.get(id).add(relativePath)
    }
  }

  for (const [id, files] of filesById) {
    if (files.size > 1) {
      errors.push(`app id "${id}" is defined in multiple files: ${[...files].sort().join(', ')}`)
    }
  }

  assert.deepEqual(errors, [], `duplicate app ids:\n${errors.join('\n')}`)
})
