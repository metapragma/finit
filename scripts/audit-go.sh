#!/usr/bin/env bash
set -euo pipefail

VERSION="1.1.4"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="${ROOT_DIR}/.bin"
BIN_PATH="${BIN_DIR}/govulncheck"

if command -v govulncheck >/dev/null 2>&1; then
  govulncheck ./...
  exit 0
fi

if [ -x "${BIN_PATH}" ]; then
  "${BIN_PATH}" ./...
  exit 0
fi

mkdir -p "${BIN_DIR}"
echo "govulncheck not found; installing v${VERSION}" >&2
GOBIN="${BIN_DIR}" go install golang.org/x/vuln/cmd/govulncheck@v${VERSION}

"${BIN_PATH}" ./...
