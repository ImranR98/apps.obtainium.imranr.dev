#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const APPS_DIR = path.join(ROOT, 'public', 'data', 'apps')

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node find-missing-icons.mjs [--dir DIR] [--json]

Lists app configs under public/data/apps whose "icon" is absent or null.
These are enhancement targets, not validator failures (icon is optional).

One line per config: <path>\t<id>\t<name>\ticon=<omitted|null>\t<source-url>
  --dir DIR   scan a different directory (default: public/data/apps)
  --json      print a JSON array instead`)
  process.exit(0)
}

const asJson = args.includes('--json')
const dirIndex = args.indexOf('--dir')
const scanDir = dirIndex !== -1 && args[dirIndex + 1] ? path.resolve(ROOT, args[dirIndex + 1]) : APPS_DIR

function getAllJsonFiles(dir) {
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) results.push(...getAllJsonFiles(fullPath))
    else if (entry.name.endsWith('.json')) results.push(fullPath)
  }
  return results
}

const rows = []
for (const file of getAllJsonFiles(scanDir).sort()) {
  let data
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    console.error(`Invalid JSON in ${file}: ${err.message}`)
    continue
  }
  if (data.icon) continue
  const config = Array.isArray(data.configs) ? data.configs[0] : data.config
  rows.push({
    path: path.relative(ROOT, file),
    id: config?.id ?? null,
    name: config?.name ?? null,
    state: 'icon' in data ? 'null' : 'omitted',
    url: config?.url ?? null,
  })
}

if (asJson) {
  console.log(JSON.stringify(rows, null, 2))
} else {
  for (const row of rows) {
    console.log(`${row.path}\t${row.id}\t${row.name}\ticon=${row.state}\t${row.url}`)
  }
}
console.error(`Found ${rows.length} config(s) without an icon`)
