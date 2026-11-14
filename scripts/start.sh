#!/usr/bin/env bash
# Checks prerequisites and starts the ReproLab local server (apps/local) on 127.0.0.1.
# Usage: scripts/start.sh [--check-only]
# Environment overrides: REPROLAB_NODE, REPROLAB_DOCKER, REPROLAB_IMAGE (default
# reprolab-openbugs:3.2.3-vendored), REPROLAB_PORT (default 8765).
# A missing Node 24.x stops the script. Docker or image problems only warn.
set -u

CHECK_ONLY=0
case "${1:-}" in
  --check-only) CHECK_ONLY=1 ;;
  "") ;;
  *) echo "Unknown option: $1. Usage: scripts/start.sh [--check-only]" >&2; exit 2 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
APP_DIR="$REPO_ROOT/apps/local"
NODE_CMD="${REPROLAB_NODE:-node}"
DOCKER_CMD="${REPROLAB_DOCKER:-docker}"
IMAGE="${REPROLAB_IMAGE:-reprolab-openbugs:3.2.3-vendored}"
PORT="${REPROLAB_PORT:-8765}"

echo "ReproLab local start check"
fatal=0

# Node 24.x (fatal)
if ! command -v "$NODE_CMD" >/dev/null 2>&1; then
  echo "FAIL  Node.js: not found. Install Node 24.x from https://nodejs.org/ and open a new terminal."
  fatal=1
else
  node_version="$("$NODE_CMD" --version 2>/dev/null | head -n 1)"
  case "$node_version" in
    v24.*) echo "OK    Node.js: $node_version" ;;
    *) echo "FAIL  Node.js: found '$node_version' but ReproLab needs Node 24.x. Install Node 24 from https://nodejs.org/ and open a new terminal."
       fatal=1 ;;
  esac
fi

# Docker running (warning only)
docker_ok=0
if ! command -v "$DOCKER_CMD" >/dev/null 2>&1; then
  echo "WARN  Docker: not found. Install Docker Desktop (Windows, with WSL2) or Docker Engine (Linux). The pages open, but runs will report Docker as missing."
elif "$DOCKER_CMD" info >/dev/null 2>&1; then
  docker_ok=1
  echo "OK    Docker: running"
else
  echo "WARN  Docker: installed but not running. Start Docker Desktop (or the Docker service) and wait until it says it is running. The pages open, but runs will fail until then."
fi

# Image present (warning only)
if [ "$docker_ok" -eq 1 ]; then
  if "$DOCKER_CMD" image inspect "$IMAGE" >/dev/null 2>&1; then
    echo "OK    Image: $IMAGE is present"
  else
    echo "WARN  Image: $IMAGE is not present. Build it with: scripts/build-image.sh (needs vendor/OpenBUGS-3.2.3.tar.gz, see the README). Runs will fail until it exists."
  fi
else
  echo "SKIP  Image: not checked because Docker is not available (needed: $IMAGE)"
fi

if [ "$fatal" -eq 1 ]; then
  echo "Cannot start: fix the FAIL item above and run this script again."
  exit 1
fi

if [ "$CHECK_ONLY" -eq 1 ]; then
  echo "Check only: nothing started. The server would listen on http://127.0.0.1:$PORT/"
  exit 0
fi

echo "Starting ReproLab on http://127.0.0.1:$PORT/ (press Ctrl+C to stop)"
cd "$APP_DIR" && exec "$NODE_CMD" src/server.mjs
