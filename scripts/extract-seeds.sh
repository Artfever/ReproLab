#!/usr/bin/env bash
# Extract the four Seeds example files from YOUR OWN OpenBUGS tarball into local-data/upstream/.
# Usage: scripts/extract-seeds.sh TARBALL [OUT_DIR] [HASH_FILE]
# Requirement 10.1 to 10.3. Files are extracted to a temp dir, verified against the recorded
# SHA-256 values, and copied to OUT_DIR only if all four match. Otherwise nothing is written,
# the extracted files are deleted and the exit code is 1. File contents are never printed.
set -u

fail() { echo "extract-seeds: $*" >&2; exit 1; }

[ $# -ge 1 ] || fail "usage: $0 TARBALL [OUT_DIR] [HASH_FILE]"
TARBALL=$1
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
OUT_DIR=${2:-$ROOT/local-data/upstream}
HASH_FILE=${3:-$ROOT/docs/evidence/input_hashes_upstream_examples.txt}
WANTED=(Seedsmodel.txt Seedsdata.txt Seedsinits1.txt Seedsinits2.txt)

[ -f "$TARBALL" ] || fail "tarball not found: $TARBALL"
[ -f "$HASH_FILE" ] || fail "hash file not found: $HASH_FILE"
command -v tar >/dev/null || fail "tar is not available."
command -v sha256sum >/dev/null || fail "sha256sum is not available."

declare -A EXPECTED CHOSEN
for n in "${WANTED[@]}"; do
  h=$(tr -d '\r' < "$HASH_FILE" | awk -v n="$n" '$2 == n || $2 == "*" n { print tolower($1); exit }')
  [[ $h =~ ^[0-9a-f]{64}$ ]] || fail "no recorded hash for $n in the hash file."
  EXPECTED[$n]=$h
done

LIST=$(tar -tzf "$TARBALL" 2>/dev/null) || fail "could not read the tarball (is it a .tar.gz file?)."
for n in "${WANTED[@]}"; do
  hits=$(printf '%s\n' "$LIST" | awk -v n="$n" '$0 !~ /\/$/ && ($0 == n || substr($0, length($0) - length(n)) == "/" n)')
  count=$(printf '%s' "$hits" | grep -c .)
  [ "$count" -ge 1 ] || fail "missing member: $n"
  [ "$count" -le 1 ] || fail "more than one member named $n; refusing to guess."
  case $hits in *..*|/*) fail "unsafe member path for $n." ;; esac
  CHOSEN[$n]=$hits
done

TMP=$(mktemp -d) || fail "could not create a temp directory."
trap 'rm -rf "$TMP"' EXIT

MEMBERS=()
for n in "${WANTED[@]}"; do MEMBERS+=("${CHOSEN[$n]}"); done
tar -xzf "$TARBALL" -C "$TMP" -- "${MEMBERS[@]}" 2>/dev/null || fail "extraction failed."

bad=0
for n in "${WANTED[@]}"; do
  p=$TMP/${CHOSEN[$n]}
  if [ ! -f "$p" ]; then echo "MISSING   $n"; bad=$((bad + 1)); continue; fi
  got=$(sha256sum "$p" | awk '{print $1}')
  if [ "$got" = "${EXPECTED[$n]}" ]; then echo "MATCH     $got  $n"
  else echo "MISMATCH  $got  $n  (recorded ${EXPECTED[$n]})"; bad=$((bad + 1)); fi
done

if [ "$bad" -gt 0 ]; then
  echo "Hash check failed. Extracted files deleted; nothing written to the output directory."
  exit 1
fi

mkdir -p "$OUT_DIR" || fail "could not create $OUT_DIR"
for n in "${WANTED[@]}"; do cp "$TMP/${CHOSEN[$n]}" "$OUT_DIR/$n"; done
echo "OK: four Seeds files matched the recorded hashes and were written to $OUT_DIR"
