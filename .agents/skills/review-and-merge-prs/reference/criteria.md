# Validation criteria

Shared judgment guide for the PR-review and repo-audit skills. `collect.mjs` only gathers raw
facts (config contents, link responses, source activity, duplicates) — every verdict below is the
agent's to make. Repo rules come from `APP_CRITERIA.md`, `CONTRIBUTING.md`, `src/lib/types.ts`,
`public/data/categories.json`, and maintainer cleanup commits (e.g. `40b3042`, `2a05085`).

## How to read collector facts

- `checks.links[]`: one entry per config URL and icon URL with `status`, `contentType`, `finalUrl`
  (when redirected), `error`. There are no pass/fail labels — compare against the rules below.
- `checks.sources[]`: raw `platform`, `repo`, `pushedAt`, `releases[]` (`tag`, `publishedAt`,
  `assets`), `archived`, `fork`, `description`. Apply the recency rule yourself.
- `existing`: categories list, known settings keys union, and the per-app index used for duplicates.
- `duplicateIds` / `duplicateUrls`: candidate groups (same id or same normalized URL in more than
  one place). Not every group is a problem — stable/nightly variants legitimately share a source
  URL — so judge each group.
- `settingsKeys` on a file: union of keys found in its `additionalSettings`.

## Config shape

Simple (`public/data/apps/simple/<package-id>.json`) uses a single `config` object; complex uses a
`configs` array. Both may carry `icon`, `categories`, `description`.

A config belongs in **complex** if any of these is true: `configs` has more than one entry, a
config has non-empty `additionalSettings`, or a config has `overrideSource`, `altLabel`, or
`preferredApkIndex`. Otherwise it belongs in **simple**. The filename must be `<package-id>.json`,
and all variants must share one `id` with distinct `altLabel`s.

## Required properties

- Non-empty string `id`, `url`, `author`, `name` in `config`/`configs[0]` (missing → not ready)
- `categories`: non-empty array of keys from `existing.categories` (invalid/missing → fixable)
- `description`: object with an `en` string (missing → fixable; other languages optional)
- `id` matches `^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$` and the filename
- `icon`: omitted, `null`, or a direct https image that returns `image/*` (dead → set `null`)
- Valid JSON, LF, no trailing whitespace, final newline (pre-commit hooks)

## additionalSettings

- Must decode to an object; keys should be in `existing.settingsKeys` or clearly source-specific.
  Unknown/legacy keys are a warning, not automatically wrong.
- Regex-valued keys (`*RegEx`, `customLinkFilterRegex`, `intermediateLinkRegex` and `*Regex` fields
  inside `intermediateLink[]`) must compile and `matchGroupToUse` must not reference a missing
  capture group.
- `overrideSource` should be a real Obtainium source: `GitHub`, `GitLab`, `Codeberg`, `Forgejo`,
  `HTML`, `FDroid`, `FDroidRepo`, `DirectAPKLink`, `SourceForge`, `Aptoide`, `Jenkins`, `ItchIO`,
  `IzzyOnDroid`, `Rustore`, `Tencent`, `Uptodown`, and similar.
- Defaults should stay default; extra `additionalSettings`, extra variants, `includePrereleases`,
  or disabled `versionDetection` need a reason (APP_CRITERIA.md).

## Link and content validity

- Config URL must be reachable (2xx/3xx) and https where the site supports it. Some hosts answer
  403/503 to non-browser clients (Cloudflare); treat that as inconclusive and verify manually
  before failing an app.
- Reupload/mirror hosts are banned per APP_CRITERIA.md: `apkpure.com`, `apkmirror.com`,
  `apkcombo.com`, `uptodown.com`, `apkmonk.com`, `liteapks.com`, `rockmods.net`, `apk4free.net`,
  `farsroid.com`, `apkfab.com`, `apkdone.com`, `apksos.com`, `apksum.com`, `apk.support`,
  `moddroid.com`, `revdl.com`, `rexdl.com`. `aptoide.com` and similar aggregators are strong
  warning signs.
- URL shorteners (`bit.ly`, `tinyurl.com`, `t.co`, `goo.gl`, `is.gd`, `cutt.ly`, `rb.gy`, …) and
  tracking params (`utm_*`, `fbclid`, `gclid`, `igshid`, `_hsenc`, …) are problems.
- A `finalUrl` on a different registrable domain than the config URL is a misleading link unless
  it is a known CDN of the same project.
- A URL pinned to one release/tag (`/releases/tag/`, `/releases/download/`, `/releases/latest`)
  breaks future updates.
- The source must belong to the named app: match repo/org/project name against `name`/`id`, and
  check the repo description. Forks are only acceptable if both package name and display name
  changed (APP_CRITERIA.md).
- Icon URLs must return an `image/*` content type.

## Source recency (12-month rule)

Use `checks.sources[].pushedAt` and the newest `releases[].publishedAt`. If both are older than
12 months, the app needs **judgment**, not an automatic rejection (precedent: PR #1733 was closed
for inactivity, but self-contained apps have since been accepted under the exception below).
Archived or disabled sources are not ready. A GitHub source with no releases, or with releases but
no `.apk`/`.apks`/`.xapk`/`.apkm` asset, cannot install anything — investigate before merging
(archives only count when `includeZips`/`includeTarballs` is set).

### Exception: apps that do not need frequent updates

A >12-month-old source is acceptable if the app could reasonably be abandoned for 12+ months and
remain useful/relevant. **Use your own judgment** — the categories below are examples, not an
exhaustive or mandatory list:

- Simple, single-purpose tools/utilities (share-sheet helpers, converters, offline calculators)
  built on stable OS APIs that do not depend on third-party services.
- Self-contained offline apps: completed games, one-off ports/recompilations of old games, game
  engines that run local data files, roguelikes, emulators.
- Finished projects where no further upstream updates are expected.

These generally do **not** qualify, because inactivity makes them break or go stale:

- Banking/finance, social media/messaging, account-bound or region-locked services.
- Downloaders, scrapers, streaming clients, and anything depending on third-party sites or changing
  APIs (e.g. yt-dlp front-ends) — including tools whose bundled library must keep updating.
- Online multiplayer clients, server-dependent apps, and prerelease/incomplete projects.
- Anything whose usefulness decays quickly without updates.

When accepting an exception, state why in the report. When rejecting, say why. Once an app has been
accepted on `main` under this exception, **do not re-flag, remove, or block it in later runs just
because of age** — only re-raise it if the source becomes archived/disabled, its links break, it no
longer matches the exception, or there is other evidence it stopped working.

## Duplicates

Treat as needing a human decision, not an automatic merge:

- The same `id` added by another open PR, or already in the repo at a different path
- The same normalized URL used by an unrelated app (variants of one app sharing a URL are fine)
- Same app name/author from different sources where only one can be canonical

## Moral flags (never auto-merge)

Keyword hits (confirm from name/description/URL, and report as flags, not failures):

- **Gambling/betting**: casino, gamble, betting, bet, poker, slots, lottery, jackpot, roulette,
  bingo, sportsbook, wager, bookmaker
- **Adult/NSFW**: porn, xxx, nsfw, hentai, escort, onlyfans, adult, erotic, nude/nudity, sexting,
  hookup, tinder, grindr, bumble, dating
- **Drugs/alcohol/tobacco**: vape/vaping, cannabis, marijuana, weed, thc, cbd, alcohol, beer, wine,
  whisky/whiskey, vodka, tobacco, cigarette, cigar, hookah, shisha

## Fix catalog

Simple fixes (apply on a PR branch, or on a working branch for the repo audit):

- Dead/non-image icon → `icon: null` (or a working direct image URL)
- Wrong folder → move `simple/` ⇄ `complex/` and convert `config` ⇄ `configs`
- Filename mismatch → rename to `<id>.json`
- Invalid/missing category → use a real `categories.json` key (`other` if unsure)
- Missing `description`/`en` → add a short factual description
- Malformed/legacy `additionalSettings` → repair the JSON or drop unknown keys
- `http://` → the `https://` variant if it works
- Trailing whitespace / missing final newline
- Duplicate `altLabel` → make labels distinct

Not simple: missing required fields, invalid package id, dead/banned/shortened URLs, wrong app
identity, inactive/archived source, missing release assets, duplicates, merge conflicts, regex
redesign, moral flags, an app that cannot be sourced officially.

## Report buckets

- **Ready / healthy** — no errors, no major warnings, source active, no duplicates or moral flags
- **Fixable** — only issues from the fix catalog remain
- **Needs review** — forks, mirrors, duplicate groups, missing APK assets, pinned release URLs,
  moral flags, anything needing judgment
- **Not ready / remove** — dead, archived, unofficial, or invalid configs that cannot be fixed

## Known limitations

- The collector never installs APKs, so `id` is not verified against the real package; spot-check
  suspicious ones against release metadata or build files.
- HTML/DirectAPKLink sources cannot be exercised; reachability plus inspection is the best check.
- Activity depends on host APIs; `platform: "other"` sources have no recency data — say so rather
  than guessing.
