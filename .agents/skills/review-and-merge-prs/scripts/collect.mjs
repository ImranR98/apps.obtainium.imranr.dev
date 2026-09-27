#!/usr/bin/env node
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'

const execFileP = promisify(execFile)
const ROOT = process.cwd()
const APPS_DIR = path.join(ROOT, 'public', 'data', 'apps')
const CATEGORIES_FILE = path.join(ROOT, 'public', 'data', 'categories.json')
const DEFAULT_OUT_DIR = '/tmp/opencode/pr-review'
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const APP_PATH_RE = /^public\/data\/apps\//

function usage() {
  console.log(`Usage: node collect.mjs <prs|repo> [options]

Collects raw facts only (config contents, link responses, source activity,
categories, settings keys, duplicate candidates); verdicts come from the caller
using reference/criteria.md.

  prs    open PRs and the config files they change (--pr, --prs, --author, --limit)
  repo   configs already in public/data/apps (--file, --dir)

Other options: --skip-network, --concurrency N (8), --out FILE, --print-digest, --help
Outputs: <out> (JSON) and <out>.digest.txt (one grep-friendly line per PR/file).`)
}

function parseArgs(argv) {
  const mode = argv[0]
  if (!['prs', 'repo'].includes(mode)) {
    usage()
    process.exit(1)
  }
  const opts = {
    mode,
    prs: [],
    author: null,
    limit: 0,
    files: [],
    dir: APPS_DIR,
    skipNetwork: false,
    concurrency: 8,
    out: null,
    printDigest: false,
  }
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--pr') opts.prs.push(Number(argv[++i]))
    else if (a === '--prs') opts.prs.push(...String(argv[++i]).split(',').map(Number))
    else if (a === '--author') opts.author = String(argv[++i]).toLowerCase()
    else if (a === '--limit') opts.limit = Number(argv[++i]) || 0
    else if (a === '--file') opts.files.push(argv[++i])
    else if (a === '--dir') opts.dir = path.resolve(ROOT, argv[++i])
    else if (a === '--skip-network') opts.skipNetwork = true
    else if (a === '--concurrency') opts.concurrency = Math.max(1, Number(argv[++i]) || 8)
    else if (a === '--out') opts.out = argv[++i]
    else if (a === '--print-digest') opts.printDigest = true
    else if (a === '--help' || a === '-h') {
      usage()
      process.exit(0)
    } else {
      console.error(`Unknown argument: ${a}`)
      usage()
      process.exit(1)
    }
  }
  if (!opts.out) opts.out = path.join(DEFAULT_OUT_DIR, `${opts.mode}.json`)
  return opts
}

async function gh(args) {
  const { stdout } = await execFileP('gh', args, {
    maxBuffer: 128 * 1024 * 1024,
    encoding: 'utf8',
    cwd: ROOT,
  })
  return stdout
}

async function ghApi(endpoint, { raw = false, optional = false } = {}) {
  const args = ['api', endpoint]
  if (raw) args.push('-H', 'Accept: application/vnd.github.raw')
  try {
    const stdout = await gh(args)
    if (raw) return stdout
    return stdout.trim() ? JSON.parse(stdout) : null
  } catch (e) {
    const text = `${e.stderr || ''} ${e.message || ''}`
    if (optional && /HTTP 404|Not Found/.test(text)) return null
    throw new Error(`gh api ${endpoint} failed: ${text.trim().split('\n')[0]}`)
  }
}

async function ghApiPaged(endpoint) {
  const results = []
  for (let page = 1; page <= 100; page++) {
    const sep = endpoint.includes('?') ? '&' : '?'
    const items = await ghApi(`${endpoint}${sep}per_page=100&page=${page}`)
    if (!Array.isArray(items)) throw new Error(`Expected array from ${endpoint}`)
    results.push(...items)
    if (items.length < 100) break
  }
  return results
}

async function detectRepo() {
  const remote = (
    await execFileP('git', ['remote', 'get-url', 'origin'], { cwd: ROOT, encoding: 'utf8' })
  ).stdout.trim()
  const m = remote.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/)
  if (!m) throw new Error('Could not determine repo from git remote')
  return `${m[1]}/${m[2]}`
}

function walkJson(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name)
    if (item.isDirectory()) out.push(...walkJson(full))
    else if (item.name.endsWith('.json')) out.push(full)
  }
  return out
}

function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return null
  try {
    const u = new URL(url)
    u.hash = ''
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '')
    return u.toString().replace(/\/$/, '').toLowerCase()
  } catch {
    return null
  }
}

function relPath(file) {
  return path.relative(ROOT, file).split(path.sep).join('/')
}

function configList(data) {
  if (!data || typeof data !== 'object') return []
  if (Array.isArray(data.configs)) return data.configs
  if (data.config && typeof data.config === 'object') return [data.config]
  return []
}

function settingsOf(config) {
  if (!config || typeof config.additionalSettings !== 'string') return {}
  try {
    const parsed = JSON.parse(config.additionalSettings)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function factsFromConfig(data) {
  const configs = configList(data)
  const ids = [...new Set(configs.map((c) => c?.id).filter((v) => typeof v === 'string' && v))]
  const urls = [...new Set(configs.map((c) => c?.url).filter((v) => typeof v === 'string' && v))]
  const settingsKeys = [...new Set(configs.flatMap((c) => Object.keys(settingsOf(c))))].sort()
  return {
    ids,
    urls,
    settingsKeys,
    icon: typeof data?.icon === 'string' ? data.icon : null,
    name: typeof configs[0]?.name === 'string' ? configs[0].name : null,
    author: typeof configs[0]?.author === 'string' ? configs[0].author : null,
  }
}

function add(map, key, ref) {
  if (!key) return
  if (!map.has(key)) map.set(key, [])
  map.get(key).push(ref)
}

function groupRows(map) {
  return [...map.entries()].filter(([, refs]) => refs.length > 1).map(([key, refs]) => ({ key, refs }))
}

const urlCache = new Map()
async function fetchChain(url, { timeout = 15000, maxHops = 6 } = {}) {
  const hops = []
  let current = url
  for (let i = 0; i <= maxHops; i++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const res = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': UA, Accept: '*/*' },
      })
      clearTimeout(timer)
      if (res.body) {
        try {
          await res.body.cancel()
        } catch {}
      }
      const location = res.headers.get('location')
      hops.push({ url: current, status: res.status })
      if (res.status >= 300 && res.status < 400 && location) {
        current = new URL(location, current).toString()
        continue
      }
      return {
        status: res.status,
        finalUrl: current,
        contentType: res.headers.get('content-type') || null,
        error: res.status >= 400 ? `HTTP ${res.status}` : null,
        hops,
      }
    } catch (e) {
      clearTimeout(timer)
      return { status: 0, finalUrl: current, contentType: null, error: String(e.message || e), hops }
    }
  }
  return { status: 0, finalUrl: current, contentType: null, error: 'too many redirects', hops }
}

function linkCheck(url) {
  if (!urlCache.has(url)) urlCache.set(url, fetchChain(url))
  return urlCache.get(url)
}

const sourceCache = new Map()
function sourceFacts(url) {
  if (!sourceCache.has(url)) sourceCache.set(url, collectSourceFacts(url))
  return sourceCache.get(url)
}

async function collectSourceFacts(url) {
  let u
  try {
    u = new URL(url)
  } catch {
    return { url, platform: 'other' }
  }
  const host = u.hostname.toLowerCase()
  const seg = u.pathname.split('/').filter(Boolean)
  if (host === 'github.com' && seg.length >= 2) {
    const repo = `${seg[0]}/${seg[1]}`
    const data = await ghApi(`repos/${repo}`, { optional: true })
    if (!data) return { url, platform: 'github', repo, error: 'not found' }
    const releases = await ghApi(`repos/${repo}/releases?per_page=5`, { optional: true })
    const list = (Array.isArray(releases) ? releases : []).map((r) => ({
      tag: r.tag_name,
      publishedAt: r.published_at,
      prerelease: r.prerelease,
      assets: (r.assets || []).map((a) => a.name).slice(0, 25),
    }))
    return {
      url,
      platform: 'github',
      repo,
      archived: !!data.archived,
      disabled: !!data.disabled,
      fork: !!data.fork,
      description: data.description,
      pushedAt: data.pushed_at,
      defaultBranch: data.default_branch,
      stars: data.stargazers_count,
      releases: list,
    }
  }
  if (host === 'codeberg.org' && seg.length >= 2) {
    const repo = `${seg[0]}/${seg[1]}`
    try {
      const res = await fetch(`https://codeberg.org/api/v1/repos/${repo}`, { headers: { 'User-Agent': UA } })
      if (!res.ok) return { url, platform: 'codeberg', repo, error: `HTTP ${res.status}` }
      const data = await res.json()
      return {
        url,
        platform: 'codeberg',
        repo,
        archived: !!data.archived,
        description: data.description,
        pushedAt: data.updated_at,
      }
    } catch (e) {
      return { url, platform: 'codeberg', repo, error: String(e.message || e) }
    }
  }
  return { url, platform: 'other' }
}

async function checkConfigLinks(facts) {
  const links = [
    ...facts.urls.map((url) => ({ kind: 'config', url })),
    ...(facts.icon ? [{ kind: 'icon', url: facts.icon }] : []),
  ]
  const checked = await Promise.all(
    links.map(async (l) => {
      const c = await linkCheck(l.url)
      return {
        ...l,
        status: c.status,
        error: c.error,
        contentType: c.contentType,
        finalUrl: c.finalUrl && c.finalUrl !== l.url ? c.finalUrl : undefined,
      }
    })
  )
  const sources = await Promise.all([...new Set(facts.urls)].map((u) => sourceFacts(u)))
  return { links: checked, sources }
}

function buildExistingIndex() {
  let categories = []
  try {
    categories = Object.keys(JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8')))
  } catch {}
  const apps = []
  const idIndex = new Map()
  const urlIndex = new Map()
  const settingsKeys = new Set()
  for (const file of walkJson(APPS_DIR)) {
    const rel = relPath(file)
    let data = null
    let parseError = null
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (e) {
      parseError = String(e.message || e)
    }
    const facts = data ? factsFromConfig(data) : { ids: [], urls: [], settingsKeys: [], icon: null }
    facts.settingsKeys.forEach((k) => settingsKeys.add(k))
    for (const id of facts.ids) add(idIndex, id, rel)
    for (const u of facts.urls) add(urlIndex, normalizeUrl(u), rel)
    apps.push({ path: rel, parseError, ...facts })
  }
  return {
    categories,
    apps,
    settingsKeys: [...settingsKeys].sort(),
    duplicateIds: groupRows(idIndex),
    duplicateUrls: groupRows(urlIndex),
  }
}

function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let index = 0
  const workers = Array.from({ length: Math.min(limit, items.length) || 1 }, async () => {
    for (;;) {
      const i = index++
      if (i >= items.length) return
      results[i] = await fn(items[i], i)
    }
  })
  return Promise.all(workers).then(() => results)
}

async function fetchPrFileContent(pr, file, repo) {
  const headRepo = pr.head?.repo?.full_name || repo
  const encoded = file.filename.split('/').map(encodeURIComponent).join('/')
  try {
    const raw = await ghApi(`repos/${headRepo}/contents/${encoded}?ref=${pr.head.sha}`, { raw: true })
    if (raw && raw.trim()) return raw
  } catch {}
  if (file.status === 'added' && file.patch) {
    const lines = file.patch
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
      .map((l) => l.slice(1))
    if (lines.length) return `${lines.join('\n')}\n`
  }
  return null
}

async function collectPr(pr, opts) {
  const entry = {
    number: pr.number,
    title: pr.title,
    author: pr.user?.login || null,
    url: pr.html_url,
    draft: !!pr.draft,
    mergeable: pr.mergeable,
    mergeStateStatus: pr.mergeable_state || null,
    headSha: pr.head?.sha || null,
    headRepo: pr.head?.repo?.full_name || null,
    headBranch: pr.head?.ref || null,
    maintainerCanModify: pr.maintainer_can_modify !== false,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    files: [],
  }
  const files = await ghApiPaged(`repos/${opts.repo}/pulls/${pr.number}/files`)
  for (const f of files) {
    const file = { path: f.filename, status: f.status, previousPath: f.previous_filename || null }
    if (f.status !== 'removed' && APP_PATH_RE.test(f.filename)) {
      const raw = await fetchPrFileContent(pr, f, opts.repo)
      if (raw == null) {
        file.contentError = 'could not fetch file content'
      } else {
        try {
          file.json = JSON.parse(raw)
        } catch (e) {
          file.parseError = String(e.message || e)
          file.raw = raw.slice(0, 4000)
        }
        if (file.json) Object.assign(file, factsFromConfig(file.json))
        if (file.json && !opts.skipNetwork) file.checks = await checkConfigLinks(file)
      }
    }
    entry.files.push(file)
  }
  return entry
}

async function collectRepo(opts) {
  const files = opts.files.length ? opts.files.map((f) => path.resolve(ROOT, f)) : walkJson(opts.dir)
  return mapLimit(files, opts.concurrency, async (file) => {
    const entry = { path: relPath(file) }
    let data = null
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (e) {
      entry.parseError = String(e.message || e)
      entry.raw = fs.readFileSync(file, 'utf8').slice(0, 4000)
    }
    if (data) {
      entry.json = data
      Object.assign(entry, factsFromConfig(data))
      if (!opts.skipNetwork) entry.checks = await checkConfigLinks(entry)
    }
    return entry
  })
}

function linkBits(checks) {
  if (!checks) return []
  const bits = []
  for (const l of checks.links) {
    const status = l.error || l.status
    bits.push(`${l.kind}=${l.url}[${status}${l.finalUrl ? ` -> ${l.finalUrl}` : ''}${l.contentType ? ` ${l.contentType}` : ''}]`)
  }
  for (const s of checks.sources) {
    if (s.platform === 'other') continue
    const parts = [`src=${s.platform}:${s.repo}`]
    if (s.pushedAt) parts.push(`pushed=${String(s.pushedAt).slice(0, 10)}`)
    if (s.releases?.[0]?.publishedAt) parts.push(`release=${String(s.releases[0].publishedAt).slice(0, 10)}`)
    if (s.releases?.[0]?.assets?.length) parts.push(`assets=${s.releases[0].assets.slice(0, 8).join(',')}`)
    if (s.fork) parts.push('fork=yes')
    if (s.archived) parts.push('archived=yes')
    if (s.disabled) parts.push('disabled=yes')
    if (s.error) parts.push(`srcError=${s.error}`)
    bits.push(parts.join(' '))
  }
  return bits
}

function fileBits(file) {
  const bits = [`${file.status} ${file.path}`]
  if (file.contentError) bits.push(`contentError=${file.contentError}`)
  if (file.parseError) bits.push(`parseError=${file.parseError}`)
  if (file.ids?.length) bits.push(`id=${file.ids.join('|')}`)
  if (file.urls?.length) bits.push(`url=${file.urls.join('|')}`)
  if (file.settingsKeys?.length) bits.push(`settings=${file.settingsKeys.join('|')}`)
  if (file.icon && !file.checks) bits.push(`icon=${file.icon}`)
  bits.push(...linkBits(file.checks))
  return bits.join(' ')
}

function buildPrDigest(report) {
  const lines = [
    `repo=${report.repo} prs=${report.prs.length} collectedAt=${report.generatedAt} main=${report.mainSha || '?'}`,
    `#number\tauthor\tdraft\tmerge\tmodify\tfiles`,
  ]
  for (const pr of report.prs) {
    const fileParts = [
      pr.error ? `error=${pr.error}` : null,
      ...(pr.files || []).map((f) => fileBits(f)),
    ]
      .filter(Boolean)
      .join(' | ')
    lines.push(
      `#${pr.number}\t${pr.author}\t${pr.draft ? 'draft' : 'open'}\t${pr.mergeStateStatus || pr.mergeable}\t${pr.maintainerCanModify ? 'yes' : 'no'}\t${fileParts}`
    )
  }
  return lines.join('\n')
}

function buildRepoDigest(report) {
  const lines = [
    `collectedAt=${report.generatedAt} apps=${report.apps.length} main=${report.mainSha || '?'}`,
    `# path and facts (tab/space separated)`,
  ]
  for (const app of report.apps) {
    const bits = [app.path]
    if (app.parseError) bits.push(`parseError=${app.parseError}`)
    if (app.ids?.length) bits.push(`id=${app.ids.join('|')}`)
    if (app.urls?.length) bits.push(`url=${app.urls.join('|')}`)
    if (app.settingsKeys?.length) bits.push(`settings=${app.settingsKeys.join('|')}`)
    bits.push(...linkBits(app.checks))
    lines.push(bits.join('\t'))
  }
  return lines.join('\n')
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const report = {
    mode: opts.mode,
    generatedAt: new Date().toISOString(),
    repo: null,
    mainSha: null,
    skipNetwork: opts.skipNetwork,
    existing: buildExistingIndex(),
  }
  try {
    report.mainSha = (
      await execFileP('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
    ).stdout.trim()
  } catch {}

  if (opts.mode === 'prs') {
    if (!report.repo) report.repo = await detectRepo()
    let prs = []
    if (opts.prs.length) {
      prs = await mapLimit(opts.prs, opts.concurrency, (n) => ghApi(`repos/${report.repo}/pulls/${n}`))
    } else {
      prs = await ghApiPaged(`repos/${report.repo}/pulls?state=open`)
      if (opts.author) prs = prs.filter((p) => (p.user?.login || '').toLowerCase() === opts.author)
      if (opts.limit) prs = prs.slice(0, opts.limit)
    }
    prs = prs.filter(Boolean).sort((a, b) => a.number - b.number)
    report.prs = await mapLimit(prs, opts.concurrency, async (pr, i) => {
      try {
        const entry = await collectPr(pr, { ...opts, repo: report.repo })
        console.error(`collected #${pr.number} (${i + 1}/${prs.length})`)
        return entry
      } catch (e) {
        console.error(`failed #${pr.number}: ${e.message || e}`)
        return { ...pr, number: pr.number, files: [], error: String(e.message || e) }
      }
    })
    const idIndex = new Map()
    const urlIndex = new Map()
    for (const app of report.existing.apps) {
      for (const id of app.ids) add(idIndex, id, app.path)
      for (const u of app.urls) add(urlIndex, normalizeUrl(u), app.path)
    }
    for (const pr of report.prs) {
      for (const f of pr.files || []) {
        for (const id of f.ids || []) add(idIndex, id, `#${pr.number}`)
        for (const u of f.urls || []) add(urlIndex, normalizeUrl(u), `#${pr.number}`)
      }
    }
    report.duplicateIds = groupRows(idIndex)
    report.duplicateUrls = groupRows(urlIndex)
  } else {
    report.apps = await collectRepo(opts)
  }

  fs.mkdirSync(path.dirname(opts.out), { recursive: true })
  fs.writeFileSync(opts.out, JSON.stringify(report, null, 2))
  const digest = opts.mode === 'prs' ? buildPrDigest(report) : buildRepoDigest(report)
  const digestPath = `${opts.out}.digest.txt`
  fs.writeFileSync(digestPath, digest)
  if (opts.printDigest) console.log(digest)
  const count = opts.mode === 'prs' ? report.prs.length : report.apps.length
  console.log(`collected ${count} ${opts.mode === 'prs' ? 'PR(s)' : 'config(s)'}`)
  console.log(`json:   ${opts.out}`)
  console.log(`digest: ${digestPath}`)
  if (opts.mode === 'prs') {
    console.log(`duplicate ids: ${report.duplicateIds.length} group(s), duplicate urls: ${report.duplicateUrls.length} group(s)`)
  }
}

main().catch((e) => {
  console.error(`collect failed: ${e.stack || e.message || e}`)
  process.exit(1)
})
