#!/usr/bin/env bash
# Smoke-test a built production image without any external services.
#
#   scripts/smoke-image.sh ghcr.io/owner/image:tag
#
# Starts the image, requests the main pages/API/static assets, and exits
# non-zero if any expected response is wrong.
set -euo pipefail

image="${1:-}"
if [ -z "$image" ]; then
    echo "usage: $0 <image>" >&2
    exit 2
fi

if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required for the image smoke test" >&2
    exit 1
fi

runtime="${CONTAINER_RUNTIME:-}"
if [ -z "$runtime" ]; then
    if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
        runtime=docker
    elif command -v podman >/dev/null 2>&1 && podman info >/dev/null 2>&1; then
        runtime=podman
    else
        echo "no usable docker or podman runtime found" >&2
        exit 1
    fi
fi

case "$runtime" in
    docker|podman) ;;
    *)
        echo "unsupported container runtime: $runtime" >&2
        exit 2
        ;;
esac

name="apps-obtainium-smoke-$$"
port=""
tmp=""

cleanup() {
    status=$?
    if [ "$status" -ne 0 ] && [ -n "$port" ]; then
        echo "--- container logs ---" >&2
        "$runtime" logs "$name" 2>&1 | tail -n 80 >&2 || true
    fi
    if [ -n "$tmp" ]; then
        rm -f "$tmp"
    fi
    "$runtime" rm -f "$name" >/dev/null 2>&1 || true
    exit "$status"
}
trap cleanup EXIT

echo "runtime: $runtime"
echo "image: $image"

"$runtime" run -d --rm --name "$name" \
    --env PLAUSIBLE_API_BASE_URL=http://127.0.0.1:9 \
    --publish 127.0.0.1::8080 \
    "$image" >/dev/null

for _ in $(seq 1 40); do
    port="$("$runtime" port "$name" 8080/tcp 2>/dev/null | head -n 1 | awk -F: '{print $NF}')"
    if [ -n "$port" ]; then
        break
    fi
    sleep 0.25
done
if [ -z "$port" ]; then
    echo "container did not publish port 8080" >&2
    exit 1
fi

base="http://127.0.0.1:${port}"
ready=0
for _ in $(seq 1 80); do
    if curl -fsS --max-time 2 -o /dev/null "${base}/" 2>/dev/null; then
        ready=1
        break
    fi
    sleep 0.25
done
if [ "$ready" -ne 1 ]; then
    echo "app did not become ready at ${base}" >&2
    exit 1
fi

tmp="$(mktemp)"

check() {
    local path="$1"
    local expected="$2"
    local needle="${3:-}"
    local status

    status="$(curl -sS --max-time 10 -o "$tmp" -w '%{http_code}' "${base}${path}")" || status=000
    if [ "$status" != "$expected" ]; then
        echo "FAIL ${path}: expected HTTP ${expected}, got ${status}" >&2
        head -c 500 "$tmp" >&2 || true
        echo >&2
        return 1
    fi
    if [ -n "$needle" ] && ! grep -qF -- "$needle" "$tmp"; then
        echo "FAIL ${path}: response did not contain: ${needle}" >&2
        return 1
    fi
    echo "ok ${path} (${status})"
}

check_type() {
    local path="$1"
    local expected="$2"
    local content_type

    content_type="$(curl -sS --max-time 10 -o /dev/null -w '%{content_type}' "${base}${path}")" || content_type=""
    case "$content_type" in
        "$expected"*)
            echo "ok ${path} (${content_type})"
            ;;
        *)
            echo "FAIL ${path}: expected content type ${expected}, got ${content_type}" >&2
            return 1
            ;;
    esac
}

check "/" 200 "<title>Obtainium Apps</title>"
check "/apps" 200 "obtainium://app/"
check "/apps.html" 200 "<title>Obtainium Apps</title>"
check "/api/apps?limit=1" 200 '"pagination"'
check "/data/categories.json" 200 '"games"'
check "/sitemap.xml" 200 "apps.obtainium.imranr.dev"
check "/redirect?r=obtainium://add/https%3A%2F%2Fexample.com" 200 "obtainium://add/https://example.com"
check "/this-page-does-not-exist" 404 "404"
check_type "/favicon.png" "image/png"

echo "image smoke passed"
