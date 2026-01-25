import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(process.cwd(), 'public/data')
const APPS_DIR = path.join(DATA_DIR, 'apps')

const dryRun = process.argv.includes('--dry-run')

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

async function validateIcon(url) {
  if (!url) return true
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*' }
    })
    clearTimeout(timeout)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer = await response.arrayBuffer()
    const image = sharp(Buffer.from(buffer))
    await image.metadata()
    return true
  } catch (err) {
    console.warn(`Bad icon URL: ${url}`, err.message)
    return false
  }
}

async function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  let data
  try {
    data = JSON.parse(content)
  } catch (err) {
    console.error(`Invalid JSON in ${filePath}:`, err.message)
    return
  }
  
  if (data.icon) {
    const isValid = await validateIcon(data.icon)
    if (!isValid) {
      if (dryRun) {
        console.log(`[DRY RUN] Would update ${filePath}: icon set to null`)
      } else {
        data.icon = null
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
        console.log(`Updated ${filePath}: icon set to null`)
      }
    }
  }
}

async function main() {
  const files = getAllJsonFiles(APPS_DIR)
  console.log(`Found ${files.length} JSON files`)
  
  await Promise.all(files.map(f => processFile(f)))
  console.log('Validation complete')
  if (dryRun) {
    console.log('Dry run completed - no files were modified')
  }
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})