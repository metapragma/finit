#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

git config core.hooksPath "${ROOT_DIR}/.githooks"
echo "Git hooks path set to ${ROOT_DIR}/.githooks"
