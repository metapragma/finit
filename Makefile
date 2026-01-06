.PHONY: lint lint-go lint-ui format format-ui format-check format-check-ui audit audit-go audit-ui

lint: lint-go lint-ui

lint-go:
	./scripts/lint-go.sh

lint-ui:
	./scripts/lint-ui.sh

format: format-ui

format-ui:
	pnpm -C ui format

format-check: format-check-ui

format-check-ui:
	pnpm -C ui format:check

audit: audit-go audit-ui

audit-go:
	./scripts/audit-go.sh

audit-ui:
	./scripts/audit-ui.sh
