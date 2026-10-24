import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appsDir = path.join(repoRoot, 'public', 'data', 'apps')
const serverEntry = path.join(repoRoot, 'dist', 'server', 'entry.mjs')

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

function findSearchableSimpleApp() {
  const simpleDir = path.join(appsDir, 'simple')
  for (const name of fs.readdirSync(simpleDir).sort()) {
    if (!name.endsWith('.json')) continue
    const data = JSON.parse(fs.readFileSync(path.join(simpleDir, name), 'utf8'))
    const config = data.config
    if (
      config &&
      typeof config.id === 'string' &&
      typeof config.name === 'string' &&
      config.name.length > 3 &&
      /^[\w .!+-]+$/.test(config.name)
    ) {
      return { id: config.id, name: config.name }
    }
  }
  throw new Error('no suitable simple app found for the search/popularity smoke test')
}

async function getFreePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const { port } = server.address()
  await new Promise((resolve) => server.close(resolve))
  return port
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const appFileCount = listJsonFiles(appsDir).length
const searchableApp = findSearchableSimpleApp()
const sampleAppFile = fs.readdirSync(path.join(appsDir, 'simple')).find((name) => name.endsWith('.json'))

let appProcess
let appLogs = ''
let statsServer
let statsRequests = 0
let baseUrl

before(async () => {
  assert.ok(
    fs.existsSync(serverEntry),
    'dist/server/entry.mjs is missing; run `npm run build` before `npm test`',
  )

  const statsRow = `obtainium://app/${encodeURIComponent(JSON.stringify({ id: searchableApp.id }))}`
  statsServer = http.createServer((_request, response) => {
    statsRequests++
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ results: [{ name: statsRow, events: 42 }] }))
  })
  await listen(statsServer)
  const statsPort = statsServer.address().port

  const port = await getFreePort()
  appProcess = spawn(process.execPath, [serverEntry], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      NODE_ENV: 'production',
      PLAUSIBLE_API_BASE_URL: `http://127.0.0.1:${statsPort}`,
      PLAUSIBLE_SITE_ID: 'apps.obtainium.imranr.dev',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  appProcess.stdout.on('data', (chunk) => {
    appLogs += chunk.toString()
  })
  appProcess.stderr.on('data', (chunk) => {
    appLogs += chunk.toString()
  })

  baseUrl = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (appProcess.exitCode !== null) {
      throw new Error(`production server exited early (${appProcess.exitCode})\n${appLogs}`)
    }
    try {
      const response = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(1_000) })
      if (response.ok) return
    } catch {
      // Server is still starting.
    }
    await delay(100)
  }
  throw new Error(`production server did not become ready at ${baseUrl}\n${appLogs}`)
})

after(async () => {
  if (appProcess && appProcess.exitCode === null) {
    appProcess.kill('SIGTERM')
    const exited = new Promise((resolve) => appProcess.once('exit', resolve))
    const timeout = delay(3_000).then(() => {
      if (appProcess.exitCode === null) appProcess.kill('SIGKILL')
    })
    await Promise.race([exited, timeout])
  }
  if (statsServer) {
    await new Promise((resolve) => statsServer.close(resolve))
  }
})

async function get(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: { 'accept-language': 'en' },
  })
  const body = await response.text()
  return { response, body }
}

async function getJson(pathname) {
  const { response, body } = await get(pathname)
  assert.equal(response.status, 200, `${pathname} should return 200`)
  assert.match(response.headers.get('content-type') || '', /application\/json/)
  return JSON.parse(body)
}

test('home page renders categories and the popular app from the stats API', async () => {
  const { response, body } = await get('/')
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') || '', /text\/html/)
  assert.match(body, /<title>Obtainium Apps<\/title>/)
  assert.match(body, /href="\/apps"/)

  const categoryLinks = body.match(/href="\/apps\?category=[^"]+"/g) || []
  assert.ok(categoryLinks.length >= 5, `expected category links, found ${categoryLinks.length}`)
  assert.ok(statsRequests > 0, 'the home page should call the configured Plausible API')
  assert.ok(body.includes(searchableApp.name), 'the popular section should include the stub install count app')
  assert.equal(response.headers.get('cache-control'), 'public, max-age=600, s-maxage=1800')

  const german = await get('/?lang=de')
  assert.equal(german.response.status, 200)
  assert.match(german.body, /Spiele/)
})

test('apps page renders install links and the filter form', async () => {
  const { response, body } = await get('/apps')
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') || '', /text\/html/)
  assert.match(body, /<title>Obtainium Apps<\/title>/)
  const installLinks = body.match(/obtainium:\/\/app\//g) || []
  assert.ok(installLinks.length >= 20, `expected app cards, found ${installLinks.length} install links`)
  assert.match(body, /name="q"/)

  const filtered = await get('/apps?category=games&sort=name')
  assert.equal(filtered.response.status, 200)
  const filteredInstallLinks = filtered.body.match(/obtainium:\/\/app\//g) || []
  assert.ok(filteredInstallLinks.length >= 1, 'the category-filtered apps page should render app cards')
  assert.match(filtered.body, />Games</)

  const paged = await get('/apps?sort=name&page=2')
  assert.equal(paged.response.status, 200)
  assert.match(paged.body, /aria-label="Jump to letter"/)
  assert.ok((paged.body.match(/obtainium:\/\/app\//g) || []).length >= 20)

  const searched = await get(`/apps?q=${encodeURIComponent(searchableApp.name)}&limit=200`)
  assert.equal(searched.response.status, 200)
  assert.ok(searched.body.includes(searchableApp.name))
})

test('api paginates, filters, searches, and caps the page size', async () => {
  const page = await getJson('/api/apps?limit=2&sort=name')
  assert.equal(page.apps.length, 2)
  assert.equal(page.pagination.limit, 2)
  assert.equal(page.pagination.total, appFileCount)
  assert.equal(page.pagination.totalPages, Math.ceil(appFileCount / 2))

  const capped = await getJson('/api/apps?limit=9999')
  assert.equal(capped.pagination.limit, 200)

  const simple = await getJson('/api/apps?type=simple&limit=200')
  assert.ok(simple.apps.length > 0)
  assert.ok(simple.apps.every((app) => app.type === 'simple'))

  const games = await getJson('/api/apps?category=games&limit=200')
  assert.ok(games.apps.length > 0)
  assert.ok(games.apps.every((app) => app.categories.includes('games')))

  const search = await getJson(`/api/apps?q=${encodeURIComponent(searchableApp.name)}&limit=200`)
  assert.ok(search.pagination.total >= 1)
  assert.ok(search.apps.some((app) => app.config?.id === searchableApp.id || app.configs?.some((c) => c.id === searchableApp.id)))

  const invalid = await getJson('/api/apps?page=abc&limit=abc&type=invalid&categoryMode=invalid')
  assert.equal(invalid.pagination.page, 1)
  assert.equal(invalid.pagination.limit, 50)
  assert.equal(invalid.pagination.total, appFileCount)

  const trimmed = await getJson('/api/apps?categories=%20games%20,finance&limit=200')
  assert.ok(trimmed.apps.every((app) => app.categories.includes('games') || app.categories.includes('finance')))
})

test('redirect page accepts valid Obtainium links and rejects other prefixes', async () => {
  const addTarget = 'https://example.com/download'
  const validAdd = await get(`/redirect?r=${encodeURIComponent(`obtainium://add/${addTarget}`)}`)
  assert.equal(validAdd.response.status, 200)
  assert.ok(validAdd.body.includes(`data-redirect-url="obtainium://add/${addTarget}"`))

  const appPayload = {
    id: 'com.example.smoke',
    url: 'https://example.com',
    author: 'Example',
    name: 'Example App',
  }
  const validApp = await get(
    `/redirect?r=${encodeURIComponent(`obtainium://app/${encodeURIComponent(JSON.stringify(appPayload))}`)}`,
  )
  assert.equal(validApp.response.status, 200)
  assert.match(validApp.body, /data-redirect-url="obtainium:\/\/app\//)

  const invalid = await get('/redirect?r=https%3A%2F%2Fexample.com')
  assert.equal(invalid.response.status, 200)
  assert.ok(invalid.body.includes('Invalid URL. Redirect should start with'))

  const missing = await get('/redirect')
  assert.equal(missing.response.status, 200)
  assert.ok(missing.body.includes('No redirect parameter provided.'))

  const invalidJson = await get(`/redirect?r=${encodeURIComponent('obtainium://app/%7Bbad')}`)
  assert.equal(invalidJson.response.status, 200)
  assert.ok(invalidJson.body.includes('Invalid URL. Valid app URL could not be found.'))

  const invalidProtocol = await get(
    `/redirect?r=${encodeURIComponent('obtainium://add/javascript:alert(1)')}`,
  )
  assert.equal(invalidProtocol.response.status, 200)
  assert.ok(invalidProtocol.body.includes('Invalid URL. Valid app URL could not be found.'))
})

test('static assets and the .html rewrite are served', async () => {
  const favicon = await fetch(`${baseUrl}/favicon.png`)
  assert.equal(favicon.status, 200)
  assert.match(favicon.headers.get('content-type') || '', /image\/png/)
  const faviconBytes = Buffer.from(await favicon.arrayBuffer())
  assert.deepEqual([...faviconBytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47])

  const robots = await get('/robots.txt')
  assert.equal(robots.response.status, 200)
  assert.match(robots.body, /Sitemap:\s+https:\/\/apps\.obtainium\.imranr\.dev\//)

  const sitemap = await get('/sitemap.xml')
  assert.equal(sitemap.response.status, 200)
  assert.match(sitemap.body, /<loc>https:\/\/apps\.obtainium\.imranr\.dev\/<\/loc>/)

  const categories = await getJson('/data/categories.json')
  assert.ok(Object.hasOwn(categories, 'games'))

  const appData = await getJson(`/data/apps/simple/${sampleAppFile}`)
  assert.ok(appData.config || appData.configs)

  const badge = await fetch(`${baseUrl}/badge_obtainium.png`)
  assert.equal(badge.status, 200)
  assert.match(badge.headers.get('content-type') || '', /image\/png/)

  const ads = await get('/ads.txt')
  assert.equal(ads.response.status, 200)
  assert.match(ads.body, /google\.com/)

  const rewritten = await get('/apps.html')
  assert.equal(rewritten.response.status, 200)
  assert.match(rewritten.body, /<title>Obtainium Apps<\/title>/)

  const missing = await get('/this-page-does-not-exist')
  assert.equal(missing.response.status, 404)
})
