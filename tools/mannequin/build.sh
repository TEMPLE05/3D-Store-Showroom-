#!/usr/bin/env bash
# Rebuild the showroom mannequin + clothes and compress them for phones.
#   tools/mannequin/build.sh /path/to/makehuman/makehuman/data
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="$here/../../my-ecommerce-store/public/models/mannequin.glb"
raw="$(mktemp -d)/mannequin-raw.glb"
node "$here/build-mannequin.mjs" "$1" "$raw"
npx --yes gltfpack@1.2.0 -i "$raw" -o "$out" -cc -kn -km
ls -la "$out"
