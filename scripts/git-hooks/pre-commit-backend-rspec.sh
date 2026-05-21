#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
BE_PREFIX="apps/fintr-be"
BE_DIR="${REPO_ROOT}/${BE_PREFIX}"

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

be_changes_present() {
  local path
  while IFS= read -r path; do
    [[ -z "${path}" ]] && continue
    if [[ "${path}" == "${BE_PREFIX}/app/"* ]] \
      || [[ "${path}" == "${BE_PREFIX}/lib/"* ]] \
      || [[ "${path}" == "${BE_PREFIX}/spec/"* ]]; then
      return 0
    fi
  done <<< "${1}"
  return 1
}

main() {
  if [[ ! -f "${BE_DIR}/Gemfile" ]]; then
    echo "pre-commit (backend): skip — ${BE_PREFIX}/Gemfile missing."
    exit 0
  fi

  local -a all_paths=()
  local line local_ref local_sha remote_ref remote_sha
  local from_ref

  if [[ -n "${PRE_COMMIT_TO_REF:-}" ]]; then
    from_ref="${PRE_COMMIT_FROM_REF:-0000000000000000000000000000000000000000}"
    while IFS= read -r line; do
      [[ -n "${line}" ]] && all_paths+=("${line}")
    done < <(collect_changed_paths "${PRE_COMMIT_TO_REF}" "${from_ref}")
  else
    while read -r local_ref local_sha remote_ref remote_sha; do
      [[ -z "${local_sha:-}" ]] && continue
      while IFS= read -r line; do
        [[ -n "${line}" ]] && all_paths+=("${line}")
      done < <(collect_changed_paths "${local_sha}" "${remote_sha}")
    done
  fi

  if [[ ${#all_paths[@]} -eq 0 ]]; then
    exit 0
  fi

  local path_blob
  path_blob="$(printf "%s\n" "${all_paths[@]}" | sort -u)"

  if ! be_changes_present "${path_blob}"; then
    exit 0
  fi

  echo "pre-commit (backend): running specs for changed app/lib/spec files..."
  (cd "${BE_DIR}" && ./bin/rspec-changed)
}

main "$@"
