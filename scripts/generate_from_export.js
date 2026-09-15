import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const jsonPath = process.argv[2]
const appsPath = path.join(__dirname, '..', 'public', 'data', 'apps')

if (!jsonPath) {
    console.error('Usage: node scripts/generate_from_export.js <path to Obtainium export>')
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
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return [data.config?.id, ...(data.configs ?? []).map(c => c.id)].filter(Boolean)
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

const existingAppIds = new Set(getAllJsonFiles(appsPath).flatMap(getAppIds))
const exportedApps = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).apps

let written = 0
let skipped = 0
for (const app of exportedApps) {
    if (existingAppIds.has(app.id)) {
        console.log(`Skipped ${app.id}: already exists`)
        skipped++
        continue
    }
    const complex = hasComplexSettings(app)
    const targetDir = path.join(appsPath, complex ? 'complex' : 'simple')
    const targetPath = path.join(targetDir, `${app.id}.json`)
    fs.mkdirSync(targetDir, { recursive: true })
    fs.writeFileSync(targetPath, JSON.stringify(complex ? toComplexApp(app) : toSimpleApp(app), null, '    ') + '\n')
    existingAppIds.add(app.id)
    console.log(`Created ${targetPath}`)
    written++
}
console.log(`Done: ${written} written, ${skipped} skipped`)
