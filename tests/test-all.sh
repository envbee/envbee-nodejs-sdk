#!/bin/bash
set -euo pipefail

NODE_VERSIONS=("22" "24" "26")
CACHE_DIR="/tmp/empty-node_modules"

# Ensure the host-side node_modules mount point exists and is empty
mkdir -p "$CACHE_DIR"
docker run --rm -t -v $CACHE_DIR:/old_node_modules alpine:latest /bin/sh -c "/bin/rm -rf /old_node_modules/*"

echo "🧪 Starting matrix test with Node.js versions: ${NODE_VERSIONS[*]}"
echo

for version in "${NODE_VERSIONS[@]}"; do
  echo "🔹 Testing with Node.js v$version..."

  docker run --rm \
    -v "$PWD/..":/app \
    -v "$CACHE_DIR":/app/node_modules \
    -w /app \
    -e AVA_FORCE_CI=true \
    node:$version \
    bash -c "npm ci && npm test" || {
      echo "❌ Tests failed on Node.js v$version"
      exit 1
    }

  echo "✅ Tests passed on Node.js v$version"
  echo
done

echo "🎉 All versions passed successfully."
