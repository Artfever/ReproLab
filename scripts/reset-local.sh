#!/usr/bin/env bash
# Removes local-data/runs, local-data/tmp and containers labelled reprolab.run.
# Never touches tracked files or local-data/upstream.
# Usage: scripts/reset-local.sh [--dry-run]
set -u

DRY=0
case "${1:-}" in
  --dry-run) DRY=1 ;;
  "") ;;
  *) echo "Unknown option: $1. Usage: scripts/reset-local.sh [--dry-run]" >&2; exit 2 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$REPO_ROOT/local-data"
DOCKER_CMD="${REPROLAB_DOCKER:-docker}"
failed=0

for name in runs tmp; do
  target="$DATA_DIR/$name"
  if [ ! -e "$target" ] && [ ! -L "$target" ]; then
    echo "Nothing to remove: local-data/$name does not exist"; continue
  fi
  if [ -L "$target" ] || [ ! -d "$target" ]; then
    echo "SKIP  local-data/$name is a link or not a folder; remove it by hand if you want it gone."
    failed=1; continue
  fi
  tracked="$(git -C "$REPO_ROOT" ls-files -- "local-data/$name" 2>/dev/null)"
  if [ -n "$tracked" ]; then
    echo "SKIP  local-data/$name contains tracked files; not touching it."
    failed=1; continue
  fi
  if [ "$DRY" -eq 1 ]; then echo "Would remove local-data/$name"; continue; fi
  if rm -rf -- "$target"; then echo "Removed local-data/$name"
  else echo "FAIL  Could not remove local-data/$name. Close anything using it and try again."; failed=1; fi
done

if ! command -v "$DOCKER_CMD" >/dev/null 2>&1; then
  echo "Docker not found: no containers to remove."
else
  if ! out="$("$DOCKER_CMD" ps -a -q --filter 'label=reprolab.run' 2>/dev/null)"; then
    echo "Docker is not running, so containers were not checked. Start Docker and run this script again to remove them."
  else
    ids="$(printf '%s\n' "$out" | grep -E '^[0-9a-f]{12,64}$' || true)"
    if [ -z "$ids" ]; then
      echo "No containers labelled reprolab.run."
    else
      count="$(printf '%s\n' "$ids" | wc -l | tr -d ' ')"
      if [ "$DRY" -eq 1 ]; then
        echo "Would remove $count container(s) labelled reprolab.run"
      elif printf '%s\n' "$ids" | xargs "$DOCKER_CMD" rm -f >/dev/null 2>&1; then
        echo "Removed $count container(s) labelled reprolab.run"
      else
        echo "FAIL  Docker could not remove some containers."; failed=1
      fi
    fi
  fi
fi

exit "$failed"
