#!/bin/bash
set -euo pipefail

if ! command -v siege >/dev/null 2>&1; then
	echo "Install siege first." >&2
	exit 1
fi

BASE_URL="${BASE_URL:-http://localhost:8080}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CATEGORIES_FILE="$SCRIPT_DIR/../public/data/categories.json"

SAMPLE_TEMP_FILE="$(mktemp)"
trap 'rm -f "$SAMPLE_TEMP_FILE"' EXIT

CATEGORY_PARAMS="$(node -e '
const fs = require("fs");
const keys = Object.keys(JSON.parse(fs.readFileSync(process.argv[1], "utf8")));
process.stdout.write(keys.map(key => "category=" + encodeURIComponent(key)).join("&"));
' "$CATEGORIES_FILE")"

{
	echo "$BASE_URL/"
	echo "$BASE_URL/apps?page=3"
	echo "$BASE_URL/apps?category=browser"
	echo "$BASE_URL/apps?type=complex"
	echo "$BASE_URL/apps?categoryMode=exclusive&category=emulator&category=games&q="
	echo "$BASE_URL/apps?categoryMode=inclusive&$CATEGORY_PARAMS&q=Open"
	echo "$BASE_URL/redirect?r=obtainium://add/https://github.com/ImranR98/Obtainium"
} > "$SAMPLE_TEMP_FILE"

siege -c 10 -t 2M --no-follow -f "$SAMPLE_TEMP_FILE"
