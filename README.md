# [apps.obtainium.imranr.dev](https://apps.obtainium.imranr.dev)

Crowdsourced App Configurations website for [Obtainium](https://github.com/ImranR98/Obtainium).

The website is accessible at [apps.obtainium.imranr.dev](https://apps.obtainium.imranr.dev)

Analytics: https://ln.imranr.dev/obt-apps-visits

## About

This is an [Astro](https://astro.build/) project that serves as the frontend for crowdsourced Obtainium app configurations. It features:

- Browse and search available app configs
- Filter by category
- One-click install via `obtainium://` protocol links
- URL redirection for sharing Obtainium links (`/redirect`)
- Multi-language support

## Development

```bash
npm install
npm run dev
```

The dev server will be available at `http://localhost:8080`.

## Build

```bash
npm run build
```

## Test

The test suite validates every app config and smokes the built SSR server
(pages, API, redirect handling, and static assets). Build first:

```bash
npm ci
npm run build
npm test
```

To build and smoke the production image locally:

```bash
docker build -t apps.obtainium.imranr.dev .
bash scripts/smoke-image.sh apps.obtainium.imranr.dev
```

## Container image

CI publishes the production image to GHCR from `main`:

```bash
docker pull ghcr.io/imranr98/apps.obtainium.imranr.dev:latest
docker run --rm -p 8080:8080 ghcr.io/imranr98/apps.obtainium.imranr.dev:latest
```

Images are tagged `latest` and `sha-<commit>`; each publish records the image
digest as a workflow artifact. The old Docker Hub image
`imranrdev/apps.obtainium.imranr.dev` is deprecated; pull the GHCR image instead.

## Dependency updates

Renovate config lives in `renovate.json`. It groups non-major updates and keeps
majors separate. Auto-merge stays disabled until branch protection requires the
`test` check: without a required status check, auto-merge could land untested
changes.

## Badge your own project

[![Get it on Obtainium](public/badge_obtainium.png)](BADGING.md)

Any project can link straight to an Obtainium import without a listing in this directory, the way
[Delta Chat](https://delta.chat/en/download) and [PrivacyNotes](https://privacynotes.app/#downloads)
do on their own download pages. See [BADGING.md](BADGING.md) for the two link forms and a worked
example.

## Contributing

See the [contributing guidelines](CONTRIBUTING.md) for how to add new app configs.
