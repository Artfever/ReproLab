#!/usr/bin/env bash
# Build the ReproLab OpenBUGS worker image from a locally held source tarball
# (spec 03-local-product, Requirements 19.2 to 19.6).
#
#   scripts/build-image.sh [--tag reprolab-openbugs:3.2.3-vendored] [--fetch-mirror]
#
# Put the OpenBUGS 3.2.3 Linux source package at vendor/OpenBUGS-3.2.3.tar.gz first. The script prints its SHA-256 next to the
# SHA-256 of "the copy we tested" and stops on a mismatch. That value is the hash of the copy this project tested, not a
# checksum published by the OpenBUGS authors. --fetch-mirror downloads an unauthenticated mirror copy into vendor/.
# The script never pushes, saves or exports the image.
set -euo pipefail

TESTED_SHA256='a289c4da0c4ac371f8013226c85ebd0a9e1dec5de9b858950e4854cb814b4ed8'
MIRROR_URL='https://raw.githubusercontent.com/chjackson/openbugsdoc/27abd6d1eca1bebddedb6ee7366eab7907727c01/OpenBUGS-3.2.3.tar.gz'
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARBALL="$ROOT/vendor/OpenBUGS-3.2.3.tar.gz"
TAG='reprolab-openbugs:3.2.3-vendored'
FETCH=0

while [ $# -gt 0 ]; do
  case "$1" in
    --tag) [ $# -ge 2 ] || { echo 'build-image: --tag needs a value.' >&2; exit 2; }; TAG="$2"; shift 2 ;;
    --fetch-mirror) FETCH=1; shift ;;
    *) echo "build-image: unknown option: $1" >&2; exit 2 ;;
  esac
done

if ! [[ "$TAG" =~ ^[a-z0-9][a-z0-9._/-]*:[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$ ]]; then
  echo 'build-image: --tag must look like name:version, for example reprolab-openbugs:3.2.3-vendored.' >&2
  exit 2
fi

if [ "$FETCH" -eq 1 ]; then
  mkdir -p "$ROOT/vendor"
  echo 'Downloading from the old pinned mirror URL into vendor/ ...'
  if command -v curl >/dev/null 2>&1; then curl -fsSL -o "$TARBALL" "$MIRROR_URL"; else wget -q -O "$TARBALL" "$MIRROR_URL"; fi
  echo 'unauthenticated mirror copy, not upstream-verified'
fi

if [ ! -f "$TARBALL" ]; then
  echo 'build-image: vendor/OpenBUGS-3.2.3.tar.gz is missing.' >&2
  echo 'Download the OpenBUGS 3.2.3 Linux source package yourself and save it at that path, or re-run with --fetch-mirror.' >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then ACTUAL="$(sha256sum "$TARBALL" | cut -d' ' -f1)"; else ACTUAL="$(shasum -a 256 "$TARBALL" | cut -d' ' -f1)"; fi
echo "SHA-256 of vendor/OpenBUGS-3.2.3.tar.gz : $ACTUAL"
echo "SHA-256 of the copy we tested           : $TESTED_SHA256"
if [ "$ACTUAL" != "$TESTED_SHA256" ]; then
  echo 'build-image: MISMATCH. This file is not the copy we tested. Not building.' >&2
  exit 1
fi
echo 'Hash check: match (the file is byte-identical to the copy we tested).'

cd "$ROOT"
docker build --platform linux/amd64 -f infra/openbugs/Dockerfile -t "$TAG" .
echo "Built image $TAG (local only; nothing was pushed or saved)."
