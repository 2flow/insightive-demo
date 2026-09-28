#!/usr/bin/env bash
# Produce substance-watch-static/ — the clean, self-contained copy of the app
# handed over to be hosted as a static site (source + a pre-built out/).
#
# Requirements: Node >= 18.17, npm, rsync.
set -euo pipefail

cd "$(dirname "$0")"
DEST=substance-watch-static

rm -rf "$DEST"
mkdir "$DEST"

rsync -a app components lib public tools "$DEST/"
cp package.json package-lock.json next.config.mjs tsconfig.json \
   tailwind.config.ts postcss.config.mjs .gitignore next-env.d.ts README.md "$DEST/"

(cd "$DEST" && npm ci && npm run build && rm -rf node_modules .next)

echo
echo "Done. Upload the contents of $DEST/out/ to any static host."
