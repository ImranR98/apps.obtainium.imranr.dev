import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const DATA_DIR = path.join(process.cwd(), 'public/data')
const APPS_DIR = path.join(DATA_DIR, 'apps')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const check = args.includes('--check')
const targetPaths = args.filter(a => !a.startsWith('--'))

const CONCURRENCY = 10
const ATTEMPTS = 3
const TIMEOUT_MS = 10000
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

function getAllJsonFiles(dir) {
  const results = []
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

function isIco(buffer, contentType) {
  const type = (contentType || '').toLowerCase()
  if (type.includes('image/x-icon') || type.includes('image/vnd.microsoft.icon')) return true
  return buffer.length >= 4 && buffer[0] === 0 && buffer[1] === 0 && buffer[2] === 1 && buffer[3] === 0
}

async function fetchIcon(url) {
  let lastError
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'image/*' }
      })
      if (!response.ok) {
        const inconclusive =
          response.status === 403 || response.status === 408 || response.status === 429 || response.status >= 500
        if (inconclusive && attempt < ATTEMPTS) {
          lastError = new Error(`HTTP ${response.status}`)
          await new Promise(resolve => setTimeout(resolve, 500 * attempt))
          continue
        }
        return { ok: false, definitive: !inconclusive, reason: `HTTP ${response.status}` }
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      if (isIco(buffer, response.headers.get('content-type'))) {
        return { ok: false, definitive: true, reason: 'ICO icons are not accepted' }
      }
      const metadata = await sharp(buffer).metadata()
      if (!metadata.format) return { ok: false, definitive: true, reason: 'not a decodable image' }
      return { ok: true }
    } catch (err) {
      lastError = err
      if (attempt < ATTEMPTS) await new Promise(resolve => setTimeout(resolve, 500 * attempt))
    } finally {
      clearTimeout(timeout)
    }
  }
  return { ok: false, definitive: false, reason: `network error after ${ATTEMPTS} attempts: ${lastError?.message}` }
}

async function processFile(filePath, stats) {
  let data
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (err) {
    console.error(`Invalid JSON in ${filePath}:`, err.message)
    stats.parseErrors++
    return
  }

  if (!data.icon) return

  stats.checked++
  const result = await fetchIcon(data.icon)
  if (result.ok) {
    stats.clean++
    return
  }

  if (!result.definitive) {
    stats.unverified++
    console.warn(`Unverified icon (left unchanged): ${filePath}: ${data.icon} [${result.reason}]`)
    return
  }

  stats.bad++
  if (check) {
    console.log(`Bad icon: ${filePath}: ${data.icon} [${result.reason}]`)
    return
  }
  if (dryRun) {
    console.log(`[DRY RUN] Would update ${filePath}: icon set to null [${result.reason}]`)
    return
  }
  data.icon = null
  fs.writeFileSync(filePath, JSON.stringify(data, null, 4) + '\n')
  stats.fixed++
  console.log(`Updated ${filePath}: icon set to null [${result.reason}]`)
}

async function runPool(items, worker, limit) {
  const queue = items.slice()
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()
      await worker(item)
    }
  })
  await Promise.all(workers)
}

async function main() {
  const files = targetPaths.length
    ? targetPaths.flatMap(target => {
        const stat = fs.statSync(target)
        return stat.isDirectory() ? getAllJsonFiles(target) : [target]
      })
    : getAllJsonFiles(APPS_DIR)
  console.log(`Found ${files.length} JSON files`)

  const stats = { checked: 0, clean: 0, bad: 0, unverified: 0, fixed: 0, parseErrors: 0 }
  await runPool(files, file => processFile(file, stats), CONCURRENCY)

  console.log(
    `Done: ${stats.checked} icon(s) checked — ${stats.clean} OK, ${stats.bad} bad, ` +
    `${stats.unverified} unverified, ${stats.fixed} fixed, ${stats.parseErrors} parse error(s)`
  )
  if (dryRun) console.log('Dry run completed - no files were modified')
  if (check && stats.bad > 0) process.exit(1)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
