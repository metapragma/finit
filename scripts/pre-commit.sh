#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

mapfile -d '' STAGED_FILES < <(git diff --cached --name-only -z --diff-filter=ACMR)

if [ ${#STAGED_FILES[@]} -eq 0 ]; then
  exit 0
fi

declare -A GO_DIRS=()
UI_LINT_FILES=()
UI_FORMAT_FILES=()

for file in "${STAGED_FILES[@]}"; do
  if [[ "${file}" == ui/* ]]; then
    rel="${file#ui/}"
    case "${file}" in
      *.ts|*.tsx)
        UI_LINT_FILES+=("${rel}")
        ;;
    esac
    case "${file}" in
      *.ts|*.tsx|*.js|*.jsx|*.css|*.json|*.md|*.html)
        UI_FORMAT_FILES+=("${rel}")
        ;;
    esac
    continue
  fi

  case "${file}" in
    *.go)
      dir="$(dirname "${file}")"
      GO_DIRS["${dir}"]=1
      ;;
  esac
done

if [ ${#GO_DIRS[@]} -gt 0 ]; then
  GO_PATHS=()
  for dir in "${!GO_DIRS[@]}"; do
    GO_PATHS+=("./${dir}")
  done
  ./scripts/lint-go.sh "${GO_PATHS[@]}"
fi

if [ ${#UI_LINT_FILES[@]} -gt 0 ] || [ ${#UI_FORMAT_FILES[@]} -gt 0 ]; then
  pushd "${ROOT_DIR}/ui" >/dev/null
  if [ ${#UI_LINT_FILES[@]} -gt 0 ]; then
    pnpm exec eslint --max-warnings=0 "${UI_LINT_FILES[@]}"
  fi
  if [ ${#UI_FORMAT_FILES[@]} -gt 0 ]; then
    pnpm exec prettier --check "${UI_FORMAT_FILES[@]}"
  fi
  popd >/dev/null
fi
