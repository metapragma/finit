#!/usr/bin/env bash
set -euo pipefail

VERSION="1.60.3"

if command -v golangci-lint >/dev/null 2>&1; then
  golangci-lint run ./...
  exit 0
fi

echo "golangci-lint not found; using go run for v${VERSION}" >&2
go run github.com/golangci/golangci-lint/cmd/golangci-lint@v${VERSION} run ./...
