import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const args = process.argv.slice(2)
let jsonPath = null
let only = null
let dryRun = false

for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--dry-run') {
        dryRun = true
    } else if (arg === '--only') {
        only = new Set((args[++i] || '').split(',').map(s => s.trim()).filter(Boolean))
    } else if (arg.startsWith('--')) {
        console.error(`Unknown option: ${arg}`)
        process.exit(1)
    } else if (!jsonPath) {
        jsonPath = arg
    } else {
        console.error(`Unexpected argument: ${arg}`)
        process.exit(1)
    }
}

const appsPath = path.join(__dirname, '..', 'public', 'data', 'apps')
const idRe = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/

if (!jsonPath) {
    console.error('Usage: node scripts/generate_from_export.js [--dry-run] [--only <id[,id]>] <path to Obtainium export>')
    process.exit(1)
}

function getAllJsonFiles(dir) {
    const results = []
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, item.name)
        if (item.isDirectory()) {
            results.push(...getAllJsonFiles(fullPath))
        } else if (item.name.toLowerCase().endsWith('.json')) {
            results.push(fullPath)
        }
    }
    return results
}

function getAppIds(filePath) {
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        return [data.config?.id, ...(data.configs ?? []).map(c => c.id)].filter(Boolean)
    } catch (err) {
        console.warn(`Skipping unreadable config ${filePath}: ${err.message}`)
        return []
    }
}

function hasComplexSettings(app) {
    if (app.additionalSettings) {
        try {
            if (Object.keys(JSON.parse(app.additionalSettings)).length > 0) return true
        } catch {
            return true
        }
    }
    return ['preferredApkIndex', 'overrideSource', 'altLabel'].some(k => app[k] != null)
}

function toSimpleApp(app) {
    return {
        config: {
            id: app.id,
            url: app.url,
            author: app.author,
            name: app.name
        },
        icon: null,
        categories: ['other'],
        description: { en: null }
    }
}

function toComplexApp(app) {
    const config = {
        id: app.id,
        url: app.url,
        author: app.author,
        name: app.name
    }
    for (const key of ['preferredApkIndex', 'additionalSettings', 'overrideSource', 'altLabel']) {
        if (app[key] != null) config[key] = app[key]
    }
    return {
        configs: [config],
        icon: null,
        categories: ['other'],
        description: { en: null }
    }
}

let exportedApps
try {
    exportedApps = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).apps
} catch (err) {
    console.error(`Could not read export ${jsonPath}: ${err.message}`)
    process.exit(1)
}
if (!Array.isArray(exportedApps)) {
    console.error('Invalid export: expected an object with an "apps" array')
    process.exit(1)
}

const existingAppIds = new Set(getAllJsonFiles(appsPath).flatMap(getAppIds))

let written = 0
let skipped = 0
let invalid = 0
let filtered = 0
for (const app of exportedApps) {
    const missing = ['id', 'url', 'author', 'name'].filter(k => typeof app?.[k] !== 'string' || !app[k].trim())
    if (missing.length) {
        console.warn(`Skipped export entry (missing/invalid: ${missing.join(', ')}): ${JSON.stringify(app).slice(0, 80)}`)
        invalid++
        continue
    }
    if (!idRe.test(app.id)) {
        console.warn(`Skipped ${app.id}: invalid package id`)
        invalid++
        continue
    }
    if (!/^https:\/\//.test(app.url)) {
        console.warn(`Warning: ${app.id} URL is not https: ${app.url}`)
    }
    if (only && !only.has(app.id)) {
        filtered++
        continue
    }
    if (existingAppIds.has(app.id)) {
        console.log(`Skipped ${app.id}: already exists`)
        skipped++
        continue
    }
    const complex = hasComplexSettings(app)
    const targetDir = path.join(appsPath, complex ? 'complex' : 'simple')
    const targetPath = path.join(targetDir, `${app.id}.json`)
    if (dryRun) {
        console.log(`[DRY RUN] Would create ${targetPath}`)
        existingAppIds.add(app.id)
        written++
        continue
    }
    fs.mkdirSync(targetDir, { recursive: true })
    fs.writeFileSync(targetPath, JSON.stringify(complex ? toComplexApp(app) : toSimpleApp(app), null, '    ') + '\n')
    existingAppIds.add(app.id)
    console.log(`Created ${targetPath}`)
    written++
}
console.log(`Done: ${written} ${dryRun ? 'would be written' : 'written'}, ${skipped} skipped (existing), ${invalid} invalid, ${filtered} filtered by --only`)
