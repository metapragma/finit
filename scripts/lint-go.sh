#!/usr/bin/env bash
set -euo pipefail

VERSION="1.60.3"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="${ROOT_DIR}/.bin"
BIN_PATH="${BIN_DIR}/golangci-lint"
ARGS=("$@")

if [ ${#ARGS[@]} -eq 0 ]; then
  ARGS=("./...")
fi

if command -v golangci-lint >/dev/null 2>&1; then
  golangci-lint run "${ARGS[@]}"
  exit 0
fi

if [ -x "${BIN_PATH}" ]; then
  "${BIN_PATH}" run "${ARGS[@]}"
  exit 0
fi

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "${ARCH}" in
  x86_64) ARCH="amd64" ;;
  aarch64 | arm64) ARCH="arm64" ;;
esac

TARBALL="golangci-lint-${VERSION}-${OS}-${ARCH}.tar.gz"
URL="https://github.com/golangci/golangci-lint/releases/download/v${VERSION}/${TARBALL}"

mkdir -p "${BIN_DIR}"
TMP="$(mktemp -t golangci-lint.XXXXXX)"
echo "golangci-lint not found; downloading v${VERSION} (${OS}/${ARCH})" >&2
curl -fsSL "${URL}" -o "${TMP}"
tar -xzf "${TMP}" -C "${BIN_DIR}" --strip-components=1 "golangci-lint-${VERSION}-${OS}-${ARCH}/golangci-lint"
rm -f "${TMP}"

"${BIN_PATH}" run "${ARGS[@]}"
