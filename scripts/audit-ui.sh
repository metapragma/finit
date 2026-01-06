#!/usr/bin/env bash
set -euo pipefail

pnpm -C ui audit --audit-level=high
