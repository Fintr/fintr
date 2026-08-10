#!/usr/bin/env bash
# Rebuild graphify-out from staged source changes and stage the results so they
# land in the same commit. Stock `graphify hook install` uses post-commit and
# leaves graphify-out dangling; this repo requires the graph to travel with the
# code change.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "${REPO_ROOT}"

OUT_DIR="graphify-out"

if [[ "${GRAPHIFY_SKIP_HOOK:-0}" == "1" ]]; then
  exit 0
fi

# Skip during rebase/merge/cherry-pick (avoids blocking --continue)
GIT_DIR="$(git rev-parse --git-dir)"
[[ -d "${GIT_DIR}/rebase-merge" ]] && exit 0
[[ -d "${GIT_DIR}/rebase-apply" ]] && exit 0
[[ -f "${GIT_DIR}/MERGE_HEAD" ]] && exit 0
[[ -f "${GIT_DIR}/CHERRY_PICK_HEAD" ]] && exit 0

if [[ ! -f "${OUT_DIR}/graph.json" ]]; then
  echo "pre-commit (graphify): skip — ${OUT_DIR}/graph.json missing (run: graphify extract . --backend openai)"
  exit 0
fi

STAGED="$(git diff --cached --name-only --diff-filter=ACMRD || true)"
if [[ -z "${STAGED}" ]]; then
  exit 0
fi

# Skip when the commit only touches graphify-out (avoids rebuild loops)
NON_GRAPH="$(printf '%s\n' "${STAGED}" | grep -v '^graphify-out/' || true)"
if [[ -z "${NON_GRAPH}" ]]; then
  exit 0
fi

resolve_graphify_python() {
  local probe pinned from_file graphify_bin shebang
  probe="import importlib.util, sys; sys.exit(0 if importlib.util.find_spec('graphify') else 1)"

  if [[ -f "${OUT_DIR}/.graphify_python" ]]; then
    from_file="$(tr -d '[:space:]' < "${OUT_DIR}/.graphify_python" || true)"
    if [[ -n "${from_file}" && -x "${from_file}" ]] && "${from_file}" -c "${probe}" 2>/dev/null; then
      printf '%s\n' "${from_file}"
      return 0
    fi
  fi

  if command -v graphify >/dev/null 2>&1; then
    graphify_bin="$(command -v graphify)"
    shebang="$(head -n 1 "${graphify_bin}" 2>/dev/null | sed 's/^#![[:space:]]*//' || true)"
    case "${shebang}" in
      */env\ *) pinned="${shebang#*/env }" ;;
      /*) pinned="${shebang%% *}" ;;
      *) pinned="" ;;
    esac
    if [[ -n "${pinned}" ]] && "${pinned}" -c "${probe}" 2>/dev/null; then
      printf '%s\n' "${pinned}"
      return 0
    fi
  fi

  if command -v python3 >/dev/null 2>&1 && python3 -c "${probe}" 2>/dev/null; then
    printf '%s\n' "python3"
    return 0
  fi
  if command -v python >/dev/null 2>&1 && python -c "${probe}" 2>/dev/null; then
    printf '%s\n' "python"
    return 0
  fi

  return 1
}

if ! GRAPHIFY_PYTHON="$(resolve_graphify_python)"; then
  echo "pre-commit (graphify): warning — graphify not available; ${OUT_DIR} may go stale." >&2
  echo "  Install: uv tool install graphifyy && uv tool update-shell" >&2
  exit 0
fi

export PYTHONHASHSEED=0
export GRAPHIFY_CHANGED="${NON_GRAPH}"
# Dated backup folders under graphify-out/ are gitignored; skip writing them on
# every commit so the hook stays fast and the working tree stays clean.
export GRAPHIFY_NO_BACKUP=1

# Doc / paper / image changes need an LLM semantic pass. Pre-commit keeps the
# code graph fresh (AST only) and warns when docs changed so the semantic layer
# is not silently left stale.
DOC_GLOBS='\.md$|\.mdx$|\.txt$|\.rst$|\.html$|\.qmd$|\.pdf$'
DOC_CHANGES="$(printf '%s\n' "${NON_GRAPH}" | grep -E "${DOC_GLOBS}" || true)"

echo "pre-commit (graphify): rebuilding knowledge graph for staged source changes..."

if ! "${GRAPHIFY_PYTHON}" -c "
import os
import sys
from pathlib import Path

changed = [
    Path(line.strip())
    for line in os.environ.get('GRAPHIFY_CHANGED', '').splitlines()
    if line.strip()
]
if not changed:
    sys.exit(0)

from graphify.watch import _apply_resource_limits, _rebuild_code

_apply_resource_limits()
_rebuild_code(Path('.'), changed_paths=changed)
"; then
  echo "pre-commit (graphify): rebuild failed — fix the error above or set GRAPHIFY_SKIP_HOOK=1 once." >&2
  exit 1
fi

# Stage tracked graph artifacts (gitignore excludes machine-local + cache paths)
git add -- "${OUT_DIR}"

if git diff --cached --quiet -- "${OUT_DIR}"; then
  echo "pre-commit (graphify): graph unchanged"
else
  echo "pre-commit (graphify): staged ${OUT_DIR} updates for this commit"
fi

if [[ -n "${DOC_CHANGES}" ]]; then
  echo "pre-commit (graphify): note — doc/text files changed; AST hook does not refresh semantic doc nodes." >&2
  echo "  Re-run: set -a && source apps/fintr-be/.env && set +a && graphify extract . --backend openai" >&2
  echo "  Then: git add graphify-out/ && git commit --amend --no-edit   # or a follow-up commit" >&2
fi
