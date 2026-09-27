---
name: review-repo-apps
description: Use ONLY for the ImranR98/apps.obtainium.imranr.dev repo when asked to audit the app configs already on main — check existing apps for validity, folder placement, dead or misleading links, source recency (12-month rule), duplicates, or morally questionable content (gambling/adult/drugs), and optionally fix them on a branch. Uses the shared collect.mjs facts and criteria.
---

# Review existing repo apps

Audits the app configs already committed under `public/data/apps/` using the same standards as the
PR review: validity (schema, filename/id, simple/complex folder, categories, settings, links),
recency (12-month source activity rule), duplicates, and moral concerns. Reports first; only makes
changes on a branch after explicit consent.

The collector and criteria are shared with the PR skill:

- Script: `.agents/skills/review-and-merge-prs/scripts/collect.mjs`
- Criteria: `.agents/skills/review-and-merge-prs/reference/criteria.md` (read this before judging)

## Guardrails

- Never edit `main`, push, or open a PR without explicit consent for that action.
- Report findings before proposing changes; list each proposed fix so the user can veto.
- When fixing, work on a branch (`audit/app-configs-<date>`), one logical change per commit.
- Deleting an app config or replacing a source is a removal decision — always ask per app.
- Never guess recency when `platform: "other"`; mark it unknown instead.
- Never dump hundreds of digest lines into the conversation; batch and summarize.

## Phase 1 — collect facts

```bash
node .agents/skills/review-and-merge-prs/scripts/collect.mjs repo --skip-network   # instant structural pass
node .agents/skills/review-and-merge-prs/scripts/collect.mjs repo                    # adds link/source facts (~2 min)
node .agents/skills/review-and-merge-prs/scripts/collect.mjs repo --file <path>      # one config, e.g. after a fix
```

Outputs `/tmp/opencode/pr-review/repo.json` (full contents, checks, existing index, duplicate
groups) and `repo.json.digest.txt` (one line per config). The digest includes parse errors, ids,
URLs, settings keys, link statuses/redirects/content-types, and source recency where available.

## Phase 2 — review in batches

Read the digest in batches of ~30–50 lines with the Read tool (offset/limit), or Grep it for
specific risk classes first. Apply `reference/criteria.md` to each config; open `repo.json` (or the
config file itself) only when a line needs detail. Track results as you go.

Priority order:

1. `parseError=` — broken JSON (site silently drops the app).
2. Missing/invalid required fields, filename/id mismatch, wrong simple/complex folder.
3. Link problems: unreachable, non-2xx, redirect to another domain, banned/mirror/shortener host,
   tracking params, release-pinned URLs; icons that are dead or not images.
4. Recency: `pushed=` and `release=` both older than 12 months, `archived=yes`, `disabled=yes`,
   GitHub sources with no releases or no `.apk` asset in recent releases. Inactivity alone is not a
   defect: apply the self-contained-app exception from `reference/criteria.md` with your own
   judgment (examples are illustrative, not exhaustive).
5. Sources that are not official (forks without renamed package/display name, aggregator or
   reupload sites).
6. `duplicateIds` / `duplicateUrls` — same id in two files, or one URL shared by unrelated apps.
7. Moral flags (gambling/betting, adult/NSFW, drugs/alcohol/tobacco) from names/descriptions/URLs.

Note that many repo files share a source URL legitimately (stable/nightly variants of one app), and
some lack icons or English descriptions — judge these against the criteria rather than flagging
mechanically. `platform: "other"` sources have no recency data.

Apps already accepted on `main` that are >12 months inactive but fall under the self-contained-app
exception (simple tools, offline games, one-off ports of old games, finished projects) must **not**
be flagged, removed, or blocked for age. Only re-raise them if the source becomes archived/disabled,
links break, the app no longer matches the exception, or there is other evidence it stopped working.
Use your own judgment; the example categories are not exhaustive. Banking/social/downloader/
online-dependent apps do not qualify.

## Phase 3 — report and consent

Report counts plus per-app one-liners, grouped:

```markdown
## ✅ Healthy (N)
## 🔧 Fixable (N)
- public/data/apps/simple/foo.json (com.foo) — fix: icon dead → null
## ⚠️ Needs your review (N)
- public/data/apps/complex/bar.json (com.bar) @author — online service source inactive since 2023-11 (outside the self-contained exception); remove or replace?
- public/data/apps/simple/baz.json (com.baz) — moral-gambling: matched "casino"
## ❌ Not ready / remove (N)
- public/data/apps/complex/qux.json (com.qux) — reupload host, not an official source
```

Then ask what to do: `Fix all fixable on a branch (recommended)`, `Fix a subset`, `Report only`,
`Cancel`. Record which paths were approved for fixes and which apps for removal.

## Phase 4 — remediation (only with consent)

1. `git checkout main && git pull --ff-only`, then `git checkout -b audit/app-configs-<date>`.
2. Apply the approved fixes from the fix catalog in `reference/criteria.md` (icons → `null`, wrong
   folder, filename, category, description, settings, https, whitespace).
3. Re-check each changed file:
   `node .agents/skills/review-and-merge-prs/scripts/collect.mjs repo --file <path>`
4. Commit in logical groups (e.g. `Fix dead icons`, `Move default-setting apps to simple/`).
5. Ask before pushing the branch and opening a PR; summarize the diff first (`git diff --stat`,
   `git diff` for judgment calls). Do not delete apps unless the user approved each one.

## Phase 5 — summary

Close with what was reviewed, what changed (or would change), what remains healthy, and the list of
apps that need a human decision (inactive/unmaintained, unofficial sources, duplicates, moral
flags). Offer to hand removal/comment follow-ups to the user.
