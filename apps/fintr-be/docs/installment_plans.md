# Installment plans

Canonical implemented behavior (create, edit scopes, revision math, FX leftovers) lives in the monorepo doc:

**[docs/installment_plans.md](../../docs/installment_plans.md)**

Operations: `CreateTransaction#adjust_amount`, `UpdateTransaction`, `ReviseInstallmentPlan`. Shared Ruby math: `Utils::InstallmentPlan`.
