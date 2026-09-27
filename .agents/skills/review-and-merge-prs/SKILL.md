---
name: review-and-merge-prs
description: Use ONLY for the ImranR98/apps.obtainium.imranr.dev repo when asked to review open PRs, decide which are merge-ready, fix simple issues in app configs, or merge approved PRs. Collects PR facts with collect.mjs and applies the shared criteria (schema, simple/complex folder, categories, icons, settings, links, duplicates, source recency, moral flags), then merges approved PRs one at a time only after explicit consent.
---

# Review and merge open PRs

Reviews every open PR in `ImranR98/apps.obtainium.imranr.dev`, reports which are safe to merge,
fixes simple issues, and merges approved PRs one at a time. Nothing is merged, pushed, commented,
or closed without explicit user consent in the current conversation.

`scripts/collect.mjs` only gathers facts — it computes no verdicts. Read the shared criteria at
`reference/criteria.md` and apply them yourself during the judgment pass.

## Merge-ready definition

A PR is merge-ready only if all of the following hold:

- Open, not a draft, no merge conflict (`mergeable != false`, `mergeStateStatus` not `dirty`).
- Only changes files under `public/data/apps/{simple,complex}/<package-id>.json`.
- Every config passes the schema and folder rules in `reference/criteria.md`.
- Links are valid: reachable official source, https, no banned/mirror/shortener/redirect/pinned
  URLs, reachable image icon (or `null`).
- The source is active (commit or release within 12 months), not archived, and can produce an APK.
  Exception: self-contained apps that stay useful without updates (simple tools, offline games,
  one-off ports of old games, finished projects) may be accepted despite >12 months of inactivity —
  judge each on whether it could be abandoned for 12+ months and remain useful/relevant (see
  `reference/criteria.md`; examples are illustrative, not exhaustive). Banking/social/downloader/
  online-dependent apps do not qualify.
- No duplicate id/URL against the repo or another open PR.
- No moral flag (gambling/betting, adult/NSFW, drugs/alcohol/tobacco).

Everything else goes in `fixable`, `needs-review`, or `not-ready`. You may override your own
classification with judgment, but say why.

## Guardrails (non-negotiable)

- Never merge, push, comment, or close without the user's explicit consent for that action.
- Consent is per batch, not per PR: report first, ask once, then act on the approved set.
- Merge one PR at a time, verify each merge, stop and report on the first failure.
- Never force-push. Never amend or rewrite a contributor's commits; add a fix commit instead.
- Never delete branches. Never push to `main` except the agreed merge-then-fix fallback.
- Re-check the PR head SHA immediately before merging; skip any PR whose head changed since review.
- Work from the repo root; keep reports under `/tmp/opencode/pr-review/`.

## Phase 1 — collect facts

Run from the repo root (Node 22 + `gh` authenticated as a maintainer):

```bash
node .agents/skills/review-and-merge-prs/scripts/collect.mjs prs
node .agents/skills/review-and-merge-prs/scripts/collect.mjs prs --author <login> --limit 50
node .agents/skills/review-and-merge-prs/scripts/collect.mjs prs --pr 1234 --pr 1235 --print-digest
node .agents/skills/review-and-merge-prs/scripts/collect.mjs prs --skip-network   # fast pass
```

It writes `/tmp/opencode/pr-review/prs.json` plus `prs.json.digest.txt`, and prints the paths.
The digest has one line per PR with per-file facts (path, status, ids, URLs with status/redirect/
content-type, settings keys, source repo with last push/release/assets/fork/archived).

Read the digest in batches with the Read tool (offset/limit) or filter it with Grep. Do not read
the full JSON into context; open it only for PRs that need detail (long `files` lists, parse
errors, unusual sources). For 100+ PRs, work author by author or in chunks of ~25 and keep a
running tally.

## Phase 2 — judgment pass

Apply `reference/criteria.md` to every PR, using the digest facts plus `gh pr view <n> --json
body,comments` and `gh pr diff <n>` when semantic checks are needed:

- Schema, filename/id match, folder placement, categories, description, icon.
- `additionalSettings`: decode, compile regexes, compare keys with `existing.settingsKeys`,
  validate `overrideSource`.
- Links: judge `checks.links[]` against the banned/shortener/redirect/pinned rules; confirm the
  source belongs to the named app and is official (forks need renamed package + display name).
- Recency: apply the 12-month rule to `checks.sources[]`, but apply the self-contained-app exception
  from `reference/criteria.md` with your own judgment; check release assets exist for GitHub.
- Duplicates: interpret `duplicateIds`/`duplicateUrls`; variants sharing one URL are fine.
- Moral flags: confirm keyword candidates by reading the app metadata; never auto-merge flagged apps.
- Scope: any file outside `public/data/apps/` changed, or config removals, need a reason.

## Phase 3 — report and consent

Summarize in four buckets. Keep entries to one line; list concrete fixes for fixable PRs.

```markdown
## ✅ Ready to merge (N)
- #1902 Binary Eye (de.markusfisch.android.binaryeye) @BlackWinnerYoshi

## 🔧 Fixable (N)
- #1888 LOD Recomp (org.cvlod.recomp) @kalpakprod
    - fix: set icon to null (dead URL)

## ⚠️ Needs your review (N)
- #1880 Foo (com.foo) @author — moral-gambling: matched "casino"

## ❌ Not merge-ready (N)
- #1891 OpenXcom @kalpakprod — source inactive >12 months
```

Then ask for consent with the question tool: `Merge all ready (recommended)`,
`Merge all ready except flagged`, `Fix then merge fixable`, `Pick PRs manually`, `Cancel`.
Record exactly which PR numbers were approved for merge and which for fixing.

## Phase 4 — merge approved PRs (one at a time)

For each approved PR, in ascending number order:

```bash
REPO=ImranR98/apps.obtainium.imranr.dev
gh pr view <n> --repo "$REPO" --json state,mergeable,mergeStateStatus,headRefOid,maintainerCanModify
# abort this PR if closed, conflicting, or headRefOid != the SHA in your report
gh pr merge <n> --repo "$REPO" --merge --match-head-commit <headRefOid>
gh pr view <n> --repo "$REPO" --json state,mergedAt,mergeCommit
```

- Use `--merge` (merge commit, matches repo history). Do not use `--squash`/`--rebase`.
- Do not delete branches (`--delete-branch` off).
- `--match-head-commit` guards against new commits; if it fails, skip and report.
- Pause ~1s between merges; after each one confirm `state == "MERGED"`.
- On any failure (rate limit, conflict, protected state), stop the loop and report progress.

## Phase 5 — fixable PRs (separate consent)

Only after the user approves the fixes. For each fixable PR:

1. `gh pr checkout <n>` (keep the working tree clean first).
2. Apply the minimal fix from the catalog in `reference/criteria.md`.
3. Re-check the file for judgment-based criteria and refresh link/source facts:
   `node .agents/skills/review-and-merge-prs/scripts/collect.mjs repo --file <path>`
   (add `--skip-network` only when offline).
4. Commit with a clear message (`Fix <issue> in <app> config`) and `git push` (pushes to the
   contributor's fork when maintainer edits are enabled).
5. Re-run `collect.mjs prs --pr <n>` to confirm the PR is clean, then merge it via Phase 4.

If the push is rejected (contributor disabled maintainer edits), use the agreed fallback: merge the
PR first when only trivial issues remain, then apply the same fix on `main`:

```bash
gh pr merge <n> --repo "$REPO" --merge --match-head-commit <headRefOid>
git checkout main && git pull --ff-only
# re-apply the exact same file changes here
node .agents/skills/review-and-merge-prs/scripts/collect.mjs repo --file <path>
git add <paths> && git commit -m "Fix <issue> in <app> config (#<n>)"
git push origin main
```

Do not rebase or merge `main` into a contributor branch unless the user explicitly asks.

## Phase 6 — final report

List the remaining PRs that are neither merged nor fixable, with the blocking reason and the
suggested next step (ask the author for a change, close as inactive, deduplicate, wait). Offer
follow-ups; do not comment on or close PRs unless the user asks and consents.
