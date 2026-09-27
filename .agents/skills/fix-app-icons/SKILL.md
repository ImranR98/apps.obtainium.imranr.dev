---
name: fix-app-icons
description: Use ONLY for the ImranR98/apps.obtainium.imranr.dev repo when asked to find app configs with invalid/broken icons or missing icons and fix them. Runs scripts/validate_icons.js --check to find definitively bad icons and scripts/find-missing-icons.mjs to find configs with no icon, researches replacement and new icon URLs agent-side (no fixed method), presents app names plus candidate URLs for manual review, and only applies changes after explicit user approval.
---

# Fix invalid and missing app icons

Finds committed app configs whose `icon` URL is definitively broken and replaces it with a suitable
working alternative (or `null`), and looks for a suitable icon to add to configs that have none. The
user reviews every proposed change before anything is modified.

Missing icons are **valid** — the criteria allow `icon` to be omitted or `null` — so adding one is
an enhancement, not a correctness fix. It is always better to leave a config icon-less than to add
uncertain, generic, or unofficial artwork.

The icon validator is the repo script at `scripts/validate_icons.js` (also exposed as
`npm run validate:check`). Icon rules live in
`.agents/skills/review-and-merge-prs/reference/criteria.md` (omit/`null` or a direct https image
returning `image/*`; ICO is not accepted).

## Guardrails

- Never edit config files without per-batch explicit consent from the user.
- Alternative-icon research is agent-driven: there is no hardcoded lookup method. Decide per app
  where its official icon lives and verify each candidate yourself.
- Every candidate must be a direct https image URL that returns 2xx with an `image/*` content type
  and is decodable by the validator (SVG is fine, ICO is not). Reject HTML pages, redirects to
  pages, data URIs, and non-image responses.
- Prefer the app's own sources (official repo, project site, official store listing, press kit).
  Avoid reupload/aggregator hosts (APKMirror, APKPure, etc.) and random icon-dump sites.
- Never invent or generate icons, and never reuse another app's logo or a generic function/OS/stock
  icon. A candidate must be the app's own official mark.
- Treat `Unverified icon` entries (403, 429, 5xx, timeouts) as non-definitive: they are not proof
  the icon is broken, since browsers often load them. Still research and include them as optional,
  lower-confidence replacement candidates so the user can decide — never silently skip them.
- When a broken icon has no suitable alternative, propose `icon: null` instead. A config that is
  already icon-less stays as-is when no candidate is good enough — never "fix" it to `null`.
- Do not commit, push, or open PRs without an explicit request. Report, get consent, then act.
- Keep the working tree clean before starting; work on the current branch or create one if asked.

## Phase 1 — find bad, unverified, and icon-less configs

Run the validator in check mode (no files are modified):

```bash
node scripts/validate_icons.js --check
node scripts/validate_icons.js --check public/data/apps/complex/foo.json   # targeted re-check after a fix
```

- The process exits non-zero when bad icons exist — that is the expected signal, not a failure.
- Collect the `Bad icon: <path>: <url> [reason]` lines. Reasons are definitive: HTTP 400/401/404/
  405/410, ICO, or a non-decodable image.
- Also collect the `Unverified icon: <path>: <url> [reason]` lines. These are vague/non-definitive
  failures (403, 429, 5xx, network errors) where the icon may still work in a browser. Do not drop
  them: carry them into the research phase as optional replacement candidates, flagged as
  lower-confidence in the report.

The validator skips configs that have no `icon`, so enumerate those separately:

```bash
node .agents/skills/fix-app-icons/scripts/find-missing-icons.mjs
```

It prints one line per icon-less config — path, id, name, `icon=omitted|null`, and the source URL.
These are enhancement targets, not failures. Carry every one into research; never silently skip one.

For each bad, unverified, or icon-less config, read it to gather context: `id`, `name`,
`categories`, `description`, and the source `url` (this reveals the official home of the app).

## Phase 2 — research candidates (agent judgment)

For every app from Phase 1 — definitive failures, unverified ones, and icon-less ones alike — find
one or two candidate icon URLs and enough evidence to justify them. Research is your job; the
avenues below are prompts, not a checklist or an algorithm:

- Follow the config's source `url` to the project's official home, then look for its icon/branding
  assets: repo files, `fastlane` metadata, website `apple-touch-icon`/favicon, press kits, store
  listing artwork, organization avatars.
- For open-source apps the repo's launcher icon or README logo often works; for fan ports and
  recompilations, the port project's own repo or site is the authority.
- Use GitHub/GitLab/Codeberg raw URLs for repo assets, and prefer stable paths over branch-specific
  ones when a release/tag asset exists.
- Confirm each candidate actually depicts the app (name/logo match), then fetch it with a browser
  User-Agent to verify status and content type. A `403` or `000` to automated requests may still be
  fine in a browser — open the URL or try the raw/direct variant before discarding it.
- Prefer the smallest direct asset that still looks right; avoid hotlink-protected CDNs and URLs
  with tracking parameters.

Known-good patterns when the project is distributed there (verify each URL, and that the package
actually exists on the store):

- F-Droid listing icon: `https://f-droid.org/repo/<package-id>/en-US/icon.png`
  (check `https://f-droid.org/api/v1/packages/<package-id>` first).
- Official Google Play listing icon: the `og:image` URL from the listing HTML, with its size suffix
  raised to `=s512`.
- GitHub mirror of a project whose real home blocks the validator (e.g. Codeberg):
  `https://raw.githubusercontent.com/<owner>/<repo>/<branch-or-HEAD>/<path>`, when an official
  mirror exists.

For unverified entries, first re-test the current URL more carefully (browser-like headers, the raw
or alternate variant, a different host path) to judge whether it is actually broken. Only propose a
replacement when a candidate is clearly at least as good; if the current icon is likely fine and no
better candidate exists, say so and propose leaving it.

For icon-less configs, a candidate must clear a higher bar: skip apps that are unidentifiable, dead,
or only present on aggregator/fan/icon-dump sites, and skip artwork that is generic or of poor
quality (tiny upscales, screenshots, wordmarks illegible at icon size). Leaving the config icon-less
is a valid outcome. Git history can help: `git log -p --follow -- <path>` often shows a
previously-nulled URL and where it pointed.

Record for each app: the current URL and failure reason (or `omitted`/`null` for icon-less configs),
candidate URL(s), and the evidence (where it came from, what you verified). If nothing suitable is
found, mark it `null` (broken icon) or leave as-is (already icon-less).

## Phase 3 — report and consent

Report one table per outcome bucket, then ask for approval:

```markdown
## 🔧 Replaceable (N)
| App | id | Current (reason) | Candidate | Evidence |
|-----|----|------------------|-----------|----------|
| Total Commander | com.ghisler.android.TotalCommander | wikimedia thumb (HTTP 400) | https://upload.wikimedia.org/.../Total_Commander_Logo.png | original Commons file, 200 image/png |

## ❓ Unverified / optional (N)
| App | id | Current (non-definitive reason) | Candidate | Evidence |
|-----|----|---------------------------------|-----------|----------|
| PeerTube | org.framasoft.peertube | framasoft.frama.io (timeout to bots) | https://.../icon.png | current likely fine in browser; candidate verified 200 image/png |

## ➕ Icon-less — proposed additions (N)
| App | id | No icon (omitted/null) | Candidate | Evidence |
|-----|----|------------------------|-----------|----------|
| MT Manager | bin.mt.plus | null (previously HTTP 404) | https://.../icon.png | official repo fastlane icon, 200 image/png |

## 🚫 No suitable icon (N)
| App | id | Proposal |
|-----|----|----------|
| Foo | com.foo | icon: null (broken, no alternative) |

## ✅ Left as-is (N)
- Unverified icons that are likely fine and have no clearly better candidate
- Icon-less configs with no suitable official asset (state why for each)
```

Then ask with the question tool, including only the options that match the report, e.g.:
`Apply all fixes + additions incl. unverified (recommended)`,
`Apply definitive fixes + additions (skip unverified)`, `Apply definitive fixes only`,
`Apply additions only`, `Apply fixes + additions and null the unfixable`, `Pick manually`,
`Cancel`. Record exactly which apps and URLs were approved, including whether unverified
replacements and icon-less additions were included.

## Phase 4 — apply changes (only with consent)

1. For replacements, edit only the `icon` value. For additions, insert the `icon` key where sibling
   configs put it (after `config`/`configs`, before `categories`). Preserve 4-space indentation, key
   order, LF line endings, and the trailing newline; touch nothing else.
2. Re-check every changed file:
   `node scripts/validate_icons.js --check <path>` — each must report `0 bad`. An `Unverified`
   result is acceptable for a candidate you already verified by direct fetch; note it in the report.
3. If a change fails verification, revert that file and report it; keep the rest.
4. Re-run the full `node scripts/validate_icons.js --check` if more than a handful of files changed.
   Confirm the result matches the approved set: bad count down by the definitive fixes, OK count up
   by the replacements and additions, and any remaining unverified entries explicitly noted.
5. Summarize the diff (`git diff --stat`, then `git diff` for spot checks). Offer to commit/push;
   only do so when explicitly asked.

## Phase 5 — summary

Close with what was checked, what was replaced (app → new URL), which icons were added, which apps
were left as `null`, unchanged, or icon-less and why, and any candidates that need a human eye
before use.
