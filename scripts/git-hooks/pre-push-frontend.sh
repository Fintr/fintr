#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
FE_PREFIX="apps/fintr-fe"
FE_DIR="${REPO_ROOT}/${FE_PREFIX}"

collect_changed_paths() {
  local local_sha="$1"
  local remote_sha="$2"
  local base

  if [[ "${remote_sha}" == "0000000000000000000000000000000000000000" ]]; then
    if git -C "${REPO_ROOT}" show-ref --verify --quiet refs/remotes/origin/main; then
      base="$(git -C "${REPO_ROOT}" merge-base "${local_sha}" origin/main)"
      git -C "${REPO_ROOT}" diff --name-only "${base}" "${local_sha}"
    elif git -C "${REPO_ROOT}" show-ref --verify --quiet refs/heads/main; then
      base="$(git -C "${REPO_ROOT}" merge-base "${local_sha}" main)"
      git -C "${REPO_ROOT}" diff --name-only "${base}" "${local_sha}"
    else
      git -C "${REPO_ROOT}" diff-tree --no-commit-id --name-only -r "${local_sha}"
    fi
  else
    git -C "${REPO_ROOT}" diff --name-only "${remote_sha}" "${local_sha}"
  fi
}

strip_fe_prefix() {
  local path="$1"
  if [[ "${path}" == "${FE_PREFIX}/"* ]]; then
    echo "${path#${FE_PREFIX}/}"
  fi
}

run_vitest_full() {
  (cd "${FE_DIR}" && pnpm exec vitest run)
}

run_vitest_for_changes() {
  local -a test_files=()
  local -a related_sources=()
  local path relp

  while IFS= read -r path; do
    [[ -z "${path}" ]] && continue
    relp="$(strip_fe_prefix "${path}")"
    [[ -z "${relp}" ]] && continue

    if [[ "${relp}" =~ ^src/.+\.test\.tsx?$ ]]; then
      test_files+=("${relp}")
    elif [[ "${relp}" =~ ^src/.+\.(tsx|ts)$ ]]; then
      related_sources+=("${relp}")
    fi
  done <<< "${1}"

  if [[ ${#test_files[@]} -gt 0 ]]; then
    (cd "${FE_DIR}" && pnpm exec vitest run "${test_files[@]}")
  fi

  if [[ ${#related_sources[@]} -gt 0 ]]; then
    (cd "${FE_DIR}" && pnpm exec vitest related --run --passWithNoTests "${related_sources[@]}")
  fi
}

run_playwright_full() {
  (cd "${FE_DIR}" && pnpm exec playwright test --project=chromium)
}

run_playwright_specs() {
  local -a specs=()
  local path relp

  while IFS= read -r path; do
    [[ -z "${path}" ]] && continue
    relp="$(strip_fe_prefix "${path}")"
    [[ -z "${relp}" ]] && continue
    if [[ "${relp}" =~ ^e2e/.+\.spec\.ts$ ]]; then
      specs+=("${relp}")
    fi
  done <<< "${1}"

  if [[ ${#specs[@]} -gt 0 ]]; then
    (cd "${FE_DIR}" && pnpm exec playwright test --project=chromium "${specs[@]}")
  fi
}

main() {
  if [[ ! -d "${FE_DIR}/node_modules" ]]; then
    echo "pre-push (frontend): skip — ${FE_PREFIX}/node_modules missing. Run pnpm install in ${FE_PREFIX}."
    exit 0
  fi

  local -a all_fe_paths=()
  local line local_ref local_sha remote_ref remote_sha
  local fe_blob path relp
  local from_ref

  if [[ -n "${PRE_COMMIT_TO_REF:-}" ]]; then
    from_ref="${PRE_COMMIT_FROM_REF:-0000000000000000000000000000000000000000}"
    while IFS= read -r line; do
      [[ "${line}" == "${FE_PREFIX}/"* ]] && all_fe_paths+=("${line}")
    done < <(collect_changed_paths "${PRE_COMMIT_TO_REF}" "${from_ref}")
  else
    while read -r local_ref local_sha remote_ref remote_sha; do
      [[ -z "${local_sha:-}" ]] && continue
      while IFS= read -r line; do
        [[ "${line}" == "${FE_PREFIX}/"* ]] && all_fe_paths+=("${line}")
      done < <(collect_changed_paths "${local_sha}" "${remote_sha}")
    done
  fi

  if [[ ${#all_fe_paths[@]} -eq 0 ]]; then
    exit 0
  fi

  fe_blob="$(printf "%s\n" "${all_fe_paths[@]}" | sort -u)"

  local full_unit=false
  local full_e2e=false

  while IFS= read -r path; do
    [[ -z "${path}" ]] && continue
    relp="$(strip_fe_prefix "${path}")"
    [[ -z "${relp}" ]] && continue

    case "${relp}" in
      vitest.config.ts|next.config.ts|package.json|pnpm-lock.yaml|src/test/*)
        full_unit=true
        ;;
    esac

    if [[ "${relp}" =~ ^e2e/helpers/ ]] \
      || [[ "${relp}" == playwright.config.ts ]] \
      || [[ "${relp}" == package.json ]] \
      || [[ "${relp}" == pnpm-lock.yaml ]]; then
      full_e2e=true
    fi
  done <<< "${fe_blob}"

  if [[ "${full_unit}" == true ]]; then
    run_vitest_full
  else
    run_vitest_for_changes "${fe_blob}"
  fi

  local e2e_touched=false
  while IFS= read -r path; do
    [[ -z "${path}" ]] && continue
    relp="$(strip_fe_prefix "${path}")"
    if [[ "${relp}" == e2e/* ]]; then
      e2e_touched=true
      break
    fi
  done <<< "${fe_blob}"

  if [[ "${e2e_touched}" != true ]]; then
    exit 0
  fi

  if [[ "${full_e2e}" == true ]]; then
    run_playwright_full
    exit 0
  fi

  local spec_only=true
  while IFS= read -r path; do
    [[ -z "${path}" ]] && continue
    relp="$(strip_fe_prefix "${path}")"
    [[ -z "${relp}" ]] && continue
    if [[ "${relp}" == e2e/* ]] && [[ ! "${relp}" =~ ^e2e/.+\.spec\.ts$ ]]; then
      spec_only=false
      break
    fi
  done <<< "${fe_blob}"

  if [[ "${spec_only}" == true ]]; then
    run_playwright_specs "${fe_blob}"
  else
    run_playwright_full
  fi
}

main "$@"
